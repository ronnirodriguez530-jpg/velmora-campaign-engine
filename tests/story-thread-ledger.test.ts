import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { buildDirectorPlanningContext, buildPerspectiveContext } from "../src/application/context-builder.ts";
import type { StoryThread } from "../src/domain/types.ts";
import { createCampaign, getCampaign, listRelevantStoryThreads, openDatabase, persistStoryThread } from "../src/persistence/database.ts";

function thread(campaignId: string, overrides: Partial<StoryThread> = {}): StoryThread {
  return {
    campaignId,
    threadId: "THREAD-PLAZA-AFTERMATH",
    kind: "main",
    title: "The Plaza Aftermath",
    summary: "The player must respond to the immediate consequences of the attack.",
    status: "active",
    visibility: "player",
    origin: "witnessed_consequence",
    basisId: "LOC-COUNCIL-CROWN",
    minimumStage: "opening",
    maximumStage: "stabilization",
    urgency: 3,
    locationIds: ["LOC-COUNCIL-CROWN"],
    factionIds: [],
    npcIds: [],
    recoveryPaths: ["A surviving witness can redirect the investigation."],
    createdTurn: 0,
    updatedTurn: 0,
    lastUsedTurn: null,
    ...overrides
  };
}

test("story-thread ledger persists continuity and filters hidden or premature threads", async () => {
  const root = mkdtempSync(join(tmpdir(), "velmora-story-thread-"));
  const db = openDatabase(join(root, "save.sqlite"));
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const campaignId = createCampaign(db, content, "story-thread-test", "thread-seed");

  persistStoryThread(db, thread(campaignId));
  persistStoryThread(db, thread(campaignId, {
    threadId: "THREAD-HIDDEN-SPEAKER",
    title: "What Took Root",
    summary: "The Speaker's injury conceals a transformation.",
    visibility: "director"
  }));
  persistStoryThread(db, thread(campaignId, {
    threadId: "THREAD-RESOLUTION-ONLY",
    title: "Control of the Tear",
    summary: "A sustained takeover becomes possible only in Resolution.",
    visibility: "director",
    minimumStage: "resolution",
    maximumStage: "resolution"
  }));

  const campaign = getCampaign(db, "story-thread-test")!;
  const visible = listRelevantStoryThreads(db, campaignId, campaign.stage, campaign.currentLocationId, "player");
  const hidden = listRelevantStoryThreads(db, campaignId, campaign.stage, campaign.currentLocationId, "director");
  assert.equal(visible.some((item) => item.threadId === "THREAD-PLAZA-AFTERMATH"), true);
  assert.equal(hidden.some((item) => item.threadId === "THREAD-HIDDEN-SPEAKER"), true);
  assert.equal(hidden.some((item) => item.threadId === "THREAD-RESOLUTION-ONLY"), false);

  const context = buildPerspectiveContext(db, content, "story-thread-test");
  assert.equal(context.playerKnownStoryThreads.some((item) => item.threadId === "THREAD-PLAZA-AFTERMATH"), true);
  assert.equal(JSON.stringify(context).includes("THREAD-HIDDEN-SPEAKER"), false);
  assert.equal(JSON.stringify(context).includes("THREAD-RESOLUTION-ONLY"), false);
  const planningContext = buildDirectorPlanningContext(db, content, "story-thread-test");
  assert.equal(planningContext.directorStoryThreads.some((item) => item.threadId === "THREAD-HIDDEN-SPEAKER"), true);
  assert.equal(JSON.stringify(planningContext.directorStoryThreads).includes("THREAD-RESOLUTION-ONLY"), false);
  db.close();
});

test("story-thread stage ranges cannot run backward", async () => {
  const root = mkdtempSync(join(tmpdir(), "velmora-story-thread-stage-"));
  const db = openDatabase(join(root, "save.sqlite"));
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const campaignId = createCampaign(db, content, "story-thread-stage-test", "thread-stage-seed");
  assert.throws(() => persistStoryThread(db, thread(campaignId, {
    minimumStage: "resolution",
    maximumStage: "opening"
  })), /minimum stage/);
  db.close();
});

test("legacy story-thread snapshots receive safe provenance defaults", async () => {
  const root = mkdtempSync(join(tmpdir(), "velmora-story-thread-legacy-"));
  const db = openDatabase(join(root, "save.sqlite"));
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const campaignId = createCampaign(db, content, "story-thread-legacy-test", "thread-legacy-seed");
  const legacy = thread(campaignId) as Partial<StoryThread>;
  delete legacy.origin;
  delete legacy.basisId;
  persistStoryThread(db, legacy as StoryThread);
  const restored = listRelevantStoryThreads(db, campaignId, "opening", "LOC-COUNCIL-CROWN", "player")
    .find((item) => item.threadId === legacy.threadId)!;
  assert.equal(restored.origin, "blueprint");
  assert.equal(restored.basisId, null);
  db.close();
});
