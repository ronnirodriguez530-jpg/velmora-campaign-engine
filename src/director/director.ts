import type { ActionAssessment, ActionResolution, DirectorContext, DirectorPlanningContext, DirectorPreview, DirectorTurnPlan, PerspectiveContext, QuestDirectionInterpretation, ScenePackage, StoryPresentation } from "../domain/types.ts";

export interface CampaignDirector {
  readonly source: "cloud" | "diagnostic";
  preview(context: DirectorContext): Promise<DirectorPreview>;
  presentScene(context: PerspectiveContext, scene: ScenePackage): Promise<StoryPresentation>;
  interpretQuestDirection?(context: DirectorPlanningContext, playerInput: string): Promise<QuestDirectionInterpretation | null>;
  assessAction?(context: DirectorPlanningContext, playerInput: string): Promise<ActionAssessment>;
  planTurn(context: DirectorPlanningContext, playerInput: string, validationFeedback?: string[], actionResolution?: ActionResolution): Promise<DirectorTurnPlan>;
}
