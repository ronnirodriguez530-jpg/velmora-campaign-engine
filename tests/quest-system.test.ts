import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { buildDirectorPlanningContext, buildPerspectiveContext } from "../src/application/context-builder.ts";
import { activateQuest, completeQuest, createQuestInstance, failQuestRecoverably, makeQuestAvailable, type CreateQuestInput, updateQuestObjective } from "../src/application/quest-system.ts";
import { captureSnapshot, createCampaign, insertCheckpoint, listQuestInstances, openDatabase, restorePreviousTurn } from "../src/persistence/database.ts";

async function setup(name: string) {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), "velmora-quest-test-")), "test.sqlite"));
  const campaignId = createCampaign(db, content, name, "fixed-quest-seed");
  return { content, db, campaignId };
}

function openingQuest(overrides: Partial<CreateQuestInput> = {}): CreateQuestInput {
  return {
    questId: "QUEST-OPENING-RESPONSE",
    title: "Survive the Broken Address",
    summary: "Respond to the immediate Council Plaza crisis after the First Speaker falls.",
    questType: "main",
    state: "available",
    visibility: "player",
    sourceThreadId: "THREAD-OPENING-PRESSURE",
    minimumStage: "opening",
    maximumStage: "opening",
    issuerId: null,
    locationIds: ["LOC-COUNCIL-CROWN"],
    factionIds: [],
    npcIds: [],
    objectives: [
      { objectiveId: "OBJ-READ-THE-CRISIS", summary: "Determine the immediate danger in the plaza.", state: "pending", required: true, dependsOnObjectiveIds: [], branchGroupId: null },
      { objectiveId: "OBJ-CHOOSE-A-RESPONSE", summary: "Commit to a response that protects someone or something at risk.", state: "pending", required: true, dependsOnObjectiveIds: ["OBJ-READ-THE-CRISIS"], branchGroupId: null }
    ],
    stakes: "Lives, evidence, and the player's first relationships may change.",
    outcomes: [
      { outcomeId: "OUT-PROTECT-PEOPLE", summary: "Prioritize people endangered by the crisis.", consequenceSeeds: ["Survivors remember who intervened."] },
      { outcomeId: "OUT-PURSUE-CAUSE", summary: "Prioritize the source, evidence, or responsible actor.", consequenceSeeds: ["Immediate evidence is preserved while other needs worsen."] }
    ],
    failureMode: "recoverable",
    warningSignals: [],
    neglectTriggers: ["A recorded world event materially worsens the immediate crisis."],
    recoveryPaths: ["Survivors, changed conditions, or lost evidence create an altered route forward."],
    prerequisiteQuestIds: [],
    linkedQuestIds: [],
    recoveryOfQuestId: null,
    recoveryPathUsed: null,
    truthEvidenceIds: [],
    isTurningPoint: false,
    ...overrides
  };
}

test("creates a validated player quest from an existing main story thread", async () => {
  const { content, db, campaignId } = await setup("quest-create");
  try {
    const quest = createQuestInstance(db, content, campaignId, openingQuest());
    assert.equal(quest.outcomes.length, 2);
    assert.equal(quest.selectedOutcomeId, null);
    assert.equal(buildPerspectiveContext(db, content, "quest-create").playerQuests[0]?.questId, quest.questId);
    assert.equal(buildDirectorPlanningContext(db, content, "quest-create").directorQuests.length, 0);
  } finally { db.close(); }
});

test("direct quest creation cannot bypass the two-unresolved-quests-per-thread cap", async () => {
  const { content, db, campaignId } = await setup("quest-thread-cap");
  try {
    createQuestInstance(db, content, campaignId, openingQuest());
    createQuestInstance(db, content, campaignId, openingQuest({
      questId: "QUEST-OPENING-ALTERNATIVE",
      title: "Choose an Alternative Response"
    }));
    assert.throws(() => createQuestInstance(db, content, campaignId, openingQuest({
      questId: "QUEST-OPENING-EXCESS",
      title: "Create a Third Unresolved Route"
    })), /at most two simultaneous unresolved quests/);
    assert.equal(listQuestInstances(db, campaignId).length, 2);
  } finally { db.close(); }
});

