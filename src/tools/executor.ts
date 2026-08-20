import type { DatabaseSync } from "node:sqlite";
import type { ToolRequest } from "../domain/types.ts";
import { appendEvent } from "../persistence/database.ts";

export function executeToolRequest(db: DatabaseSync, campaignId: string, turn: number, request: ToolRequest): void {
  if (request.type === "change_faction_condition") {
    db.prepare("UPDATE faction_state SET condition = condition + ? WHERE campaign_id = ? AND faction_id = ?")
      .run(request.delta, campaignId, request.factionId);
  } else if (request.type === "change_npc_reputation") {
    db.prepare("UPDATE character_state SET reputation = reputation + ? WHERE campaign_id = ? AND character_id = ?")
      .run(request.delta, campaignId, request.characterId);
  } else if (request.type === "move_player") {
    db.prepare("UPDATE campaigns SET current_location_id = ?, updated_at = ? WHERE id = ?")
      .run(request.locationId, new Date().toISOString(), campaignId);
  } else if (request.type === "advance_faction_path") {
    db.prepare("UPDATE faction_path_state SET progress = progress + 1 WHERE campaign_id = ? AND faction_id = ?")
      .run(campaignId, request.factionId);
  } else if (request.type === "record_location_consequence") {
    db.prepare(`INSERT OR IGNORE INTO location_state(campaign_id, location_id, consequence, created_turn)
      VALUES(?, ?, ?, ?)`).run(campaignId, request.locationId, request.consequence, turn);
  }
  appendEvent(db, campaignId, turn, "tool_applied", request);
}
