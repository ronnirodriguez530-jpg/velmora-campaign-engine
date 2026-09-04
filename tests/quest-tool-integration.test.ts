import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CampaignDirector } from "../src/director/director.ts";
import type { DirectorTurnPlan, ToolRequest } from "../src/domain/types.ts";
import { MockDirector } from "../src/director/mock-director.ts";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { generateQuestFromThread } from "../src/application/quest-generator.ts";
import { activateQuest, failQuestRecoverably, updateQuestObjective } from "../src/application/quest-system.ts";
import { runPlayerAction } from "../src/application/turn-orchestrator.ts";
import { createCampaign, getFactionCondition, listQuestInstances, openDatabase, persistQuestInstance, restorePreviousTurn } from "../src/persistence/database.ts";

async function setup(name: string) {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), "velmora-quest-tool-test-")), "test.sqlite"));
  const campaignId = createCampaign(db, content, name, `${name}-seed`);
  return { content, db, campaignId };
}

function directorFor(toolRequests: ToolRequest[]): CampaignDirector {
  return {
    source: "diagnostic",
    preview: (context) => new MockDirector().preview(context),
    presentScene: (context, scene) => new MockDirector().presentScene(context, scene),
    planTurn: async (): Promise<DirectorTurnPlan> => ({
      summary: "The committed action changes the active quest state.",
      majorActionProposal: true,
      toolRequests,
      suggestedActions: ["Review the result", "Choose the next approach"],
      allowsFreeText: true
    })
  };
}

function readyOpeningQuest(db: ReturnType<typeof openDatabase>, content: Awaited<ReturnType<typeof loadVelmoraContent>>, campaignId: string) {
  const quest = generateQuestFromThread(db, content, campaignId, "THREAD-OPENING-PRESSURE");
  activateQuest(db, campaignId, quest.questId);
  for (const objective of quest.objectives) {
    updateQuestObjective(db, campaignId, quest.questId, objective.objectiveId, "completed");
  }
  return listQuestInstances(db, campaignId).find((candidate) => candidate.questId === quest.questId)!;
}

test("Campaign Master can generate, activate, and advance an engine-owned quest", async () => {
  const { content, db, campaignId } = await setup("quest-tool-generate");
  try {
    const result = await runPlayerAction(db, content, directorFor([{
      type: "generate_quest",
      sourceThreadId: "THREAD-OPENING-PRESSURE",
      reason: "The visible opening pressure now needs a concrete player objective."
    }]), "quest-tool-generate", "commit to responding to the crisis");
    const quest = listQuestInstances(db, campaignId)[0]!;
    assert.equal(result.currentTurn, 1);
    assert.equal(quest.sourceThreadId, "THREAD-OPENING-PRESSURE");
    assert.equal(quest.createdTurn, 1);
    assert.equal(quest.state, "available");

    await runPlayerAction(db, content, directorFor([{
      type: "manage_quest",
      questId: quest.questId,
      action: "activate",
      objectiveId: null,
      outcomeId: null,
      reason: "The player accepted the available objective."
    }]), "quest-tool-generate", "commit to the generated quest");
    const active = listQuestInstances(db, campaignId).find((candidate) => candidate.questId === quest.questId)!;
    assert.equal(active.state, "active");
    assert.equal(active.objectives[0]?.state, "active");

    await runPlayerAction(db, content, directorFor([{
      type: "manage_quest",
      questId: quest.questId,
      action: "complete_objective",
      objectiveId: active.objectives[0]!.objectiveId,
      outcomeId: null,
      reason: "The player's completed action satisfied the current objective."
    }]), "quest-tool-generate", "complete the first objective");
    const advanced = listQuestInstances(db, campaignId).find((candidate) => candidate.questId === quest.questId)!;
    assert.equal(advanced.objectives[0]?.state, "completed");
    assert.equal(advanced.objectives[1]?.state, "active");
  } finally { db.close(); }
});

