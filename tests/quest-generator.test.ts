import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { buildDirectorPlanningContext, buildPerspectiveContext } from "../src/application/context-builder.ts";
import { applyRecoveryQuest, composeQuestFromThread, composeRecoveryQuest, generateQuestFromThread } from "../src/application/quest-generator.ts";
import { activateQuest, completeQuest, failQuestRecoverably, makeQuestAvailable, updateQuestObjective } from "../src/application/quest-system.ts";
import { createCampaign, listQuestInstances, listStoryThreads, openDatabase, persistStoryThread } from "../src/persistence/database.ts";

async function setup(name: string, seed: string) {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), "velmora-quest-generator-test-")), "test.sqlite"));
  const campaignId = createCampaign(db, content, name, seed);
  return { content, db, campaignId };
}

test("the same campaign seed composes the same opening quest structure", async () => {
  const first = await setup("quest-seed-first", "repeatable-quest-seed");
  const second = await setup("quest-seed-second", "repeatable-quest-seed");
  try {
    const firstQuest = composeQuestFromThread(first.db, first.content, first.campaignId, "THREAD-OPENING-PRESSURE");
    const secondQuest = composeQuestFromThread(second.db, second.content, second.campaignId, "THREAD-OPENING-PRESSURE");
    assert.deepEqual(firstQuest, secondQuest);
    assert.equal(firstQuest.outcomes.length, 2);
    assert.equal(firstQuest.failureMode, "recoverable");
  } finally {
    first.db.close();
    second.db.close();
  }
});

test("different campaign seeds produce varied but valid opening quests", async () => {
  const signatures = new Set<string>();
  for (let index = 0; index < 24; index += 1) {
    const campaign = await setup(`quest-variety-${index}`, `quest-variety-seed-${index}`);
    try {
      const generated = generateQuestFromThread(campaign.db, campaign.content, campaign.campaignId, "THREAD-OPENING-PRESSURE");
      signatures.add(`${generated.title}|${generated.objectives[0]?.summary}`);
      assert.equal(generated.state, "available");
      assert.equal(generated.questType, "main");
      assert.equal(generated.visibility, "player");
      assert.equal(generated.outcomes.length, 2);
      assert.ok(generated.recoveryPaths.length > 0);
      assert.ok(generated.neglectTriggers.length > 0);
    } finally { campaign.db.close(); }
  }
  assert.ok(signatures.size >= 8, `Expected substantial quest variation, received ${signatures.size} structures`);
});

test("a thread permits one primary and one alternative unresolved quest, then enforces the hard cap", async () => {
  const { content, db, campaignId } = await setup("quest-sequence", "quest-sequence-seed");
  try {
    const first = generateQuestFromThread(db, content, campaignId, "THREAD-OPENING-PRESSURE");
    const alternative = generateQuestFromThread(db, content, campaignId, "THREAD-OPENING-PRESSURE");
    assert.notEqual(alternative.questId, first.questId);
    assert.equal(listQuestInstances(db, campaignId).filter((quest) => !["completed", "failed"].includes(quest.state)).length, 2);
    assert.throws(
      () => generateQuestFromThread(db, content, campaignId, "THREAD-OPENING-PRESSURE"),
      /already has two unresolved quests/
    );
    activateQuest(db, campaignId, first.questId);
    for (const objective of first.objectives) {
      updateQuestObjective(db, campaignId, first.questId, objective.objectiveId, "completed");
    }
    completeQuest(db, campaignId, first.questId, first.outcomes[0]!.outcomeId);

    const followUp = generateQuestFromThread(db, content, campaignId, "THREAD-OPENING-PRESSURE");
    assert.notEqual(followUp.questId, alternative.questId);
    assert.equal(listQuestInstances(db, campaignId).length, 3);
    assert.equal(listQuestInstances(db, campaignId).filter((quest) => !["completed", "failed"].includes(quest.state)).length, 2);
  } finally { db.close(); }
});

