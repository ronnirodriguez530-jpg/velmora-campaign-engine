import type { DatabaseSync } from "node:sqlite";
import type { CampaignStage, CreateStoryThreadRequest, ManageStoryThreadRequest, StoryThread, VelmoraContent } from "../domain/types.ts";
import { appendEvent, listStoryThreads, persistStoryThread } from "../persistence/database.ts";

const STAGE_ORDER: Record<CampaignStage, number> = {
  opening: 0,
  stabilization: 1,
  escalation: 2,
  resolution: 3
};
const CREATABLE_ORIGINS = new Set<CreateStoryThreadRequest["origin"]>([
  "player_goal",
  "witnessed_consequence",
  "existing_thread_branch",
  "faction_development",
  "npc_commitment"
]);
const CREATABLE_KINDS = new Set<CreateStoryThreadRequest["kind"]>(["faction", "side", "personal", "mystery", "dynamic"]);
const PLAYER_THREAD_KINDS = new Set<CreateStoryThreadRequest["kind"]>(["personal", "side", "dynamic"]);
const FACTION_THREAD_KINDS = new Set<CreateStoryThreadRequest["kind"]>(["faction", "dynamic"]);

function getThread(db: DatabaseSync, campaignId: string, threadId: string): StoryThread | undefined {
  return listStoryThreads(db, campaignId).find((thread) => thread.threadId === threadId);
}

function requireText(value: string, label: string, max: number): void {
  const length = value.trim().length;
  if (length < 3 || length > max) throw new Error(`${label} must be 3-${max} characters`);
}

function characterExists(db: DatabaseSync, content: VelmoraContent, campaignId: string, characterId: string): boolean {
  if (content.characters.some((character) => character.id === characterId)) return true;
  return Boolean(db.prepare("SELECT 1 FROM npc_records WHERE campaign_id = ? AND npc_id = ?").get(campaignId, characterId));
}

function characterAtLocation(db: DatabaseSync, content: VelmoraContent, campaignId: string, characterId: string, locationId: string): boolean {
  if (content.characters.some((character) => character.id === characterId)) {
    const state = db.prepare("SELECT location_id AS locationId FROM character_state WHERE campaign_id = ? AND character_id = ?")
      .get(campaignId, characterId) as { locationId: string | null } | undefined;
    return state?.locationId === locationId;
  }
  const record = db.prepare("SELECT location_id AS locationId FROM npc_records WHERE campaign_id = ? AND npc_id = ?")
    .get(campaignId, characterId) as { locationId: string | null } | undefined;
  return record?.locationId === locationId;
}