test("quest completion and its validated world consequence commit in one turn", async () => {
  const { content, db, campaignId } = await setup("quest-tool-outcome");
  try {
    const quest = readyOpeningQuest(db, content, campaignId);
    const before = getFactionCondition(db, campaignId, "FAC-001")!;
    await runPlayerAction(db, content, directorFor([
      {
        type: "manage_quest",
        questId: quest.questId,
        action: "complete",
        objectiveId: null,
        outcomeId: quest.outcomes[0]!.outcomeId,
        reason: "The player completed every objective and committed to the recorded direct outcome."
      },
      {
        type: "change_faction_condition",
        factionId: "FAC-001",
        delta: 1,
        reason: "The selected outcome materially helped the League of Thorns."
      }
    ]), "quest-tool-outcome", "commit to the direct solution");
    const completed = listQuestInstances(db, campaignId).find((candidate) => candidate.questId === quest.questId)!;
    assert.equal(completed.state, "completed");
    assert.equal(completed.selectedOutcomeId, quest.outcomes[0]!.outcomeId);
    assert.equal(getFactionCondition(db, campaignId, "FAC-001"), before + 1);
  } finally { db.close(); }
});

test("an invalid combined consequence plan leaves both quest and world state unchanged", async () => {
  const { content, db, campaignId } = await setup("quest-tool-atomic-reject");
  try {
    const quest = readyOpeningQuest(db, content, campaignId);
    const before = getFactionCondition(db, campaignId, "FAC-001")!;
    const invalidPlan = directorFor([
      {
        type: "manage_quest",
        questId: quest.questId,
        action: "complete",
        objectiveId: null,
        outcomeId: quest.outcomes[0]!.outcomeId,
        reason: "The quest portion is valid but must not commit alone."
      },
      {
        type: "change_faction_condition",
        factionId: "FAC-MISSING",
        delta: 1,
        reason: "This invalid consequence must reject the complete combined plan."
      }
    ]);
    await assert.rejects(
      () => runPlayerAction(db, content, invalidPlan, "quest-tool-atomic-reject", "commit to an invalid combined result"),
      /could not produce a valid plan/
    );
    const unchanged = listQuestInstances(db, campaignId).find((candidate) => candidate.questId === quest.questId)!;
    assert.equal(unchanged.state, "active");
    assert.equal(unchanged.selectedOutcomeId, null);
    assert.equal(getFactionCondition(db, campaignId, "FAC-001"), before);
  } finally { db.close(); }
});

test("Campaign Master can keep two distinct recovery routes pursuable and rollback both atomically", async () => {
  const { content, db, campaignId } = await setup("quest-tool-recovery");
  try {
    const original = generateQuestFromThread(db, content, campaignId, "THREAD-OPENING-PRESSURE");
    const secondPath = "Changed evidence opens a separate route through another survivor.";
    persistQuestInstance(db, { ...original, recoveryPaths: [original.recoveryPaths[0]!, secondPath] });
    activateQuest(db, campaignId, original.questId);
    failQuestRecoverably(db, campaignId, original.questId);
    await runPlayerAction(db, content, directorFor([
      {
        type: "generate_recovery_quest",
        failedQuestId: original.questId,
        recoveryPath: original.recoveryPaths[0]!,
        reason: "The failed approach now permits its first recorded altered route."
      },
      {
        type: "generate_recovery_quest",
        failedQuestId: original.questId,
        recoveryPath: secondPath,
        reason: "The consequences also support a distinct second recorded route."
      }
    ]), "quest-tool-recovery", "commit to preserving both altered recovery routes");
    const recoveries = listQuestInstances(db, campaignId).filter((quest) => quest.recoveryOfQuestId === original.questId);
    assert.equal(recoveries.length, 2);
    assert.deepEqual(new Set(recoveries.map((quest) => quest.recoveryPathUsed)), new Set([original.recoveryPaths[0]!, secondPath]));
    assert.equal(recoveries.every((quest) => quest.createdTurn === 1 && quest.state === "available"), true);

    restorePreviousTurn(db, "quest-tool-recovery");
    const restored = listQuestInstances(db, campaignId);
    assert.equal(restored.some((quest) => quest.recoveryOfQuestId === original.questId), false);
    assert.equal(restored.find((quest) => quest.questId === original.questId)?.state, "failed");
  } finally { db.close(); }
});
