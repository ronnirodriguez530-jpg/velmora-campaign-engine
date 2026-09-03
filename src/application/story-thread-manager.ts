import type { DatabaseSync } from "node:sqlite";
import type { CampaignStage, ManageStoryThreadRequest, StoryThread, VelmoraContent } from "../domain/types.ts";
import { appendEvent, listStoryThreads, persistStoryThread } from "../persistence/database.ts";

const STAGE_ORDER: Record<CampaignStage, number> = {
  opening: 0,
  stabilization: 1,
  escalation: 2,
  resolution: 3
};

function getThread(db: DatabaseSync, campaignId: string, threadId: string): StoryThread | undefined {
  return listStoryThreads(db, campaignId).find((thread) => thread.threadId === threadId);
}

function requireText(value: string, label: string, max: number): void {
  const length = value.trim().length;
  if (length < 3 || length > max) throw new Error(`${label} must be 3-${max} characters`);
}

export function validateStoryThreadUpdate(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  request: ManageStoryThreadRequest
): void {
  const campaign = db.prepare("SELECT stage FROM campaigns WHERE id = ?").get(campaignId) as { stage: CampaignStage } | undefined;
  if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
  const thread = getThread(db, campaignId, request.threadId);
  if (!thread) throw new Error(`Unknown story thread ${request.threadId}`);
  requireText(request.summary, "Story thread summary", 600);
  if (!Number.isInteger(request.urgency) || request.urgency < 0 || request.urgency > 3) {
    throw new Error("Story thread urgency must be an integer from 0 to 3");
  }
  if (STAGE_ORDER[campaign.stage] < STAGE_ORDER[thread.minimumStage] || STAGE_ORDER[campaign.stage] > STAGE_ORDER[thread.maximumStage]) {
    throw new Error(`Story thread ${thread.threadId} is outside its permitted campaign stage`);
  }
  if (thread.status === "resolved") throw new Error(`Resolved story thread ${thread.threadId} is immutable`);
  if (thread.status === "failed" && request.action !== "replace") {
    throw new Error(`Failed story thread ${thread.threadId} may only be replaced`);
  }

  const allowed: Record<StoryThread["status"], ManageStoryThreadRequest["action"][]> = {
    dormant: ["activate", "replace"],
    active: ["advance", "block", "resolve", "fail", "replace"],
    blocked: ["activate", "fail", "replace"],
    resolved: [],
    failed: ["replace"]
  };
  if (!allowed[thread.status].includes(request.action)) {
    throw new Error(`Cannot ${request.action} a ${thread.status} story thread`);
  }

  if (request.action === "block" && thread.recoveryPaths.length === 0) {
    throw new Error("A blocked story thread requires at least one recovery path");
  }
  if (request.action === "replace") {
    if (!request.replacement) throw new Error("Replacing a story thread requires a successor");
    if (!request.recoveryPathUsed || !thread.recoveryPaths.includes(request.recoveryPathUsed)) {
      throw new Error("Story thread replacement must use one of the source thread's recovery paths");
    }
    if (getThread(db, campaignId, request.replacement.threadId)) {
      throw new Error(`Replacement story thread ${request.replacement.threadId} already exists`);
    }
    requireText(request.replacement.title, "Replacement story thread title", 120);
    requireText(request.replacement.summary, "Replacement story thread summary", 600);
    for (const locationId of request.replacement.locationIds) {
      if (!content.locations.some((location) => location.id === locationId)) throw new Error(`Unknown story thread location ${locationId}`);
    }
    for (const factionId of request.replacement.factionIds) {
      if (!content.factions.some((faction) => faction.id === factionId)) throw new Error(`Unknown story thread faction ${factionId}`);
    }
    for (const npcId of request.replacement.npcIds) {
      const generated = db.prepare("SELECT 1 FROM npc_records WHERE campaign_id = ? AND npc_id = ?").get(campaignId, npcId);
      const authored = content.characters.some((character) => character.id === npcId);
      if (!generated && !authored) throw new Error(`Unknown story thread NPC ${npcId}`);
    }
    if (request.replacement.recoveryPaths.some((path) => path.trim().length < 3 || path.length > 240)) {
      throw new Error("Replacement recovery paths must be 3-240 characters");
    }
  } else {
    if (request.replacement !== null) throw new Error("Only replace actions may include a successor story thread");
    if (request.recoveryPathUsed !== null) throw new Error("Only replace actions may consume a recovery path");
  }
}

export function applyStoryThreadUpdate(
  db: DatabaseSync,
  campaignId: string,
  turn: number,
  request: ManageStoryThreadRequest
): void {
  const thread = getThread(db, campaignId, request.threadId);
  if (!thread) throw new Error(`Unknown story thread ${request.threadId}`);
  const statusByAction: Record<Exclude<ManageStoryThreadRequest["action"], "replace">, StoryThread["status"]> = {
    activate: "active",
    advance: "active",
    block: "blocked",
    resolve: "resolved",
    fail: "failed"
  };
  const nextStatus = request.action === "replace" ? "failed" : statusByAction[request.action];
  persistStoryThread(db, {
    ...thread,
    summary: request.summary.trim(),
    status: nextStatus,
    urgency: request.urgency,
    updatedTurn: turn,
    lastUsedTurn: turn
  });

  let replacementId: string | null = null;
  if (request.action === "replace" && request.replacement) {
    replacementId = request.replacement.threadId;
    persistStoryThread(db, {
      campaignId,
      threadId: request.replacement.threadId,
      kind: request.replacement.kind,
      title: request.replacement.title.trim(),
      summary: request.replacement.summary.trim(),
      status: "active",
      visibility: thread.visibility,
      minimumStage: thread.minimumStage,
      maximumStage: thread.maximumStage,
      urgency: request.replacement.urgency,
      locationIds: [...new Set(request.replacement.locationIds)],
      factionIds: [...new Set(request.replacement.factionIds)],
      npcIds: [...new Set(request.replacement.npcIds)],
      recoveryPaths: [...new Set(request.replacement.recoveryPaths.map((path) => path.trim()))],
      createdTurn: turn,
      updatedTurn: turn,
      lastUsedTurn: turn
    });
  }

  appendEvent(db, campaignId, turn, "story_thread_managed", {
    threadId: thread.threadId,
    previousStatus: thread.status,
    action: request.action,
    nextStatus,
    replacementId,
    recoveryPathUsed: request.recoveryPathUsed,
    reason: request.reason.trim()
  });
}
