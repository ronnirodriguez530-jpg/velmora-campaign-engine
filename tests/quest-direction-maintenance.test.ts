import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { runPlayerAction } from "../src/application/turn-orchestrator.ts";
import { applyQuestDirectionRevision, validateQuestDirectionRevision } from "../src/application/quest-direction-maintenance.ts";
import { generateQuestFromThread } from "../src/application/quest-generator.ts";
import type { CampaignDirector } from "../src/director/director.ts";
import type { ToolRequest } from "../src/domain/types.ts";
import { appendEvent, createCampaign, listEvents, listQuestInstances, listStoryThreads, openDatabase, persistStoryThread, restorePreviousTurn } from "../src/persistence/database.ts";

async function setup(name: string) {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), "velmora-direction-maintenance-")), "test.sqlite"));
  const campaignId = createCampaign(db, content, name, `${name}-seed`);
  const quest = generateQuestFromThread(db, content, campaignId, "THREAD-OPENING-PRESSURE");
  return { content, db, campaignId, quest };
}

function relatedConsequence(db: ReturnType<typeof openDatabase>, campaignId: string, label: string): number {
  appendEvent(db, campaignId, 0, "tool_applied", {
    type: "record_location_consequence",
    locationId: "LOC-COUNCIL-CROWN",
    consequence: label,
    reason: label
  });
  return Number(listEvents(db, campaignId).at(-1)!.sequence);
}

function directorFor(toolRequests: ToolRequest[]): CampaignDirector {
  return {
    source: "diagnostic",
    preview: async () => { throw new Error("not used"); },
    presentScene: async () => { throw new Error("not used"); },
    planTurn: async () => ({
      summary: "Recorded world changes alter the remaining approaches.",
      majorActionProposal: true,
      toolRequests,
      suggestedActions: ["Review the remaining direction", "Choose another action"],
      allowsFreeText: true
    })
  };
}

