import type { CampaignBlueprint, StoryThread, VelmoraContent } from "../domain/types.ts";
import { seededChoice, seededSample } from "./seeded-random.ts";

export function generateCampaignBlueprint(
  content: VelmoraContent,
  campaignId: string,
  seed: string
): CampaignBlueprint {
  const pools = content.storyBlueprintPools;
  const factions = seededSample(`${seed}:focal-factions`, content.factions, 2);
  const openingPressure = seededChoice(`${seed}:opening-pressure`, pools.openingPressures);
  const factionPressure = seededChoice(`${seed}:faction-pressure`, pools.factionPressures);
  const clueRoutes = seededSample(`${seed}:clue-routes`, pools.clueRoutes, pools.clueRouteCount);
  const reversal = seededChoice(`${seed}:reversal`, pools.reversals);

  return {
    campaignId,
    version: pools.version,
    openingPressure,
    focalFactionIds: [factions[0]!.id, factions[1]!.id],
    factionPressure,
    clueRoutes,
    reversal,
    endgameMinimumStage: pools.endgameMinimumStage,
    createdTurn: 0
  };
}

export function createInitialBlueprintThreads(blueprint: CampaignBlueprint): StoryThread[] {
  return [
    {
      campaignId: blueprint.campaignId,
      threadId: "THREAD-OPENING-PRESSURE",
      kind: "main",
      title: blueprint.openingPressure.title,
      summary: blueprint.openingPressure.summary,
      status: "active",
      visibility: "player",
      minimumStage: "opening",
      maximumStage: "opening",
      urgency: 3,
      locationIds: ["LOC-COUNCIL-CROWN"],
      factionIds: [],
      npcIds: [],
      recoveryPaths: ["If the immediate response fails, survivors and changed conditions must create a new route forward."],
      createdTurn: 0,
      updatedTurn: 0,
      lastUsedTurn: null
    },
    {
      campaignId: blueprint.campaignId,
      threadId: "THREAD-FIRST-SPEAKER-TRANSFORMATION",
      kind: "mystery",
      title: "What Took Root in the First Speaker",
      summary: "The opening strike secretly begins the First Speaker's transformation. Apparent recovery and brief complete-control episodes may begin during Stabilization, longer manipulation belongs to Escalation, and sustained takeover is forbidden before Resolution.",
      status: "dormant",
      visibility: "director",
      minimumStage: "opening",
      maximumStage: "resolution",
      urgency: 1,
      locationIds: [],
      factionIds: [],
      npcIds: ["NPC-FIRST-SPEAKER"],
      recoveryPaths: ["Preserve multiple possible interventions until player discoveries and choices close them."],
      createdTurn: 0,
      updatedTurn: 0,
      lastUsedTurn: null
    },
    {
      campaignId: blueprint.campaignId,
      threadId: "THREAD-FACTION-PRESSURE",
      kind: "faction",
      title: "Pressure Between Factions",
      summary: blueprint.factionPressure.summary,
      status: "dormant",
      visibility: "director",
      minimumStage: "opening",
      maximumStage: "escalation",
      urgency: 1,
      locationIds: [],
      factionIds: blueprint.focalFactionIds,
      npcIds: [],
      recoveryPaths: ["The conflict may be redirected through compromise, a third faction, changed evidence, or player-created leverage."],
      createdTurn: 0,
      updatedTurn: 0,
      lastUsedTurn: null
    },
    {
      campaignId: blueprint.campaignId,
      threadId: "THREAD-CAMPAIGN-REVERSAL",
      kind: "dynamic",
      title: "Dormant Campaign Reversal",
      summary: blueprint.reversal.summary,
      status: "dormant",
      visibility: "director",
      minimumStage: blueprint.reversal.minimumStage,
      maximumStage: "resolution",
      urgency: 0,
      locationIds: [],
      factionIds: [],
      npcIds: [],
      recoveryPaths: ["If player choices invalidate this reversal, retire it rather than forcing it into the campaign."],
      createdTurn: 0,
      updatedTurn: 0,
      lastUsedTurn: null
    }
  ];
}
