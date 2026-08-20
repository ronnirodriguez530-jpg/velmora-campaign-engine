import type { DatabaseSync } from "node:sqlite";
import type { CampaignDirector } from "../director/director.ts";
import type { StoryPresentation, VelmoraContent } from "../domain/types.ts";
import { getStoryPresentation, persistStoryPresentation } from "../persistence/database.ts";
import { buildPerspectiveContext } from "./context-builder.ts";
import { openPlayableMoment } from "./gameplay-session.ts";

export async function openPresentedStoryMoment(
  db: DatabaseSync,
  content: VelmoraContent,
  director: CampaignDirector,
  campaignName: string
): Promise<{ scene: ReturnType<typeof openPlayableMoment>["scene"]; presentation: StoryPresentation; reused: boolean }> {
  const moment = openPlayableMoment(db, content, campaignName);
  const existing = getStoryPresentation(db, moment.scene.campaignId, moment.scene.id);
  if (existing && existing.source === director.source) return { scene: moment.scene, presentation: existing, reused: true };
  const presentation = await director.presentScene(buildPerspectiveContext(db, content, campaignName), moment.scene);
  if (presentation.sceneId !== moment.scene.id) throw new Error("Campaign Master presented the wrong scene");
  if (!presentation.title.trim() || !presentation.narration.trim()) throw new Error("Campaign Master returned an empty story presentation");
  if (presentation.suggestedActions.length !== 2) throw new Error("Campaign Master must present exactly two suggested actions");
  persistStoryPresentation(db, moment.scene.campaignId, moment.scene.turn, presentation);
  return { scene: moment.scene, presentation, reused: false };
}
