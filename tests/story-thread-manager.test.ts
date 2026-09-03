import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { buildDirectorPlanningContext, buildPerspectiveContext } from "../src/application/context-builder.ts";
import { runPlayerAction } from "../src/application/turn-orchestrator.ts";
import type { CampaignDirector } from "../src/director/director.ts";
import type { DirectorPlanningContext, StoryThread } from "../src/domain/types.ts";
import { createCampaign, listEvents, listStoryThreads, openDatabase, persistStoryThread, restorePreviousTurn } from "../src/persistence/database.ts";

const projectRoot = resolve(import.meta.dirname, "..");

async function setup(name: string) {
  const content = await loadVelmoraContent(projectRoot);
  const root = mkdtempSync(join(tmpdir(), "velmora-thread-manager-"));
  const db = openDatabase(join(root, "save.sqlite"));
  const campaignId = createCampaign(db, content, name, `${name}-seed`);
  return { content, db, campaignId };
}

function directorFor(plan: CampaignDirector["planTurn"]): CampaignDirector {
  return {
    source: "diagnostic",
    preview: async () => ({ intent: "inspect", summary: "test", suggestedActions: ["A", "B"], allowsFreeText: true }),
    presentScene: async (_context, scene) => ({ sceneId: scene.id, title: "test", narration: "test", suggestedActions: ["A", "B"], source: "diagnostic" }),
    planTurn: plan
  };
}

test("Campaign Master can advance a thread atomically and rollback restores it", async () => {
  const { content, db, campaignId } = await setup("thread-advance");
  const director = directorFor(async () => ({
    summary: "The immediate rescue reveals a viable route through the plaza.",
    majorActionProposal: true,
    toolRequests: [{
      type: "manage_story_thread",
      threadId: "THREAD-OPENING-PRESSURE",
      action: "advance",
      summary: "The player opened a viable rescue route through the damaged plaza.",
      urgency: 2,
      recoveryPathUsed: null,
      replacement: null,
      reason: "The player's rescue materially advanced the opening crisis."
    }],
    suggestedActions: ["Lead survivors out", "Search for another route"],
    allowsFreeText: true
  }));
  try {
    await runPlayerAction(db, content, director, "thread-advance", "commit to the rescue route");
    const advanced = listStoryThreads(db, campaignId).find((thread) => thread.threadId === "THREAD-OPENING-PRESSURE")!;
    assert.equal(advanced.status, "active");
    assert.equal(advanced.urgency, 2);
    assert.equal(advanced.lastUsedTurn, 1);
    assert.match(advanced.summary, /viable rescue route/);
    assert.ok(listEvents(db, campaignId).some((event) => event.eventType === "story_thread_managed"));

    restorePreviousTurn(db, "thread-advance");
    const restored = listStoryThreads(db, campaignId).find((thread) => thread.threadId === "THREAD-OPENING-PRESSURE")!;
    assert.equal(restored.urgency, 3);
    assert.equal(restored.lastUsedTurn, null);
  } finally {
    db.close();
  }
});

test("replacement must follow a recorded recovery route and inherits secrecy and stage gates", async () => {
  const { content, db, campaignId } = await setup("thread-replace");
  const source = listStoryThreads(db, campaignId).find((thread) => thread.threadId === "THREAD-FIRST-SPEAKER-TRANSFORMATION")!;
  const director = directorFor(async () => ({
    summary: "The original lead closes, but a protected intervention route remains.",
    majorActionProposal: true,
    toolRequests: [{
      type: "manage_story_thread",
      threadId: source.threadId,
      action: "replace",
      summary: "The original intervention route is no longer viable.",
      urgency: 1,
      recoveryPathUsed: source.recoveryPaths[0]!,
      replacement: {
        threadId: "THREAD-SPEAKER-INTERVENTION-ALTERNATE",
        title: "A Different Way to Reach the Speaker",
        summary: "Changed evidence preserves another possible intervention without deciding its outcome.",
        kind: "mystery",
        urgency: 1,
        locationIds: [],
        factionIds: [],
        npcIds: ["NPC-FIRST-SPEAKER"],
        recoveryPaths: ["A later discovery may reopen contact through a different faction."]
      },
      reason: "Player choices invalidated the original route without resolving the hidden transformation."
    }],
    suggestedActions: ["Follow the changed evidence", "Observe the Speaker"],
    allowsFreeText: true
  }));
  try {
    await runPlayerAction(db, content, director, "thread-replace", "commit to the changed evidence");
    const threads = listStoryThreads(db, campaignId);
    assert.equal(threads.find((thread) => thread.threadId === source.threadId)?.status, "failed");
    const successor = threads.find((thread) => thread.threadId === "THREAD-SPEAKER-INTERVENTION-ALTERNATE")!;
    assert.equal(successor.status, "active");
    assert.equal(successor.visibility, source.visibility);
    assert.equal(successor.minimumStage, source.minimumStage);
    assert.equal(successor.maximumStage, source.maximumStage);
    assert.equal(JSON.stringify(buildPerspectiveContext(db, content, "thread-replace")).includes(successor.threadId), false);
    assert.equal(buildDirectorPlanningContext(db, content, "thread-replace").directorStoryThreads.some((thread) => thread.threadId === successor.threadId), true);
  } finally {
    db.close();
  }
});

