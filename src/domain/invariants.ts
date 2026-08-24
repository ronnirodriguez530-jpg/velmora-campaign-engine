import type { VelmoraContent } from "./types.ts";

const stages = ["opening", "stabilization", "escalation", "resolution"];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function validateContent(content: VelmoraContent): void {
  assert(content.campaign.id === "CMP-VELMORA", "Unexpected campaign ID");
  assert(content.campaign.playableWorld === "Velmora", "Velmora must remain the playable world");
  assert(content.campaign.allowTemporaryTearTravel === false, "Temporary Tear travel must be disabled");
  assert(content.campaign.factionPathRequirement === 2, "Stage progression must require two faction paths");

  assert(content.stages.length === 4, "Exactly four campaign stages are required");
  assert(content.stages.every((stage, index) => stage.key === stages[index]), "Campaign stages are missing or out of order");
  assert(content.stages.every((stage) => stage.maxThreatLevel >= 1 && stage.maxThreatLevel <= 5), "Stage threat limit must be 1-5");

  assert(content.factions.length === 6, "Exactly six factions are required");
  assert(content.factions.every((faction) => faction.initialCondition >= 0 && faction.initialCondition <= 4), "Faction condition must be 0-4");
  assert(content.factions.every((faction) => faction.districtIdentity.colors.length === 3), "Each faction district requires exactly three map colors");
  assert(content.factions.every((faction) => faction.districtIdentity.environment.length > 0 && faction.districtIdentity.wayOfLife.length > 0 && faction.districtIdentity.landmark.length > 0), "Each faction district requires an environment, way of life, and landmark");

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

  assert(content.sceneTemplates.length >= 4, "At least one mechanical scene scaffold per campaign stage is required");
  for (const template of content.sceneTemplates) {
    assert(template.stages.length > 0, `Scene template ${template.id} requires a stage`);
    assert(template.minThreatLevel >= 1 && template.maxThreatLevel <= 5, `Scene template ${template.id} threat range must be 1-5`);
    assert(template.minThreatLevel <= template.maxThreatLevel, `Scene template ${template.id} threat range is inverted`);
  }
}