test("direction invalidation requires a related durable consequence", async () => {
  const { db, campaignId, quest } = await setup("direction-evidence");
  try {
    const directionId = quest.possibleDirections[0]!.directionId;
    assert.throws(() => validateQuestDirectionRevision(db, campaignId, {
      type: "revise_quest_directions",
      questId: quest.questId,
      invalidatedDirectionId: directionId,
      consequenceEventSequences: [],
      reason: "The route is allegedly gone."
    }), /requires 1-4 distinct consequence-event references/);
    appendEvent(db, campaignId, 0, "tool_applied", {
      type: "change_faction_condition",
      factionId: "FAC-006",
      delta: 1,
      reason: "An unrelated faction changes elsewhere."
    });
    const unrelated = Number(listEvents(db, campaignId).at(-1)!.sequence);
    assert.throws(() => validateQuestDirectionRevision(db, campaignId, {
      type: "revise_quest_directions",
      questId: quest.questId,
      invalidatedDirectionId: directionId,
      consequenceEventSequences: [unrelated],
      reason: "An unrelated change must not remove this direction."
    }), /must directly concern the quest's recorded/);
    assert.deepEqual(listQuestInstances(db, campaignId)[0]!.possibleDirections, quest.possibleDirections);
  } finally { db.close(); }
});

test("a lost direction receives at most one unused causally credible replacement", async () => {
  const { content, db, campaignId } = await setup("direction-replacement");
  try {
    const openingThread = listStoryThreads(db, campaignId).find((thread) => thread.threadId === "THREAD-OPENING-PRESSURE")!;
    persistStoryThread(db, {
      ...openingThread,
      threadId: "THREAD-DIRECTION-REPLACEMENT",
      kind: "dynamic",
      title: "A Shifting Access Crisis",
      summary: "Several causally distinct responses remain possible while access changes.",
      urgency: 2,
      factionIds: ["FAC-001"],
      createdTurn: 0,
      updatedTurn: 0,
      lastUsedTurn: 0
    });
    const quest = generateQuestFromThread(db, content, campaignId, "THREAD-DIRECTION-REPLACEMENT");
    assert.equal(quest.possibleDirections.length, 2);
    const invalidated = quest.possibleDirections[0]!;
    const evidence = relatedConsequence(db, campaignId, "The access required by the offered route collapses.");
    const updated = applyQuestDirectionRevision(db, campaignId, 1, {
      type: "revise_quest_directions",
      questId: quest.questId,
      invalidatedDirectionId: invalidated.directionId,
      consequenceEventSequences: [evidence],
      reason: "The recorded collapse makes the offered approach impossible."
    });
    assert.equal(updated.possibleDirections.some((direction) => direction.directionId === invalidated.directionId), false);
    assert.equal(updated.possibleDirections.length, quest.possibleDirections.length);
    const replacement = updated.possibleDirections.find((direction) => !quest.possibleDirections.some((original) => original.directionId === direction.directionId));
    assert.ok(replacement);
    assert.equal(quest.possibleDirections.some((direction) => direction.approachKey === replacement.approachKey), false);
    assert.throws(() => validateQuestDirectionRevision(db, campaignId, {
      type: "revise_quest_directions",
      questId: quest.questId,
      invalidatedDirectionId: updated.possibleDirections[0]!.directionId,
      consequenceEventSequences: [evidence],
      reason: "The same evidence cannot erase another choice."
    }), /may justify only one direction revision/);
  } finally { db.close(); }
});

test("the engine keeps fewer choices when no credible unused replacement remains", async () => {
  const { db, campaignId, quest } = await setup("direction-no-forced-replacement");
  try {
    const firstEvidence = relatedConsequence(db, campaignId, "One offered access route becomes unusable.");
    const first = applyQuestDirectionRevision(db, campaignId, 1, {
      type: "revise_quest_directions",
      questId: quest.questId,
      invalidatedDirectionId: quest.possibleDirections[0]!.directionId,
      consequenceEventSequences: [firstEvidence],
      reason: "The first route is no longer physically possible."
    });
    const secondEvidence = relatedConsequence(db, campaignId, "A second independent approach loses its necessary access.");
    const second = applyQuestDirectionRevision(db, campaignId, 2, {
      type: "revise_quest_directions",
      questId: quest.questId,
      invalidatedDirectionId: first.possibleDirections[0]!.directionId,
      consequenceEventSequences: [secondEvidence],
      reason: "The second route is also no longer possible."
    });
    assert.equal(second.possibleDirections.length, 1, "No replacement is forced after every unused credible module has been exhausted");
    const finalEvidence = relatedConsequence(db, campaignId, "The final route also becomes impossible.");
    assert.throws(() => validateQuestDirectionRevision(db, campaignId, {
      type: "revise_quest_directions",
      questId: quest.questId,
      invalidatedDirectionId: second.possibleDirections[0]!.directionId,
      consequenceEventSequences: [finalEvidence],
      reason: "The last route must fail the quest instead of disappearing silently."
    }), /last credible direction requires consequence-based quest failure/);
  } finally { db.close(); }
});

test("Campaign Master direction revision commits atomically and rollback restores the choices", async () => {
  const { content, db, campaignId, quest } = await setup("direction-turn-rollback");
  try {
    const originalDirections = quest.possibleDirections;
    const evidence = relatedConsequence(db, campaignId, "The original approach loses the access it requires.");
    const request: ToolRequest = {
      type: "revise_quest_directions",
      questId: quest.questId,
      invalidatedDirectionId: quest.possibleDirections[0]!.directionId,
      consequenceEventSequences: [evidence],
      reason: "The recorded loss of access makes this exact direction impossible."
    };
    const result = await runPlayerAction(db, content, directorFor([request]), "direction-turn-rollback", "accept that the route is gone");
    assert.equal(result.advanced, true);
    assert.equal(listQuestInstances(db, campaignId)[0]!.possibleDirections.some((direction) => direction.directionId === request.invalidatedDirectionId), false);
    restorePreviousTurn(db, "direction-turn-rollback");
    assert.deepEqual(listQuestInstances(db, campaignId)[0]!.possibleDirections, originalDirections);
  } finally { db.close(); }
});