test("rejects invented main plots, excess outcomes, and missing recovery routes", async () => {
  const { content, db, campaignId } = await setup("quest-reject");
  try {
    assert.throws(() => createQuestInstance(db, content, campaignId, openingQuest({
      questId: "QUEST-BAD-MAIN",
      sourceThreadId: "THREAD-FACTION-PRESSURE"
    })), /inherit its source thread visibility|main quest must originate/);
    assert.throws(() => createQuestInstance(db, content, campaignId, openingQuest({
      questId: "QUEST-TOO-MANY-OUTCOMES",
      outcomes: [...openingQuest().outcomes, { outcomeId: "OUT-THIRD", summary: "An unapproved third outcome.", consequenceSeeds: ["Too many branches."] }]
    })), /exactly 2 major outcomes/);
    assert.throws(() => createQuestInstance(db, content, campaignId, openingQuest({
      questId: "QUEST-NO-RECOVERY",
      recoveryPaths: []
    })), /requires at least one recovery path/);
    assert.throws(() => createQuestInstance(db, content, campaignId, openingQuest({
      questId: "QUEST-CYCLIC-OBJECTIVES",
      objectives: [
        { objectiveId: "OBJ-CYCLE-A", summary: "First side of an invalid cycle.", state: "pending", required: true, dependsOnObjectiveIds: ["OBJ-CYCLE-B"], branchGroupId: null },
        { objectiveId: "OBJ-CYCLE-B", summary: "Second side of an invalid cycle.", state: "pending", required: true, dependsOnObjectiveIds: ["OBJ-CYCLE-A"], branchGroupId: null }
      ]
    })), /cannot form a cycle/);
    assert.throws(() => createQuestInstance(db, content, campaignId, openingQuest({
      questId: "QUEST-LONE-BRANCH",
      objectives: [
        { objectiveId: "OBJ-LONE-BRANCH", summary: "An invalid branch without an alternative.", state: "pending", required: true, dependsOnObjectiveIds: [], branchGroupId: "BRANCH-LONE-ROUTE" }
      ]
    })), /requires at least two alternatives/);
    assert.throws(() => createQuestInstance(db, content, campaignId, openingQuest({
      questId: "QUEST-NO-REQUIRED-OBJECTIVE",
      objectives: [
        { objectiveId: "OBJ-OPTIONAL-ONLY", summary: "An optional objective cannot carry the entire quest.", state: "pending", required: false, dependsOnObjectiveIds: [], branchGroupId: null }
      ]
    })), /at least one required objective/);
  } finally { db.close(); }
});

test("advances objectives and completes through one selected major outcome", async () => {
  const { content, db, campaignId } = await setup("quest-lifecycle");
  try {
    createQuestInstance(db, content, campaignId, openingQuest());
    assert.equal(activateQuest(db, campaignId, "QUEST-OPENING-RESPONSE").objectives[0]?.state, "active");
    updateQuestObjective(db, campaignId, "QUEST-OPENING-RESPONSE", "OBJ-READ-THE-CRISIS", "completed");
    const ready = updateQuestObjective(db, campaignId, "QUEST-OPENING-RESPONSE", "OBJ-CHOOSE-A-RESPONSE", "completed");
    assert.equal(ready.objectives.every((objective) => objective.state === "completed"), true);
    const completed = completeQuest(db, campaignId, "QUEST-OPENING-RESPONSE", "OUT-PROTECT-PEOPLE");
    assert.equal(completed.state, "completed");
    assert.equal(completed.selectedOutcomeId, "OUT-PROTECT-PEOPLE");
    assert.throws(() => activateQuest(db, campaignId, completed.questId), /Only an available quest/);

    createQuestInstance(db, content, campaignId, openingQuest({
      questId: "QUEST-OPENING-AFTERMATH",
      title: "Face the Immediate Aftermath",
      state: "locked",
      prerequisiteQuestIds: [completed.questId]
    }));
    assert.equal(makeQuestAvailable(db, campaignId, "QUEST-OPENING-AFTERMATH").state, "available");
  } finally { db.close(); }
});

