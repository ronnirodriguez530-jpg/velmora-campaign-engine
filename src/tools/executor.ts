import type { DatabaseSync } from "node:sqlite";
import type { ToolRequest } from "../domain/types.ts";
import type { VelmoraContent } from "../domain/types.ts";
import { appendEvent } from "../persistence/database.ts";
import { generateNpcOnDemand } from "../npc/npc-generator.ts";
import { loadNpcReferenceLibrary } from "../npc/npc-reference-library.ts";
import { resolve } from "node:path";
import { applyNpcTurnUpdate } from "../npc/npc-turn-manager.ts";
import { applyStoryThreadUpdate } from "../application/story-thread-manager.ts";

export async function executeToolRequest(db: DatabaseSync, content: VelmoraContent, campaignId: string, turn: number, request: ToolRequest): Promise<void> {
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
  } else if (request.type === "request_minor_npc") {
    const campaign = db.prepare("SELECT seed FROM campaigns WHERE id = ?").get(campaignId) as { seed: string } | undefined;
    if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
    const projectRoot = resolve(import.meta.dirname, "../..");
    const library = await loadNpcReferenceLibrary(projectRoot);
    await generateNpcOnDemand(db, projectRoot, content, library, {
      campaignId,
      campaignSeed: campaign.seed,
      reason: request.reason,
      role: request.role,
      factionId: request.factionId,
      locationId: request.locationId,
      category: request.category,
      turn
    });
  } else if (request.type === "manage_npc_turn") {
    applyNpcTurnUpdate(db, campaignId, turn, request);
  } else if (request.type === "manage_story_thread") {
    applyStoryThreadUpdate(db, campaignId, turn, request);
  }
  appendEvent(db, campaignId, turn, "tool_applied", request);
}
