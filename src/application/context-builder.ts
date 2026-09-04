import type { DatabaseSync } from "node:sqlite";
import type { DirectorPlanningContext, PerspectiveContext, VelmoraContent } from "../domain/types.ts";
import { getCampaign, getCampaignBlueprint, getPlayerCharacter, getPlayerProgression, getSceneForTurnAndLocation, listCharactersAtLocation, listFactionConditions, listFactionPathProgress, listLocationConsequences, listPresentCharacterStates, listPublicWorldFacts, listRecentTearArrivals, listRelevantQuestInstances, listRelevantStoryThreads } from "../persistence/database.ts";
import { buildNpcContext } from "../npc/npc-context-gate.ts";
import { listOwnedPlayerPowers } from "./power-system.ts";
import { listOwnedInventory } from "./inventory-system.ts";

function listRecentConsequenceEvents(
  db: DatabaseSync,
  campaignId: string,
  limit = 20
): Array<{ sequence: number; turn: number; toolType: string; reason: string }> {
  const allowed = new Set(["change_faction_condition", "change_npc_reputation", "advance_faction_path", "record_location_consequence", "manage_npc_turn", "manage_story_thread", "create_story_thread"]);
  const rows = db.prepare(`SELECT sequence, turn, payload_json AS payloadJson
    FROM event_log WHERE campaign_id = ? AND event_type = 'tool_applied'
    ORDER BY sequence DESC LIMIT ?`).all(campaignId, Math.max(1, Math.min(limit * 3, 60))) as Array<{ sequence: number; turn: number; payloadJson: string }>;
  return rows.flatMap((row) => {
    const payload = JSON.parse(row.payloadJson) as { type?: string; reason?: string };
    if (!payload.type || !allowed.has(payload.type)) return [];
    return [{ sequence: row.sequence, turn: row.turn, toolType: payload.type, reason: payload.reason ?? "Recorded durable consequence." }];
  }).slice(0, limit);
}

export function buildPerspectiveContext(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignName: string
): PerspectiveContext {
  const campaign = getCampaign(db, campaignName);
  if (!campaign) throw new Error(`Campaign '${campaignName}' does not exist`);
  const currentLocation = content.locations.find((location) => location.id === campaign.currentLocationId);
  if (!currentLocation) throw new Error(`Current location ${campaign.currentLocationId} is missing from authored content`);
  const stage = content.stages.find((candidate) => candidate.key === campaign.stage);
  if (!stage) throw new Error(`Campaign stage ${campaign.stage} is missing from authored content`);
  const connectedLocations = currentLocation.connections.map((id) => {
    const location = content.locations.find((candidate) => candidate.id === id);
    if (!location) throw new Error(`Connected location ${id} is missing from authored content`);
    return location;
  });
  const presentCharacters = listPresentCharacterStates(db, campaign.id, currentLocation.id).map((state) => ({
    ...state,
    factionId: content.characters.find((character) => character.id === state.characterId)?.factionId ?? null
  }));
  const encounteredScene = getSceneForTurnAndLocation(db, campaign.id, campaign.turn, currentLocation.id) ?? null;
  const blueprint = getCampaignBlueprint(db, campaign.id);
  if (!blueprint) throw new Error(`Campaign ${campaign.id} is missing its hidden story blueprint`);
  return {
    campaignId: campaign.id,
    seed: campaign.seed,
    stage: campaign.stage,
    campaignOpeningPremise: content.campaign.openingPremise,
    stageAnchor: stage.anchor,
    stageMaxThreatLevel: stage.maxThreatLevel,
    turn: campaign.turn,
    currentLocation,
    connectedLocations,
    presentCharacterIds: listCharactersAtLocation(db, campaign.id, currentLocation.id),
    persistentConsequences: listLocationConsequences(db, campaign.id, currentLocation.id),
    encounteredScene,
    factionPathProgress: listFactionPathProgress(db, campaign.id),
    factionConditions: listFactionConditions(db, campaign.id),
    presentCharacters,
    recentTearArrivals: listRecentTearArrivals(db, campaign.id),
    npcContext: buildNpcContext(db, {
      campaignId: campaign.id,
      locationId: currentLocation.id,
      focusNpcIds: encounteredScene?.participantIds ?? []
    }),
    publicFacts: listPublicWorldFacts(db, campaign.id),
    playerCharacter: getPlayerCharacter(db, campaign.id) ?? null,
    playerPowers: listOwnedPlayerPowers(db, content, campaign.id),
    playerInventory: listOwnedInventory(db, content, campaign.id),
    playerProgression: getPlayerProgression(db, campaign.id),
    playerQuests: listRelevantQuestInstances(db, campaign.id, campaign.stage, "player"),
    playerKnownStoryThreads: listRelevantStoryThreads(db, campaign.id, campaign.stage, currentLocation.id, "player"),
    visibleOpeningPressure: campaign.stage === "opening" && campaign.turn === 0 ? blueprint.openingPressure : null
  };
}

export function buildDirectorPlanningContext(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignName: string
): DirectorPlanningContext {
  const perspective = buildPerspectiveContext(db, content, campaignName);
  const campaignBlueprint = getCampaignBlueprint(db, perspective.campaignId)!;
  return {
    ...perspective,
    campaignBlueprint,
    directorQuests: listRelevantQuestInstances(db, perspective.campaignId, perspective.stage, "director"),
    recoveryEvidenceEvents: listRecentConsequenceEvents(db, perspective.campaignId),
    directorStoryThreads: listRelevantStoryThreads(
      db,
      perspective.campaignId,
      perspective.stage,
      perspective.currentLocation.id,
      "director"
    )
  };
}