test("supports parallel, optional, and branching objectives without forcing one active step", async () => {
  const { content, db, campaignId } = await setup("quest-flexible-objectives");
  try {
    createQuestInstance(db, content, campaignId, openingQuest({
      questId: "QUEST-FLEXIBLE-OBJECTIVES",
      objectives: [
        { objectiveId: "OBJ-FLEX-FOUNDATION", summary: "Establish the pressure shaping the immediate choice.", state: "pending", required: true, dependsOnObjectiveIds: [], branchGroupId: null },
        { objectiveId: "OBJ-FLEX-OPTIONAL", summary: "Pursue an optional advantage before committing.", state: "pending", required: false, dependsOnObjectiveIds: [], branchGroupId: null },
        { objectiveId: "OBJ-FLEX-DIRECT", summary: "Take the direct branch through the pressure.", state: "pending", required: true, dependsOnObjectiveIds: ["OBJ-FLEX-FOUNDATION"], branchGroupId: "BRANCH-FLEX-ROUTE" },
        { objectiveId: "OBJ-FLEX-INDIRECT", summary: "Take the indirect branch through the pressure.", state: "pending", required: true, dependsOnObjectiveIds: ["OBJ-FLEX-FOUNDATION"], branchGroupId: "BRANCH-FLEX-ROUTE" }
      ]
    }));
    const active = activateQuest(db, campaignId, "QUEST-FLEXIBLE-OBJECTIVES");
    assert.deepEqual(active.objectives.map((objective) => objective.state), ["active", "active", "pending", "pending"]);
    const branched = updateQuestObjective(db, campaignId, active.questId, "OBJ-FLEX-FOUNDATION", "completed");
    assert.deepEqual(branched.objectives.map((objective) => objective.state), ["completed", "active", "active", "active"]);
    const selected = updateQuestObjective(db, campaignId, active.questId, "OBJ-FLEX-DIRECT", "completed");
    assert.equal(selected.objectives.find((objective) => objective.objectiveId === "OBJ-FLEX-INDIRECT")?.state, "skipped");
    const completed = completeQuest(db, campaignId, active.questId, "OUT-PROTECT-PEOPLE");
    assert.equal(completed.objectives.find((objective) => objective.objectiveId === "OBJ-FLEX-OPTIONAL")?.state, "skipped");
    assert.equal(completed.state, "completed");
  } finally { db.close(); }
});

test("keeps hidden faction quests private and rollback restores the complete quest ledger", async () => {
  const { content, db, campaignId } = await setup("quest-hidden-rollback");
  try {
    insertCheckpoint(db, campaignId, 0, 1, "pre_turn", captureSnapshot(db, campaignId));
    db.prepare("UPDATE campaigns SET turn = 1 WHERE id = ?").run(campaignId);
    const factionIds = buildDirectorPlanningContext(db, content, "quest-hidden-rollback").directorStoryThreads
      .find((thread) => thread.threadId === "THREAD-FACTION-PRESSURE")!.factionIds;
    createQuestInstance(db, content, campaignId, {
      ...openingQuest(),
      questId: "QUEST-HIDDEN-FACTION-PRESSURE",
      title: "Unseen Faction Pressure",
      questType: "faction",
      state: "locked",
      visibility: "director",
      sourceThreadId: "THREAD-FACTION-PRESSURE",
      maximumStage: "escalation",
      factionIds
    });
    assert.equal(buildPerspectiveContext(db, content, "quest-hidden-rollback").playerQuests.length, 0);
    assert.equal(buildDirectorPlanningContext(db, content, "quest-hidden-rollback").directorQuests.length, 1);
    restorePreviousTurn(db, "quest-hidden-rollback");
    assert.equal(listQuestInstances(db, campaignId).length, 0);
  } finally { db.close(); }
});

test("recoverable failure preserves recorded routes and blocks permanent failure authority", async () => {
  const { content, db, campaignId } = await setup("quest-failure");
  try {
    createQuestInstance(db, content, campaignId, openingQuest());
    activateQuest(db, campaignId, "QUEST-OPENING-RESPONSE");
    const failed = failQuestRecoverably(db, campaignId, "QUEST-OPENING-RESPONSE");
    assert.equal(failed.state, "failed");
    assert.equal(failed.recoveryPaths.length, 1);

    createQuestInstance(db, content, campaignId, openingQuest({
      questId: "QUEST-WARNED-DEADLINE",
      failureMode: "warned_deadline",
      warningSignals: ["The containment sirens give a final clear warning."],
      recoveryPaths: []
    }));
    activateQuest(db, campaignId, "QUEST-WARNED-DEADLINE");
    assert.throws(() => failQuestRecoverably(db, campaignId, "QUEST-WARNED-DEADLINE"), /requires future verified/);
  } finally { db.close(); }
});
