import type { DatabaseSync } from "node:sqlite";
import type { CampaignDirector } from "../director/director.ts";
import type { ScenePackage, TurnResult, VelmoraContent } from "../domain/types.ts";
import { buildPerspectiveContext } from "./context-builder.ts";
import { getOrCreateEncounteredScene } from "./placement-engine.ts";
import { runPlayerAction } from "./turn-orchestrator.ts";

export type PlayableMoment = {
  scene: ScenePackage;
  reused: boolean;
};

export function openPlayableMoment(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignName: string
): PlayableMoment {
  const context = buildPerspectiveContext(db, content, campaignName);
  return getOrCreateEncounteredScene(db, context, content);
}

export async function submitPlayableAction(
  db: DatabaseSync,
  content: VelmoraContent,
  director: CampaignDirector,
  campaignName: string,
  playerInput: string
): Promise<TurnResult> {
  openPlayableMoment(db, content, campaignName);
  return runPlayerAction(db, content, director, campaignName, playerInput);
}
