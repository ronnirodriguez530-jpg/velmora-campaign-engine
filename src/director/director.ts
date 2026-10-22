import type { ActionAssessment, ActionResolution, DirectorContext, DirectorPlanningContext, DirectorPreview, DirectorTurnPlan, PerspectiveContext, QuestDirectionInterpretation, ScenePackage, StoryPresentation } from "../domain/types.ts";
import type { QuestSimilarityReviewInput, QuestSimilaritySignal } from "../quest/quest-pattern-transformer.ts";

export interface CampaignDirector {
  readonly source: "cloud" | "diagnostic";
  preview(context: DirectorContext): Promise<DirectorPreview>;
  presentScene(context: PerspectiveContext, scene: ScenePackage): Promise<StoryPresentation>;
  interpretQuestDirection?(context: DirectorPlanningContext, playerInput: string): Promise<QuestDirectionInterpretation | null>;
  assessAction?(context: DirectorPlanningContext, playerInput: string): Promise<ActionAssessment>;
  reviewQuestSimilarity?(input: QuestSimilarityReviewInput): Promise<QuestSimilaritySignal[]>;
  planTurn(context: DirectorPlanningContext, playerInput: string, validationFeedback?: string[], actionResolution?: ActionResolution): Promise<DirectorTurnPlan>;
}
