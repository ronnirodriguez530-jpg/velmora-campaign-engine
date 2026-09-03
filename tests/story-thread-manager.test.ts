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

test("player-created goals become durable visible threads and rollback removes them", async () => {
  const { content, db, campaignId } = await setup("thread-create-goal");
  const director = directorFor(async () => ({
    summary: "The player promises to find the child separated from the evacuation line.",
    majorActionProposal: true,
    toolRequests: [{
      type: "create_story_thread",
      threadId: "THREAD-FIND-SEPARATED-CHILD",
      origin: "player_goal",
      basisId: "player_input",
      kind: "personal",
      title: "A Promise in the Plaza",
      summary: "The player promised to find a child separated from the Council Plaza evacuation line.",
      visibility: "player",
      maximumStage: "stabilization",
      urgency: 2,
      locationIds: ["LOC-COUNCIL-CROWN"],
      factionIds: [],
      npcIds: [],
      recoveryPaths: ["Another survivor can identify where the missing child was last seen."],
      reason: "The player explicitly accepted responsibility for an unresolved rescue."
    }],
    suggestedActions: ["Search the evacuation route", "Question nearby survivors"],
    allowsFreeText: true
  }));
  try {
    await runPlayerAction(db, content, director, "thread-create-goal", "I promise to find the missing child");
    const created = listStoryThreads(db, campaignId).find((thread) => thread.threadId === "THREAD-FIND-SEPARATED-CHILD")!;
    assert.equal(created.origin, "player_goal");
    assert.equal(created.basisId, "player_input");
    assert.equal(created.minimumStage, "opening");
    assert.equal(created.visibility, "player");
    assert.equal(buildPerspectiveContext(db, content, "thread-create-goal").playerKnownStoryThreads.some((thread) => thread.threadId === created.threadId), true);
    assert.ok(listEvents(db, campaignId).some((event) => event.eventType === "story_thread_created"));

    restorePreviousTurn(db, "thread-create-goal");
    assert.equal(listStoryThreads(db, campaignId).some((thread) => thread.threadId === created.threadId), false);
  } finally {
    db.close();
  }
});

test("unwitnessed faction developments stay hidden while retaining a concrete basis", async () => {
  const { content, db, campaignId } = await setup("thread-create-faction");
  const director = directorFor(async () => ({
    summary: "The player's public refusal gives the Order of Glass a reason to quietly reassess them.",
    majorActionProposal: true,
    toolRequests: [{
      type: "create_story_thread",
      threadId: "THREAD-GLASS-QUIET-REASSESSMENT",
      origin: "faction_development",
      basisId: "FAC-006",
      kind: "faction",
      title: "A Quiet Reassessment",
      summary: "The Order of Glass has an unresolved reason to reassess the player's usefulness after the public refusal.",
      visibility: "director",
      maximumStage: "stabilization",
      urgency: 1,
      locationIds: [],
      factionIds: ["FAC-006"],
      npcIds: [],
      recoveryPaths: ["A later public action can change how the Order interprets the refusal."],
      reason: "A witnessed player choice created a new unresolved faction response."
    }],
    suggestedActions: ["Return to the evacuation", "Watch the gallery"],
    allowsFreeText: true
  }));
  try {
    await runPlayerAction(db, content, director, "thread-create-faction", "publicly refuse the Order's request");
    const created = listStoryThreads(db, campaignId).find((thread) => thread.threadId === "THREAD-GLASS-QUIET-REASSESSMENT")!;
    assert.equal(created.origin, "faction_development");
    assert.equal(JSON.stringify(buildPerspectiveContext(db, content, "thread-create-faction")).includes(created.threadId), false);
    assert.equal(buildDirectorPlanningContext(db, content, "thread-create-faction").directorStoryThreads.some((thread) => thread.threadId === created.threadId), true);
  } finally {
    db.close();
  }
});

test("new threads cannot invent a main plot or an independent First Speaker arc", async () => {
  const { content, db, campaignId } = await setup("thread-create-guardrails");
  const invalidMain = directorFor(async () => ({
    summary: "invalid",
    majorActionProposal: true,
    toolRequests: [{
      type: "create_story_thread",
      threadId: "THREAD-UNSUPPORTED-MAIN",
      origin: "player_goal",
      basisId: "player_input",
      kind: "main" as "side",
      title: "An Unsupported Main Plot",
      summary: "This attempts to create a new main plot without protected campaign authority.",
      visibility: "player",
      maximumStage: "resolution",
      urgency: 3,
      locationIds: [],
      factionIds: [],
      npcIds: [],
      recoveryPaths: ["Return to an approved existing story thread."],
      reason: "Invalid main-thread creation test."
    }],
    suggestedActions: ["A", "B"],
    allowsFreeText: true
  }));
  const invalidSpeaker = directorFor(async () => ({
    summary: "invalid",
    majorActionProposal: true,
    toolRequests: [{
      type: "create_story_thread",
      threadId: "THREAD-INDEPENDENT-SPEAKER-ARC",
      origin: "npc_commitment",
      basisId: "NPC-FIRST-SPEAKER",
      kind: "personal",
      title: "An Unsupported Speaker Arc",
      summary: "This attempts to create a separate Speaker storyline outside protected structure.",
      visibility: "player",
      maximumStage: "resolution",
      urgency: 3,
      locationIds: ["LOC-COUNCIL-CROWN"],
      factionIds: [],
      npcIds: ["NPC-FIRST-SPEAKER"],
      recoveryPaths: ["Return to the protected transformation thread."],
      reason: "Invalid independent Speaker-thread creation test."
    }],
    suggestedActions: ["A", "B"],
    allowsFreeText: true
  }));
  try {
    await assert.rejects(() => runPlayerAction(db, content, invalidMain, "thread-create-guardrails", "commit invalid main"), /may not create a new main story thread/);
    await assert.rejects(() => runPlayerAction(db, content, invalidSpeaker, "thread-create-guardrails", "commit invalid speaker arc"), /must branch from the protected transformation thread/);
    assert.equal(listStoryThreads(db, campaignId).some((thread) => thread.threadId === "THREAD-UNSUPPORTED-MAIN" || thread.threadId === "THREAD-INDEPENDENT-SPEAKER-ARC"), false);
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
    origin: "existing_thread_branch",
    basisId: "THREAD-FACTION-PRESSURE",
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
