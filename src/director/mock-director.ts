import type { CampaignDirector } from "./director.ts";
import type { DirectorContext, DirectorPlanningContext, DirectorPreview, DirectorTurnPlan, PerspectiveContext, ScenePackage, StoryPresentation, ToolRequest } from "../domain/types.ts";

export class MockDirector implements CampaignDirector {
  readonly source = "diagnostic" as const;
  async preview(context: DirectorContext): Promise<DirectorPreview> {
    return {
      intent: "inspect",
      summary: `Mock Director is ready at ${context.locationId} during ${context.stage}, turn ${context.turn}. No world state was changed.`,
      suggestedActions: ["Inspect the current location", "Review campaign status"],
      allowsFreeText: true
    };
  }

  async presentScene(context: PerspectiveContext, scene: ScenePackage): Promise<StoryPresentation> {
    return {
      sceneId: scene.id,
      title: context.currentLocation.name,
      narration: "Diagnostic mode is active. Scene placement and world-state wiring are available, but story narration requires the Live Campaign Master.",
      suggestedActions: scene.suggestedActions,
      source: "diagnostic"
    };
  }

  async planTurn(context: DirectorPlanningContext, playerInput: string): Promise<DirectorTurnPlan> {
    const normalized = playerInput.toLowerCase();
    const toolRequests: ToolRequest[] = [];
    if (normalized.includes("support league")) {
      toolRequests.push({
        type: "change_faction_condition",
        factionId: "FAC-001",
        delta: 1,
        reason: "Player committed support to the League of Thorns"
      });
    }
    if (normalized.includes("neglect league")) {
      toolRequests.push({
        type: "change_faction_condition",
        factionId: "FAC-001",
        delta: -1,
        reason: "Player deliberately neglected the League of Thorns"
      });
    }
    return {
      summary: `Mock Director received '${playerInput}' at ${context.currentLocation.id}.`,
      majorActionProposal: toolRequests.length > 0,
      toolRequests,
      suggestedActions: ["Review the result", "Inspect current campaign status"],
      allowsFreeText: true
    };
  }
}
