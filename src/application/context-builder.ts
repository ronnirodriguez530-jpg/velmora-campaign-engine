import type { DatabaseSync } from "node:sqlite";
import type { DirectorPlanningContext, PerspectiveContext, VelmoraContent } from "../domain/types.ts";
import { getCampaign, getCampaignBlueprint, getPlayerCharacter, getSceneForTurnAndLocation, listCharactersAtLocation, listFactionConditions, listFactionPathProgress, listLocationConsequences, listPresentCharacterStates, listPublicWorldFacts, listRecentTearArrivals, listRelevantStoryThreads } from "../persistence/database.ts";
import { buildNpcContext } from "../npc/npc-context-gate.ts";
import { listOwnedPlayerPowers } from "./power-system.ts";
import { listOwnedInventory } from "./inventory-system.ts";

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
    directorStoryThreads: listRelevantStoryThreads(
      db,
      perspective.campaignId,
      perspective.stage,
      perspective.currentLocation.id,
      "director"
    )
  };
}