test("premature threads cannot be managed and invalid recovery replacements do not mutate state", async () => {
  const { content, db, campaignId } = await setup("thread-guardrails");
  const reversal = listStoryThreads(db, campaignId).find((thread) => thread.threadId === "THREAD-CAMPAIGN-REVERSAL")!;
  const director = directorFor(async () => ({
    summary: "invalid",
    majorActionProposal: true,
    toolRequests: [{
      type: "manage_story_thread",
      threadId: reversal.threadId,
      action: "activate",
      summary: "The later reversal is forced into the opening.",
      urgency: 3,
      recoveryPathUsed: null,
      replacement: null,
      reason: "Invalid early activation test."
    }],
    suggestedActions: ["A", "B"],
    allowsFreeText: true
  }));
  try {
    await assert.rejects(() => runPlayerAction(db, content, director, "thread-guardrails", "commit invalid early reveal"), /outside its permitted campaign stage/);
    assert.equal(listStoryThreads(db, campaignId).find((thread) => thread.threadId === reversal.threadId)?.status, "dormant");
  } finally {
    db.close();
  }
});

test("growing long-campaign thread history stays bounded in planning context", async () => {
  const { content, db, campaignId } = await setup("thread-durability");
  const durable: StoryThread = {
    campaignId,
    threadId: "THREAD-DURABILITY-0",
    kind: "dynamic",
    title: "Durability Route",
    summary: "A synthetic route used to verify long-running continuity behavior.",
    status: "active",
    visibility: "director",
    minimumStage: "opening",
    maximumStage: "resolution",
    urgency: 1,
    locationIds: [],
    factionIds: [],
    npcIds: [],
    recoveryPaths: ["Follow the changed conditions without discarding the underlying problem."],
    createdTurn: 0,
    updatedTurn: 0,
    lastUsedTurn: null
  };
  persistStoryThread(db, durable);
  const director = directorFor(async (context: DirectorPlanningContext) => {
    const current = context.directorStoryThreads.find((thread) => thread.threadId.startsWith("THREAD-DURABILITY-"))!;
    const next = context.turn + 1;
    return {
      summary: `Synthetic continuity turn ${next}.`,
      majorActionProposal: true,
      toolRequests: [{
        type: "manage_story_thread",
        threadId: current.threadId,
        action: "replace",
        summary: `Route ${next - 1} closed after conditions changed.`,
        urgency: 1,
        recoveryPathUsed: current.recoveryPaths[0]!,
        replacement: {
          threadId: `THREAD-DURABILITY-${next}`,
          title: `Durability Route ${next}`,
          summary: `Replacement route ${next} preserves the same unresolved story problem.`,
          kind: "dynamic",
          urgency: 1,
          locationIds: [],
          factionIds: [],
          npcIds: [],
          recoveryPaths: ["Follow the changed conditions without discarding the underlying problem."]
        },
        reason: "Synthetic stress test replaces one route through its validated recovery path."
      }],
      suggestedActions: ["Continue", "Reconsider"],
      allowsFreeText: true
    };
  });
  try {
    for (let turn = 0; turn < 60; turn += 1) {
      await runPlayerAction(db, content, director, "thread-durability", "commit continuity stress step");
    }
    const all = listStoryThreads(db, campaignId).filter((thread) => thread.threadId.startsWith("THREAD-DURABILITY-"));
    const relevant = buildDirectorPlanningContext(db, content, "thread-durability").directorStoryThreads;
    assert.equal(all.length, 61);
    assert.equal(all.filter((thread) => thread.status === "active").length, 1);
    assert.ok(relevant.length <= 12);
    assert.equal(relevant.filter((thread) => thread.threadId.startsWith("THREAD-DURABILITY-")).length, 1);
  } finally {
    db.close();
  }
});
