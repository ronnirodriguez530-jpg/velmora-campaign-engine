import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { ManageNpcTurnRequest, NpcStatus, RelationshipStanding, VelmoraContent } from "../domain/types.ts";
import {
  appendEvent,
  changeNpcLifecycle,
  getNpc,
  getNpcKnowledge,
  getNpcRelationship,
  getWorldFact,
  recordNpcMemory,
  reclassifyNpc,
  teachNpcFact,
  updateNpcRelationship
} from "../persistence/database.ts";

const STANDINGS: RelationshipStanding[] = ["hostile", "unfriendly", "neutral", "friendly", "loyal"];
const ALLOWED_TURN_STATUSES = new Set<Exclude<NpcStatus, "dead">>([
  "available",
  "injured",
  "missing",
  "detained",
  "unavailable",
  "departed"
]);

function currentCampaignLocation(db: DatabaseSync, campaignId: string): string {
  const campaign = db.prepare("SELECT current_location_id AS locationId FROM campaigns WHERE id = ?")
    .get(campaignId) as { locationId: string } | undefined;
  if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
  return campaign.locationId;
}

export function validateNpcTurnUpdate(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  request: ManageNpcTurnRequest
): void {
  const npc = getNpc(db, campaignId, request.npcId);
  if (!npc) throw new Error(`Unknown managed NPC ${request.npcId}`);
  if (npc.lifecycleState !== "current") throw new Error(`Archived NPC ${request.npcId} cannot receive ordinary turn updates`);
  const currentLocationId = currentCampaignLocation(db, campaignId);
  if (npc.locationId !== currentLocationId) throw new Error(`NPC ${request.npcId} is outside the current scene location`);
  if (!request.reason.trim()) throw new Error("NPC turn updates require a reason");
  if (request.involvement !== "continues" && request.involvement !== "ends") {
    throw new Error("NPC involvement must continue or end");
  }

  if (request.memory) {
    if (request.memory.summary.trim().length < 3 || request.memory.summary.length > 240) {
      throw new Error("NPC memory summary must be 3-240 characters");
    }
    if (request.memory.emotionalImpact.trim().length < 2 || request.memory.emotionalImpact.length > 80) {
      throw new Error("NPC emotional impact must be 2-80 characters");
    }
    if (![1, 2, 3].includes(request.memory.importance)) throw new Error("NPC memory importance must be 1-3");
  }

  if (request.playerRelationship) {
    const current = getNpcRelationship(db, campaignId, request.npcId, "player", "player")?.standing ?? "neutral";
    if (Math.abs(STANDINGS.indexOf(request.playerRelationship.standing) - STANDINGS.indexOf(current)) > 1) {
      throw new Error("NPC standing may change by at most one step per turn");
    }
    if (request.playerRelationship.addQualities.length + request.playerRelationship.removeQualities.length > 2) {
      throw new Error("At most two relationship-quality changes are allowed per NPC turn");
    }
    if (!request.playerRelationship.reason.trim()) throw new Error("NPC relationship changes require a reason");
  }

  if (request.learnedFact) {
    const fact = getWorldFact(db, campaignId, request.learnedFact.factId);
    if (!fact) throw new Error(`NPC cannot learn unknown fact ${request.learnedFact.factId}`);
    const alreadyKnown = getNpcKnowledge(db, campaignId, request.npcId, request.learnedFact.factId);
    if (fact.visibility !== "public" && !alreadyKnown) {
      throw new Error("Restricted or secret facts require a future validated reveal event");
    }
    if (!Number.isInteger(request.learnedFact.confidence) || request.learnedFact.confidence < 0 || request.learnedFact.confidence > 100) {
      throw new Error("NPC fact confidence must be an integer from 0 to 100");
    }
  }

  if (request.status && !ALLOWED_TURN_STATUSES.has(request.status)) {
    throw new Error(`NPC status ${request.status} is not allowed through ordinary turn management`);
  }
  if ((request.status === "missing" || request.status === "departed") && request.newLocationId !== null) {
    throw new Error("Missing or departed NPCs cannot also receive a destination");
  }
  if (request.newLocationId) {
    const currentLocation = content.locations.find((location) => location.id === currentLocationId);
    if (!currentLocation) throw new Error(`Unknown current location ${currentLocationId}`);
    if (request.newLocationId !== currentLocationId && !currentLocation.connections.includes(request.newLocationId)) {
      throw new Error("NPC movement must remain at or directly connect to the current scene location");
    }
  }
}

export function applyNpcTurnUpdate(
  db: DatabaseSync,
  campaignId: string,
  turn: number,
  request: ManageNpcTurnRequest
): void {
  if (request.memory) {
    const memoryId = `MEM-${createHash("sha256")
      .update(`${campaignId}|${request.npcId}|${turn}|${request.memory.summary}`)
      .digest("hex").slice(0, 16).toUpperCase()}`;
    recordNpcMemory(db, {
      campaignId,
      npcId: request.npcId,
      memoryId,
      summary: request.memory.summary,
      emotionalImpact: request.memory.emotionalImpact,
      importance: request.memory.importance,
      unresolved: request.memory.unresolved,
      createdTurn: turn
    });
  }
  if (request.playerRelationship) {
    updateNpcRelationship(db, {
      campaignId,
      sourceNpcId: request.npcId,
      targetType: "player",
      targetId: "player",
      standing: request.playerRelationship.standing,
      addQualities: request.playerRelationship.addQualities,
      removeQualities: request.playerRelationship.removeQualities,
      reason: request.playerRelationship.reason,
      turn
    });
  }
  if (request.learnedFact) {
    teachNpcFact(db, {
      campaignId,
      npcId: request.npcId,
      factId: request.learnedFact.factId,
      method: request.learnedFact.method,
      confidence: request.learnedFact.confidence,
      believedState: request.learnedFact.believedState,
      learnedTurn: turn
    });
  }
  if (request.status) {
    changeNpcLifecycle(db, {
      campaignId,
      npcId: request.npcId,
      status: request.status,
      locationId: request.newLocationId,
      reason: request.reason,
      turn
    });
  } else if (request.newLocationId) {
    db.prepare(`UPDATE npc_records SET location_id = ?, last_relevant_turn = ?, updated_at = ?
      WHERE campaign_id = ? AND npc_id = ?`)
      .run(request.newLocationId, turn, new Date().toISOString(), campaignId, request.npcId);
    appendEvent(db, campaignId, turn, "npc_moved", {
      npcId: request.npcId,
      locationId: request.newLocationId,
      reason: request.reason
    });
  }

  const updated = getNpc(db, campaignId, request.npcId);
  if (updated?.lifecycleState === "current") {
    reclassifyNpc(
      db,
      campaignId,
      request.npcId,
      request.involvement === "continues" ? "active" : "known",
      turn,
      request.involvement === "continues" ? "NPC remains involved in the current thread" : "NPC involvement ended"
    );
  }
  appendEvent(db, campaignId, turn, "npc_turn_managed", {
    npcId: request.npcId,
    involvement: request.involvement,
    reason: request.reason
  });
}
