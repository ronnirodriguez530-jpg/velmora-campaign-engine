import type { VelmoraContent } from "./types.ts";

const stages = ["opening", "stabilization", "escalation", "resolution"];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function validateContent(content: VelmoraContent): void {
  assert(content.campaign.id === "CMP-VELMORA", "Unexpected campaign ID");
  assert(content.campaign.playableWorld === "Velmora", "Velmora must remain the playable world");
  assert(content.campaign.initialLocationId === "LOC-COUNCIL-CROWN", "The playable opening must begin at the Council Crown");
  assert(content.campaign.openingPremise.length > 0, "The playable opening premise is required");
  assert(content.campaign.allowTemporaryTearTravel === false, "Temporary Tear travel must be disabled");
  assert(content.campaign.factionPathRequirement === 2, "Stage progression must require two faction paths");

  assert(content.stages.length === 4, "Exactly four campaign stages are required");
  assert(content.stages.every((stage, index) => stage.key === stages[index]), "Campaign stages are missing or out of order");
  assert(content.stages.every((stage) => stage.maxThreatLevel >= 1 && stage.maxThreatLevel <= 5), "Stage threat limit must be 1-5");

  assert(content.factions.length === 6, "Exactly six factions are required");
  assert(content.factions.every((faction) => faction.initialCondition >= 0 && faction.initialCondition <= 4), "Faction condition must be 0-4");
  assert(content.factions.every((faction) => faction.districtIdentity.colors.length === 3), "Each faction district requires exactly three map colors");
  assert(content.factions.every((faction) => faction.districtIdentity.environment.length > 0 && faction.districtIdentity.wayOfLife.length > 0 && faction.districtIdentity.landmark.length > 0), "Each faction district requires an environment, way of life, and landmark");
  const orderOfGlass = content.factions.find((faction) => faction.id === "FAC-006");
  assert(orderOfGlass?.hiddenStructure !== undefined, "The Order of Glass requires its approved hidden guild structure");
  assert(orderOfGlass.hiddenStructure.publicFace.length > 0 && orderOfGlass.hiddenStructure.trueAuthority.length > 0, "The Order of Glass requires both a public face and true authority");
  assert(orderOfGlass.hiddenStructure.leadershipRule.length > 0 && orderOfGlass.hiddenStructure.doctrine.length > 0, "The Order of Glass requires a leadership rule and doctrine");
  assert(orderOfGlass.hiddenStructure.methods.length >= 4, "The Order of Glass requires a concrete covert method set");
  const glassAwareness = orderOfGlass.hiddenStructure.publicAwareness;
  assert(glassAwareness.unawarePercent + glassAwareness.speculationPercent + glassAwareness.suspicionPercent + glassAwareness.knowsAndKeepsQuietPercent === 100, "Order of Glass public-awareness percentages must total 100");
  assert(glassAwareness.unawarePercent === 75 && glassAwareness.speculationPercent === 15 && glassAwareness.suspicionPercent === 5 && glassAwareness.knowsAndKeepsQuietPercent === 5, "Order of Glass public-awareness distribution must remain at the approved 75/15/5/5 split");
  const approvedSectors = new Map([
    ["FAC-002", "12 to 2 o'clock"],
    ["FAC-004", "2 to 4 o'clock"],
    ["FAC-005", "4 to 6 o'clock"],
    ["FAC-001", "6 to 8 o'clock"],
    ["FAC-003", "8 to 10 o'clock"],
    ["FAC-006", "10 to 12 o'clock"]
  ]);
  assert(content.factions.every((faction) => approvedSectors.get(faction.id) === faction.districtIdentity.mapSector), "Faction district order must match the approved Velmora blueprint");

  assert(content.characters.length === 8, "Exactly eight essential NPC slots are required");
  assert(content.characters.every((character) => character.initialReputation >= -2 && character.initialReputation <= 2), "NPC reputation must be -2 to 2");

  const factionIds = new Set(content.factions.map((faction) => faction.id));
  const locationIds = new Set(content.locations.map((location) => location.id));
  assert(factionIds.size === content.factions.length, "Faction IDs must be unique");
  assert(locationIds.size === content.locations.length, "Location IDs must be unique");
  assert(locationIds.has(content.campaign.initialLocationId), "Initial location does not exist");
  assert(content.locations.every((location) => location.mapPosition.length > 0 && location.environment.length > 0), "Each location requires a map position and environment");

  for (const location of content.locations) {
    for (const connection of location.connections) {
      assert(locationIds.has(connection), `Location ${location.id} references missing connection ${connection}`);
      const target = content.locations.find((candidate) => candidate.id === connection)!;
      assert(target.connections.includes(location.id), `Location connection ${location.id} -> ${connection} must be reciprocal`);
    }
  }

  for (const character of content.characters) {
    assert(character.factionId === null || factionIds.has(character.factionId), `Character ${character.id} references missing faction`);
    assert(locationIds.has(character.initialLocationId), `Character ${character.id} references missing initial location`);
  }

  assert(content.openingSpawns.length === 6, "The opening requires exactly six d6 spawn outcomes");
  assert(content.openingSpawns.every((spawn, index) => spawn.roll === index + 1), "Opening spawn rolls must cover 1 through 6 in order");
  assert(new Set(content.openingSpawns.map((spawn) => spawn.id)).size === 6, "Opening spawn IDs must be unique");
  assert(content.openingSpawns.every((spawn) => spawn.locationId === content.campaign.initialLocationId), "Every opening spawn must remain inside the Council Crown");
  assert(content.openingSpawns.every((spawn) => spawn.spawnArea.length > 0 && spawn.entryReason.length > 0 && spawn.immediatePressure.length > 0), "Every opening spawn requires an area, entry reason, and immediate pressure");

  const blueprintPools = content.storyBlueprintPools;
  assert(blueprintPools.version >= 1, "Story blueprint pool version is required");
  assert(blueprintPools.openingPressures.length >= 6, "The campaign blueprint requires at least six opening pressures");
  assert(blueprintPools.openingPressures.every((pressure) => pressure.threatLevel >= 1 && pressure.threatLevel <= 2), "Opening pressures must respect the Opening-stage threat limit");
  assert(blueprintPools.openingPressures.every((pressure) => pressure.title.length > 0 && pressure.summary.length > 0 && pressure.tags.length > 0), "Every opening pressure requires a title, summary, and tags");
  assert(blueprintPools.factionPressures.length >= 4, "The campaign blueprint requires multiple faction-pressure patterns");
  assert(blueprintPools.clueRoutes.length >= 4, "The campaign blueprint requires multiple clue routes");
  assert(blueprintPools.clueRouteCount >= 2 && blueprintPools.clueRouteCount < blueprintPools.clueRoutes.length, "Clue-route count must preserve variation and multiple paths");
  assert(blueprintPools.reversals.length >= 3, "The campaign blueprint requires multiple possible reversals");
  assert(blueprintPools.reversals.every((reversal) => reversal.minimumStage !== "opening"), "Reversals cannot be scheduled during the Opening stage");
  assert(blueprintPools.endgameMinimumStage === "resolution", "The First Speaker endgame must remain locked to Resolution");
  const blueprintIds = [
    ...blueprintPools.openingPressures.map((entry) => entry.id),
    ...blueprintPools.factionPressures.map((entry) => entry.id),
    ...blueprintPools.clueRoutes.map((entry) => entry.id),
    ...blueprintPools.reversals.map((entry) => entry.id)
  ];
  assert(new Set(blueprintIds).size === blueprintIds.length, "Story blueprint pool IDs must be globally unique");

  assert(content.sceneTemplates.length >= 4, "At least one mechanical scene scaffold per campaign stage is required");
  for (const template of content.sceneTemplates) {
    assert(template.stages.length > 0, `Scene template ${template.id} requires a stage`);
    assert(template.minThreatLevel >= 1 && template.maxThreatLevel <= 5, `Scene template ${template.id} threat range must be 1-5`);
    assert(template.minThreatLevel <= template.maxThreatLevel, `Scene template ${template.id} threat range is inverted`);
  }
}
