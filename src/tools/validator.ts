import type { ToolRequest, VelmoraContent } from "../domain/types.ts";
import { getCharacterReputation, getFactionCondition, getFactionPathProgress } from "../persistence/database.ts";
import type { DatabaseSync } from "node:sqlite";

export function validateToolRequest(db: DatabaseSync, content: VelmoraContent, campaignId: string, request: ToolRequest): void {
  if (request.reason.trim().length < 3) throw new Error("Tool request requires a meaningful reason");
  if ((request.type === "change_faction_condition" || request.type === "change_npc_reputation") && request.delta !== -1 && request.delta !== 1) {
    throw new Error("Tool request delta must be -1 or 1");
  }

  if (request.type === "change_faction_condition") {
    if (!content.factions.some((faction) => faction.id === request.factionId)) throw new Error(`Unknown faction ${request.factionId}`);
    const current = getFactionCondition(db, campaignId, request.factionId);
    if (current === undefined) throw new Error(`Missing faction state ${request.factionId}`);
    const next = current + request.delta;
    if (next < 0 || next > 4) throw new Error(`Faction condition would exceed 0-4 for ${request.factionId}`);
    return;
  }

  if (request.type === "move_player") {
    const campaign = db.prepare("SELECT current_location_id AS currentLocationId FROM campaigns WHERE id = ?")
      .get(campaignId) as { currentLocationId: string } | undefined;
    if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
    const current = content.locations.find((location) => location.id === campaign.currentLocationId);
    if (!current) throw new Error(`Unknown current location ${campaign.currentLocationId}`);
    if (!current.connections.includes(request.locationId)) throw new Error(`Location ${request.locationId} is not directly connected to ${current.id}`);
    return;
  }

  if (request.type === "advance_faction_path") {
    if (!content.factions.some((faction) => faction.id === request.factionId)) throw new Error(`Unknown faction ${request.factionId}`);
    const progress = getFactionPathProgress(db, campaignId, request.factionId);
    if (progress === undefined) throw new Error(`Missing faction path ${request.factionId}`);
    if (progress >= 3) throw new Error(`Faction path is already complete for ${request.factionId}`);
    return;
  }

  if (request.type === "record_location_consequence") {
    const campaign = getCampaignById(db, campaignId);
    if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
    if (request.locationId !== campaign.currentLocationId) throw new Error("Consequences may only be recorded at the player's current location");
    if (request.consequence.trim().length < 3 || request.consequence.length > 240) throw new Error("Location consequence must be 3-240 characters");
    return;
  }

  if (request.type === "request_minor_npc") {
    const campaign = getCampaignById(db, campaignId);
    if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
    if (request.locationId !== campaign.currentLocationId) {
      throw new Error("Minor NPCs may only be requested for the player's current location");
    }
    if (request.factionId !== null && !content.factions.some((faction) => faction.id === request.factionId)) {
      throw new Error(`Unknown NPC faction ${request.factionId}`);
    }
    if (request.role.trim().length < 3 || request.role.length > 80) {
      throw new Error("Minor NPC role must be 3-80 characters");
    }
    if (!(["active", "known", "background"] as const).includes(request.category)) {
      throw new Error(`Unknown NPC category ${request.category}`);
    }
    return;
  }

  if (request.type !== "change_npc_reputation") throw new Error("Unknown tool request type");
  if (!content.characters.some((character) => character.id === request.characterId)) throw new Error(`Unknown character ${request.characterId}`);
  const current = getCharacterReputation(db, campaignId, request.characterId);
  if (current === undefined) throw new Error(`Missing character state ${request.characterId}`);
  const next = current + request.delta;
  if (next < -2 || next > 2) throw new Error(`NPC reputation would exceed -2 to 2 for ${request.characterId}`);
}

function getCampaignById(db: DatabaseSync, campaignId: string): { currentLocationId: string } | undefined {
  return db.prepare("SELECT current_location_id AS currentLocationId FROM campaigns WHERE id = ?")
    .get(campaignId) as { currentLocationId: string } | undefined;
}