function validateThreadLinks(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  links: Pick<CreateStoryThreadRequest, "locationIds" | "factionIds" | "npcIds" | "recoveryPaths">
): void {
  if (links.locationIds.length > 8 || links.factionIds.length > 6 || links.npcIds.length > 8 || links.recoveryPaths.length > 4) {
    throw new Error("Story thread link or recovery-path limit exceeded");
  }
  for (const locationId of links.locationIds) {
    if (!content.locations.some((location) => location.id === locationId)) throw new Error(`Unknown story thread location ${locationId}`);
  }
  for (const factionId of links.factionIds) {
    if (!content.factions.some((faction) => faction.id === factionId)) throw new Error(`Unknown story thread faction ${factionId}`);
  }
  for (const npcId of links.npcIds) {
    if (!characterExists(db, content, campaignId, npcId)) throw new Error(`Unknown story thread NPC ${npcId}`);
  }
  if (links.recoveryPaths.some((path) => path.trim().length < 3 || path.length > 240)) {
    throw new Error("Story thread recovery paths must be 3-240 characters");
  }
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
    validateThreadLinks(db, content, campaignId, request.replacement);
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
      origin: "existing_thread_branch",
      basisId: thread.threadId,
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

export function validateStoryThreadCreation(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  request: CreateStoryThreadRequest
): void {
  const campaign = db.prepare("SELECT stage, current_location_id AS currentLocationId FROM campaigns WHERE id = ?")
    .get(campaignId) as { stage: CampaignStage; currentLocationId: string } | undefined;
  if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
  if (!/^THREAD-[A-Z0-9][A-Z0-9-]{2,95}$/.test(request.threadId)) {
    throw new Error("Created story thread ID must be a stable uppercase THREAD- identifier");
  }
  if (getThread(db, campaignId, request.threadId)) throw new Error(`Story thread ${request.threadId} already exists`);
  requireText(request.title, "Story thread title", 120);
  requireText(request.summary, "Story thread summary", 600);
  requireText(request.reason, "Story thread creation reason", 300);
  if (!CREATABLE_ORIGINS.has(request.origin)) {
    throw new Error(`Unsupported story thread origin ${request.origin}`);
  }
  if (!CREATABLE_KINDS.has(request.kind)) {
    throw new Error("Campaign Master may not create a new main story thread during play");
  }
  if (request.visibility !== "player" && request.visibility !== "director") throw new Error(`Unknown story thread visibility ${request.visibility}`);
  if (!Object.hasOwn(STAGE_ORDER, request.maximumStage)) throw new Error(`Unknown story thread maximum stage ${request.maximumStage}`);
  if (!request.basisId.trim()) throw new Error("Created story threads require an explicit basis");
  if (!Number.isInteger(request.urgency) || request.urgency < 0 || request.urgency > 3) {
    throw new Error("Story thread urgency must be an integer from 0 to 3");
  }
  if (STAGE_ORDER[request.maximumStage] < STAGE_ORDER[campaign.stage]) {
    throw new Error("Created story thread maximum stage cannot precede the current campaign stage");
  }
  if (request.recoveryPaths.length === 0) throw new Error("Created story threads require at least one recovery path");
  validateThreadLinks(db, content, campaignId, request);
  const unresolvedCreated = listStoryThreads(db, campaignId)
    .filter((thread) => thread.origin !== "blueprint" && thread.status !== "resolved" && thread.status !== "failed");
  if (unresolvedCreated.length >= 48) throw new Error("Campaign has reached its unresolved generated-thread limit; resolve or replace existing work first");
  if (unresolvedCreated.filter((thread) => thread.visibility === request.visibility).length >= 24) {
    throw new Error(`Campaign has reached its unresolved ${request.visibility} thread limit`);
  }

  if (request.npcIds.includes("NPC-FIRST-SPEAKER") && !(request.origin === "existing_thread_branch" && request.basisId === "THREAD-FIRST-SPEAKER-TRANSFORMATION")) {
    throw new Error("New First Speaker threads must branch from the protected transformation thread");
  }

  if (request.origin === "player_goal") {
    if (request.basisId !== "player_input") throw new Error("Player-goal threads must use the current player input as their basis");
    if (request.visibility !== "player" || !PLAYER_THREAD_KINDS.has(request.kind)) {
      throw new Error("Player goals must remain player-visible personal, side, or dynamic threads");
    }
  } else if (request.origin === "witnessed_consequence") {
    if (request.basisId !== campaign.currentLocationId || !request.locationIds.includes(campaign.currentLocationId)) {
      throw new Error("Witnessed consequences must be based at and linked to the current location");
    }
    if (request.visibility !== "player") throw new Error("Witnessed consequences must remain player-visible");
  } else if (request.origin === "existing_thread_branch") {
    const source = getThread(db, campaignId, request.basisId);
    if (!source) throw new Error(`Unknown source story thread ${request.basisId}`);
    if (source.status === "resolved" || source.status === "failed") throw new Error("New branches require an unresolved source story thread");
    if (STAGE_ORDER[campaign.stage] < STAGE_ORDER[source.minimumStage] || STAGE_ORDER[campaign.stage] > STAGE_ORDER[source.maximumStage]) {
      throw new Error("Source story thread is outside its permitted campaign stage");
    }
    if (source.locationIds.length > 0 && !source.locationIds.includes(campaign.currentLocationId)) {
      throw new Error("Source story thread is not relevant at the current location");
    }
    if (request.visibility !== source.visibility) throw new Error("Story thread branches must inherit source visibility");
    if (STAGE_ORDER[request.maximumStage] > STAGE_ORDER[source.maximumStage]) {
      throw new Error("Story thread branches cannot extend beyond the source thread's stage gate");
    }
  } else if (request.origin === "faction_development") {
    if (!content.factions.some((faction) => faction.id === request.basisId) || !request.factionIds.includes(request.basisId)) {
      throw new Error("Faction developments must cite and link their existing faction");
    }
    if (request.visibility !== "director" || !FACTION_THREAD_KINDS.has(request.kind)) {
      throw new Error("Unwitnessed faction developments must remain Director-only faction or dynamic threads");
    }
  } else if (request.origin === "npc_commitment") {
    if (!characterExists(db, content, campaignId, request.basisId) || !request.npcIds.includes(request.basisId)) {
      throw new Error("NPC commitments must cite and link their existing NPC");
    }
    if (!characterAtLocation(db, content, campaignId, request.basisId, campaign.currentLocationId)) {
      throw new Error("NPC commitments may only be created for an NPC present in the current scene location");
    }
    if (request.visibility !== "player" || !PLAYER_THREAD_KINDS.has(request.kind)) {
      throw new Error("NPC commitments must remain player-visible personal, side, or dynamic threads");
    }
  }
}

export function applyStoryThreadCreation(
  db: DatabaseSync,
  campaignId: string,
  turn: number,
  request: CreateStoryThreadRequest
): void {
  const campaign = db.prepare("SELECT stage FROM campaigns WHERE id = ?").get(campaignId) as { stage: CampaignStage } | undefined;
  if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
  const thread: StoryThread = {
    campaignId,
    threadId: request.threadId,
    kind: request.kind,
    title: request.title.trim(),
    summary: request.summary.trim(),
    status: "active",
    visibility: request.visibility,
    origin: request.origin,
    basisId: request.basisId,
    minimumStage: campaign.stage,
    maximumStage: request.maximumStage,
    urgency: request.urgency,
    locationIds: [...new Set(request.locationIds)],
    factionIds: [...new Set(request.factionIds)],
    npcIds: [...new Set(request.npcIds)],
    recoveryPaths: [...new Set(request.recoveryPaths.map((path) => path.trim()))],
    createdTurn: turn,
    updatedTurn: turn,
    lastUsedTurn: turn
  };
  persistStoryThread(db, thread);
  appendEvent(db, campaignId, turn, "story_thread_created", {
    threadId: thread.threadId,
    origin: thread.origin,
    basisId: thread.basisId,
    visibility: thread.visibility,
    reason: request.reason.trim()
  });
}
