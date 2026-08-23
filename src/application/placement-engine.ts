import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { PerspectiveContext, ScenePackage, VelmoraContent } from "../domain/types.ts";
import { getSceneForTurnAndLocation, persistScene } from "../persistence/database.ts";
import { seededChoice, seededInteger } from "./seeded-random.ts";
import { validateScenePackage } from "./scene-validator.ts";

export function generateScene(context: PerspectiveContext, content: VelmoraContent): ScenePackage {
  const validTemplates = content.sceneTemplates.filter((template) => template.stages.includes(context.stage));
  if (validTemplates.length === 0) throw new Error(`No approved scene template exists for campaign stage ${context.stage}`);
  const selectionSeed = `${context.seed}|${context.stage}|${context.turn}|${context.currentLocation.id}`;
  const template = seededChoice(selectionSeed, validTemplates);
  const upperThreat = Math.min(template.maxThreatLevel, context.stageMaxThreatLevel);
  const threatLevel = seededInteger(`${selectionSeed}|threat`, template.minThreatLevel, upperThreat);
  const suffix = createHash("sha256").update(`${selectionSeed}|${template.id}`).digest("hex").slice(0, 12).toUpperCase();
  const factionIds = context.currentLocation.district.startsWith("FAC-") ? [context.currentLocation.district] : [];
  return {
    id: `SCN-${suffix}`,
    campaignId: context.campaignId,
    turn: context.turn,
    stage: context.stage,
    locationId: context.currentLocation.id,
    participantIds: [
      ...context.presentCharacterIds,
      ...context.npcContext.full.map((entry) => entry.npc.npcId)
    ],
    factionIds,
    questLinks: [],
    conflictKey: template.conflictKey,
    objectiveKey: template.objectiveKey,
    threatLevel,
    visibleFacts: [
      ...context.currentLocation.perspectiveTags.map((tag) => `location:${tag}`),
      ...context.persistentConsequences.map((consequence) => `consequence:${consequence}`)
    ],
    proposedConsequences: [],
    suggestedActions: ["Inspect the immediate situation", "Respond to the present pressure"],
    allowsFreeText: true,
    templateId: template.id
  };
}

export function getOrCreateEncounteredScene(
  db: DatabaseSync,
  context: PerspectiveContext,
  content: VelmoraContent
): { scene: ScenePackage; reused: boolean } {
  const existing = getSceneForTurnAndLocation(db, context.campaignId, context.turn, context.currentLocation.id);
  if (existing) return { scene: existing, reused: true };
  const scene = generateScene(context, content);
  validateScenePackage(scene, context, content);
  db.exec("BEGIN IMMEDIATE");
  try {
    persistScene(db, scene);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { scene, reused: false };
}
