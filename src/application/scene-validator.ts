import type { PerspectiveContext, ScenePackage, VelmoraContent } from "../domain/types.ts";

export function validateScenePackage(scene: ScenePackage, context: PerspectiveContext, content: VelmoraContent): void {
  if (scene.campaignId !== context.campaignId) throw new Error("Scene references the wrong campaign");
  if (scene.turn !== context.turn) throw new Error("Scene references the wrong world turn");
  if (scene.stage !== context.stage) throw new Error("Scene references the wrong campaign stage");
  if (scene.locationId !== context.currentLocation.id) throw new Error("Scene is outside the player's current perspective location");
  if (scene.threatLevel < 1 || scene.threatLevel > context.stageMaxThreatLevel) throw new Error("Scene threat level is not permitted by the current stage");
  if (scene.suggestedActions.length !== 2 || !scene.allowsFreeText) throw new Error("Scene must provide two actions and free-text input");
  if (!content.sceneTemplates.some((template) => template.id === scene.templateId && template.stages.includes(scene.stage))) {
    throw new Error("Scene template is missing or invalid for the current stage");
  }
  const presentNpcIds = [
    ...context.npcContext.full.map((entry) => entry.npc.npcId),
    ...context.npcContext.supporting.map((entry) => entry.npc.npcId)
  ];
  for (const participantId of scene.participantIds) {
    if (!context.presentCharacterIds.includes(participantId) && !presentNpcIds.includes(participantId)) {
      throw new Error(`Scene participant ${participantId} is not present`);
    }
  }
  for (const factionId of scene.factionIds) {
    if (!content.factions.some((faction) => faction.id === factionId)) throw new Error(`Scene references unknown faction ${factionId}`);
  }
}