test("dormant threads cannot generate quests and activated hidden threads remain Director-only", async () => {
  const { content, db, campaignId } = await setup("quest-hidden-generation", "quest-hidden-seed");
  try {
    assert.throws(
      () => generateQuestFromThread(db, content, campaignId, "THREAD-FACTION-PRESSURE"),
      /only from active story threads/
    );
    const factionThread = listStoryThreads(db, campaignId).find((thread) => thread.threadId === "THREAD-FACTION-PRESSURE")!;
    persistStoryThread(db, { ...factionThread, status: "active" });
    const hidden = generateQuestFromThread(db, content, campaignId, factionThread.threadId);
    assert.equal(hidden.questType, "faction");
    assert.equal(hidden.state, "locked");
    assert.equal(hidden.visibility, "director");
    assert.equal(hidden.factionIds.length, 2);
    assert.equal(buildPerspectiveContext(db, content, "quest-hidden-generation").playerQuests.length, 0);
    assert.equal(buildDirectorPlanningContext(db, content, "quest-hidden-generation").directorQuests[0]?.questId, hidden.questId);
  } finally { db.close(); }
});

test("a failed quest creates one altered route without erasing the failure", async () => {
  const { content, db, campaignId } = await setup("quest-recovery", "quest-recovery-seed");
  try {
    const original = generateQuestFromThread(db, content, campaignId, "THREAD-OPENING-PRESSURE");
    assert.throws(
      () => composeRecoveryQuest(db, content, campaignId, original.questId, original.recoveryPaths[0]!),
      /recoverably failed quest/
    );
    activateQuest(db, campaignId, original.questId);
    failQuestRecoverably(db, campaignId, original.questId);
    const input = composeRecoveryQuest(db, content, campaignId, original.questId, original.recoveryPaths[0]!);
    assert.equal(input.recoveryOfQuestId, original.questId);
    assert.equal(input.recoveryPathUsed, original.recoveryPaths[0]);
    assert.deepEqual(input.linkedQuestIds, [original.questId]);
    assert.deepEqual(input.prerequisiteQuestIds, []);
    assert.equal(input.sourceThreadId, original.sourceThreadId);
    assert.equal(input.maximumStage, original.maximumStage);

    const recovery = applyRecoveryQuest(db, content, campaignId, original.questId, original.recoveryPaths[0]!, 0);
    assert.equal(recovery.state, "available");
    assert.equal(listQuestInstances(db, campaignId).find((quest) => quest.questId === original.questId)?.state, "failed");
    assert.throws(
      () => composeRecoveryQuest(db, content, campaignId, original.questId, original.recoveryPaths[0]!),
      /already has an altered recovery quest/
    );
  } finally { db.close(); }
});

test("hidden faction recovery preserves Director-only visibility", async () => {
  const { content, db, campaignId } = await setup("quest-hidden-recovery", "quest-hidden-recovery-seed");
  try {
    const factionThread = listStoryThreads(db, campaignId).find((thread) => thread.threadId === "THREAD-FACTION-PRESSURE")!;
    persistStoryThread(db, { ...factionThread, status: "active" });
    const original = generateQuestFromThread(db, content, campaignId, factionThread.threadId);
    makeQuestAvailable(db, campaignId, original.questId);
    activateQuest(db, campaignId, original.questId);
    failQuestRecoverably(db, campaignId, original.questId);
    const recovery = applyRecoveryQuest(db, content, campaignId, original.questId, original.recoveryPaths[0]!, 0);
    assert.equal(recovery.visibility, "director");
    assert.equal(recovery.state, "locked");
    assert.equal(JSON.stringify(buildPerspectiveContext(db, content, "quest-hidden-recovery")).includes(recovery.questId), false);
    assert.equal(buildDirectorPlanningContext(db, content, "quest-hidden-recovery").directorQuests.some((quest) => quest.questId === recovery.questId), true);
  } finally { db.close(); }
});
