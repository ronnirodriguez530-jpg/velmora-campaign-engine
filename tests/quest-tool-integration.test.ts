import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CampaignDirector } from "../src/director/director.ts";
import type { DirectorTurnPlan, ToolRequest } from "../src/domain/types.ts";
import { MockDirector } from "../src/director/mock-director.ts";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { buildDirectorPlanningContext } from "../src/application/context-builder.ts";
import { generateQuestFromThread } from "../src/application/quest-generator.ts";
import { activateQuest, failQuestRecoverably, updateQuestObjective, validateQuestManagement } from "../src/application/quest-system.ts";
import { runPlayerAction } from "../src/application/turn-orchestrator.ts";
import { appendEvent, createCampaign, getFactionCondition, listEvents, listQuestInstances, openDatabase, persistQuestInstance, restorePreviousTurn } from "../src/persistence/database.ts";

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
      relationships: [],
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
      consequenceEventSequences: [],
      warningMethod: null,
      warningSignal: null,
      warningSourceNpcId: null,
      neglectTrigger: null,
      neglectComplicationTool: null,
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
      consequenceEventSequences: [],
      warningMethod: null,
      warningSignal: null,
      warningSourceNpcId: null,
      neglectTrigger: null,
      neglectComplicationTool: null,
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
        consequenceEventSequences: [],
        warningMethod: null,
        warningSignal: null,
        warningSourceNpcId: null,
        neglectTrigger: null,
        neglectComplicationTool: null,
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
        consequenceEventSequences: [],
        warningMethod: null,
        warningSignal: null,
        warningSourceNpcId: null,
        neglectTrigger: null,
        neglectComplicationTool: null,
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
    appendEvent(db, campaignId, 0, "tool_applied", {
      type: "record_location_consequence",
      locationId: "LOC-COUNCIL-CROWN",
      consequence: "The failed response leaves changed evidence in the plaza.",
      reason: "This durable consequence makes altered recovery credible."
    });
    const consequenceSequence = Number(listEvents(db, campaignId).at(-1)!.sequence);
    assert.equal(buildDirectorPlanningContext(db, content, "quest-tool-recovery").recoveryEvidenceEvents[0]?.sequence, consequenceSequence);
    await runPlayerAction(db, content, directorFor([
      {
        type: "generate_recovery_quest",
        failedQuestId: original.questId,
        recoveryPath: original.recoveryPaths[0]!,
        consequenceEventSequences: [consequenceSequence],
        reason: "The failed approach now permits its first recorded altered route."
      },
      {
        type: "generate_recovery_quest",
        failedQuestId: original.questId,
        recoveryPath: secondPath,
        consequenceEventSequences: [consequenceSequence],
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

test("an unresolved route is preserved unless cited consequences prove it impossible", async () => {
  const { content, db, campaignId } = await setup("quest-route-invalidation");
  try {
    const primary = generateQuestFromThread(db, content, campaignId, "THREAD-OPENING-PRESSURE");
    const alternative = generateQuestFromThread(db, content, campaignId, "THREAD-OPENING-PRESSURE", [{ questId: primary.questId, type: "parallel" }]);
    assert.equal(primary.failureMode, "recoverable");
    assert.equal(alternative.failureMode, "recoverable");

    assert.throws(() => validateQuestManagement(db, campaignId, {
      type: "manage_quest",
      questId: alternative.questId,
      action: "fail_from_consequence",
      objectiveId: null,
      outcomeId: null,
      consequenceEventSequences: [],
      warningMethod: null,
      warningSignal: null,
      warningSourceNpcId: null,
      neglectTrigger: null,
      neglectComplicationTool: null,
      reason: "No recorded consequence supports closing this route."
    }), /requires 1-4 distinct consequence-event references/);
    assert.equal(listQuestInstances(db, campaignId).find((quest) => quest.questId === alternative.questId)?.state, "available");

    appendEvent(db, campaignId, 0, "tool_applied", {
      type: "change_faction_condition",
      factionId: "FAC-006",
      delta: 1,
      reason: "This is durable but unrelated to the opening route."
    });
    const unrelatedSequence = Number(listEvents(db, campaignId).at(-1)!.sequence);
    assert.throws(() => validateQuestManagement(db, campaignId, {
      type: "manage_quest",
      questId: alternative.questId,
      action: "fail_from_consequence",
      objectiveId: null,
      outcomeId: null,
      consequenceEventSequences: [unrelatedSequence],
      warningMethod: null,
      warningSignal: null,
      warningSourceNpcId: null,
      neglectTrigger: null,
      neglectComplicationTool: null,
      reason: "An unrelated faction change must not be enough to close this route."
    }), /must directly concern the quest's recorded/);

    appendEvent(db, campaignId, 0, "tool_applied", {
      type: "record_location_consequence",
      locationId: "LOC-COUNCIL-CROWN",
      consequence: "The only passage supporting the alternative route collapses permanently.",
      reason: "This recorded world change makes that route impossible."
    });
    const consequenceSequence = Number(listEvents(db, campaignId).at(-1)!.sequence);
    await runPlayerAction(db, content, directorFor([{
      type: "manage_quest",
      questId: alternative.questId,
      action: "fail_from_consequence",
      objectiveId: null,
      outcomeId: null,
      consequenceEventSequences: [consequenceSequence],
      warningMethod: null,
      warningSignal: null,
      warningSourceNpcId: null,
      neglectTrigger: null,
      neglectComplicationTool: null,
      reason: "The collapsed passage permanently removes the alternative route."
    }]), "quest-route-invalidation", "accept that the alternate passage is gone");

    const quests = listQuestInstances(db, campaignId);
    const preservedPrimary = quests.find((quest) => quest.questId === primary.questId)!;
    const failedAlternative = quests.find((quest) => quest.questId === alternative.questId)!;
    assert.equal(preservedPrimary.state, "available");
    assert.equal(failedAlternative.state, "failed");
    assert.equal(failedAlternative.failureReason, "The collapsed passage permanently removes the alternative route.");
    assert.deepEqual(failedAlternative.failureEvidenceEventSequences, [consequenceSequence]);

    restorePreviousTurn(db, "quest-route-invalidation");
    const restored = listQuestInstances(db, campaignId).find((quest) => quest.questId === alternative.questId)!;
    assert.equal(restored.state, "available");
    assert.equal(restored.failureReason, null);
    assert.deepEqual(restored.failureEvidenceEventSequences, []);
  } finally { db.close(); }
});

test("recorded warnings permit only mild evidence-backed neglect complications", async () => {
  const { content, db, campaignId } = await setup("quest-neglect");
  try {
    const quest = generateQuestFromThread(db, content, campaignId, "THREAD-OPENING-PRESSURE");
    const warningSignal = quest.warningSignals[0]!;
    const npcId = content.characters[0]!.id;

    await runPlayerAction(db, content, directorFor([{
      type: "manage_quest",
      questId: quest.questId,
      action: "record_warning",
      objectiveId: null,
      outcomeId: null,
      consequenceEventSequences: [],
      warningMethod: "established_npc_message",
      warningSignal,
      warningSourceNpcId: npcId,
      neglectTrigger: null,
      neglectComplicationTool: null,
      reason: "An established witness clearly warns the player that the plaza danger is worsening."
    }]), "quest-neglect", "accept the witness's warning");
    const firstWarningSequence = Number(listEvents(db, campaignId).findLast((event) => event.eventType === "quest_warning_recorded")!.sequence);

    const firstComplicationReason = "The player deliberately chooses another priority after the warning, allowing one minor obstruction to develop.";
    await runPlayerAction(db, content, directorFor([
      {
        type: "manage_quest",
        questId: quest.questId,
        action: "apply_neglect_complication",
        objectiveId: null,
        outcomeId: null,
        consequenceEventSequences: [firstWarningSequence],
        warningMethod: null,
        warningSignal: null,
        warningSourceNpcId: null,
        neglectTrigger: "ignored_warning_after_deliberate_choice",
        neglectComplicationTool: "record_location_consequence",
        reason: firstComplicationReason
      },
      {
        type: "record_location_consequence",
        locationId: quest.locationIds[0]!,
        consequence: "Debris now slows one approach through the plaza without closing it.",
        reason: firstComplicationReason
      }
    ]), "quest-neglect", "choose to help elsewhere despite the warning");
    let changed = listQuestInstances(db, campaignId).find((candidate) => candidate.questId === quest.questId)!;
    assert.equal(changed.state, "available");
    assert.equal(changed.neglectHistory.length, 1);

    assert.throws(() => validateQuestManagement(db, campaignId, {
      type: "manage_quest",
      questId: quest.questId,
      action: "apply_neglect_complication",
      objectiveId: null,
      outcomeId: null,
      consequenceEventSequences: [firstWarningSequence],
      warningMethod: null,
      warningSignal: null,
      warningSourceNpcId: null,
      neglectTrigger: "ignored_warning_after_deliberate_choice",
      neglectComplicationTool: "record_location_consequence",
      reason: "Reusing one warning cannot repeatedly punish the player."
    }), /requires new warning or world-event evidence/);

    await runPlayerAction(db, content, directorFor([{
      type: "manage_quest",
      questId: quest.questId,
      action: "record_warning",
      objectiveId: null,
      outcomeId: null,
      consequenceEventSequences: [],
      warningMethod: "obvious_environmental_warning",
      warningSignal,
      warningSourceNpcId: null,
      neglectTrigger: null,
      neglectComplicationTool: null,
      reason: "A visible surge and falling masonry clearly renew the warning."
    }]), "quest-neglect", "acknowledge the obvious environmental warning");
    const secondWarningSequence = Number(listEvents(db, campaignId).findLast((event) => event.eventType === "quest_warning_recorded")!.sequence);

    const secondComplicationReason = "A second deliberate delay after a new warning causes one additional mild obstruction.";
    await runPlayerAction(db, content, directorFor([
      {
        type: "manage_quest",
        questId: quest.questId,
        action: "apply_neglect_complication",
        objectiveId: null,
        outcomeId: null,
        consequenceEventSequences: [secondWarningSequence],
        warningMethod: null,
        warningSignal: null,
        warningSourceNpcId: null,
        neglectTrigger: "ignored_warning_after_deliberate_choice",
        neglectComplicationTool: "record_location_consequence",
        reason: secondComplicationReason
      },
      {
        type: "record_location_consequence",
        locationId: quest.locationIds[0]!,
        consequence: "Crowds make the same approach slower, but the route remains recoverable.",
        reason: secondComplicationReason
      }
    ]), "quest-neglect", "choose another priority after the renewed warning");
    changed = listQuestInstances(db, campaignId).find((candidate) => candidate.questId === quest.questId)!;
    assert.equal(changed.state, "available");
    assert.equal(changed.neglectHistory.length, 2);
    assert.equal(changed.failureReason, null);

    restorePreviousTurn(db, "quest-neglect");
    const restored = listQuestInstances(db, campaignId).find((candidate) => candidate.questId === quest.questId)!;
    assert.equal(restored.neglectHistory.length, 1);
    assert.equal(restored.state, "available");

    const currentTurn = Number((db.prepare("SELECT turn FROM campaigns WHERE id = ?").get(campaignId) as { turn: number }).turn);
    appendEvent(db, campaignId, currentTurn, "tool_applied", {
      type: "record_location_consequence",
      locationId: quest.locationIds[0]!,
      consequence: "A fresh surge advances the plaza threat while the player is elsewhere.",
      reason: "This new world event independently advances the recorded threat."
    });
    const worldEventSequence = Number(listEvents(db, campaignId).at(-1)!.sequence);
    const worldComplicationReason = "The advancing surge creates one more mild obstacle without closing the quest.";
    await runPlayerAction(db, content, directorFor([
      {
        type: "manage_quest",
        questId: quest.questId,
        action: "apply_neglect_complication",
        objectiveId: null,
        outcomeId: null,
        consequenceEventSequences: [worldEventSequence],
        warningMethod: null,
        warningSignal: null,
        warningSourceNpcId: null,
        neglectTrigger: "recorded_world_event_advances_threat",
        neglectComplicationTool: "record_location_consequence",
        reason: worldComplicationReason
      },
      {
        type: "record_location_consequence",
        locationId: quest.locationIds[0]!,
        consequence: "Unstable debris narrows an approach but leaves several responses possible.",
        reason: worldComplicationReason
      }
    ]), "quest-neglect", "continue elsewhere while the recorded threat advances");
    const worldChanged = listQuestInstances(db, campaignId).find((candidate) => candidate.questId === quest.questId)!;
    assert.equal(worldChanged.neglectHistory.length, 2);
    assert.equal(worldChanged.state, "available");
    assert.equal(worldChanged.failureReason, null);
  } finally { db.close(); }
});
