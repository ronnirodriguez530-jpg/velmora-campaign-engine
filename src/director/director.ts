import type { DirectorContext, DirectorPreview, DirectorTurnPlan, PerspectiveContext, ScenePackage, StoryPresentation } from "../domain/types.ts";

export interface CampaignDirector {
  readonly source: "cloud" | "diagnostic";
  preview(context: DirectorContext): Promise<DirectorPreview>;
  presentScene(context: PerspectiveContext, scene: ScenePackage): Promise<StoryPresentation>;
  planTurn(context: PerspectiveContext, playerInput: string, validationFeedback?: string[]): Promise<DirectorTurnPlan>;
}
