import type { CampaignDirector } from "./director.ts";
import type { ActionAssessment, ActionResolution, DirectorContext, DirectorPlanningContext, DirectorPreview, DirectorTurnPlan, PerspectiveContext, QuestDirectionInterpretation, ScenePackage, StoryPresentation, ToolRequest } from "../domain/types.ts";

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

  async assessAction(_context: DirectorPlanningContext, playerInput: string): Promise<ActionAssessment> {
    if (playerInput.toLowerCase().includes("diagnostic check")) {
      return {
        resolution: "check",
        category: "skill",
        ability: "dexterity",
        skill: "stealth",
        difficulty: "standard",
        mode: "normal",
        stakes: "Success passes unnoticed; a worse result draws attention but leaves another route.",
        reason: "The diagnostic action is uncertain and has a meaningful consequence."
      };
    }
    return { resolution: "automatic", reason: "The diagnostic action does not require a roll." };
  }

  async interpretQuestDirection(context: DirectorPlanningContext, playerInput: string): Promise<QuestDirectionInterpretation | null> {
    const normalized = playerInput.toLowerCase();
    for (const quest of context.playerQuests.filter((candidate) => candidate.state === "available" && candidate.selectedDirectionId === null)) {
      const direction = quest.possibleDirections.find((candidate) => normalized.includes(candidate.directionId.toLowerCase()) || normalized.includes(candidate.summary.toLowerCase().split(" ").slice(0, 3).join(" ")));
      if (direction) return { questId: quest.questId, directionId: direction.directionId, explanation: `The action matches the recorded direction: ${direction.summary}` };
    }
    return null;
  }

  async planTurn(context: DirectorPlanningContext, playerInput: string, _validationFeedback?: string[], actionResolution?: ActionResolution): Promise<DirectorTurnPlan> {
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
      summary: actionResolution?.kind === "rolled"
        ? `Mock Director resolved '${playerInput}' as ${actionResolution.roll.outcome} with a total of ${actionResolution.roll.total}.`
        : `Mock Director received '${playerInput}' at ${context.currentLocation.id}.`,
      majorActionProposal: toolRequests.length > 0,
      toolRequests,
      suggestedActions: ["Review the result", "Inspect current campaign status"],
      allowsFreeText: true
    };
  }
}
