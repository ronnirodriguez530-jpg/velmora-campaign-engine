import type { DatabaseSync } from "node:sqlite";
import type { CampaignDirector } from "../director/director.ts";
import type { PendingActionCheckView, PendingQuestDirectionConfirmationView, ScenePackage, TurnResult, VelmoraContent } from "../domain/types.ts";
import { buildDirectorPlanningContext, buildPerspectiveContext } from "./context-builder.ts";
import { getOrCreateEncounteredScene } from "./placement-engine.ts";
import { runPlayerAction } from "./turn-orchestrator.ts";
import { assessPlayerAction, completePendingAction, getPendingActionCheck, rollPendingAction } from "./dice-resolution.ts";
import { acceptPendingQuestDirectionConfirmation, createPendingQuestDirectionConfirmation, getPendingQuestDirectionConfirmation, rejectPendingQuestDirectionConfirmation } from "./quest-direction-confirmation.ts";

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
  const begun = await beginPlayableAction(db, content, director, campaignName, playerInput);
  if (begun.status === "roll_required") {
    throw new Error("This action requires the player-clicked roll interface; resolve it in the browser");
  }
  if (begun.status === "direction_confirmation_required") {
    throw new Error("This action requires the player-confirmed quest direction interface; resolve it in the browser");
  }
  return begun.result;
}

export type BegunPlayableAction =
  | { status: "resolved"; result: TurnResult }
  | { status: "roll_required"; pendingCheck: PendingActionCheckView }
  | { status: "direction_confirmation_required"; pendingDirectionConfirmation: PendingQuestDirectionConfirmationView };

async function resolvePlayableAction(
  db: DatabaseSync,
  content: VelmoraContent,
  director: CampaignDirector,
  campaignName: string,
  playerInput: string
): Promise<Exclude<BegunPlayableAction, { status: "direction_confirmation_required" }>> {
  const assessment = await assessPlayerAction(db, content, director, campaignName, playerInput);
  if (assessment.automatic) return { status: "resolved", result: await runPlayerAction(db, content, director, campaignName, playerInput, { kind: "automatic", reason: assessment.reason }) };
  return { status: "roll_required", pendingCheck: assessment.check };
}

export async function beginPlayableAction(
  db: DatabaseSync,
  content: VelmoraContent,
  director: CampaignDirector,
  campaignName: string,
  playerInput: string
): Promise<BegunPlayableAction> {
  openPlayableMoment(db, content, campaignName);
  const context = buildPerspectiveContext(db, content, campaignName);
  const pendingCheck = getPendingActionCheck(db, context.campaignId);
  if (pendingCheck) return { status: "roll_required", pendingCheck };
  const existing = getPendingQuestDirectionConfirmation(db, context.campaignId);
  if (existing) return { status: "direction_confirmation_required", pendingDirectionConfirmation: existing };
  const hasUncommittedQuest = context.playerQuests.some((quest) => quest.state === "available" && quest.selectedDirectionId === null);
  if (hasUncommittedQuest && director.interpretQuestDirection) {
    const interpretation = await director.interpretQuestDirection(buildDirectorPlanningContext(db, content, campaignName), playerInput);
    if (interpretation) {
      return {
        status: "direction_confirmation_required",
        pendingDirectionConfirmation: createPendingQuestDirectionConfirmation(db, context.campaignId, playerInput, interpretation)
      };
    }
  }
  return resolvePlayableAction(db, content, director, campaignName, playerInput);
}

export async function respondToQuestDirectionConfirmation(
  db: DatabaseSync,
  content: VelmoraContent,
  director: CampaignDirector,
  campaignName: string,
  confirmationId: string,
  accepted: boolean
): Promise<BegunPlayableAction | { status: "direction_rejected"; rejected: PendingQuestDirectionConfirmationView }> {
  const context = buildPerspectiveContext(db, content, campaignName);
  if (!accepted) {
    return { status: "direction_rejected", rejected: rejectPendingQuestDirectionConfirmation(db, context.campaignId, confirmationId) };
  }
  const acceptedDirection = acceptPendingQuestDirectionConfirmation(db, context.campaignId, confirmationId);
  return resolvePlayableAction(db, content, director, campaignName, acceptedDirection.playerInput);
}

export async function finishPlayableAction(
  db: DatabaseSync,
  content: VelmoraContent,
  director: CampaignDirector,
  campaignName: string,
  checkId: string
): Promise<{ result: TurnResult; roll: ReturnType<typeof rollPendingAction>["resolution"] }> {
  const pending = rollPendingAction(db, campaignName, checkId);
  const result = await runPlayerAction(db, content, director, campaignName, pending.playerInput, { kind: "rolled", roll: pending.resolution });
  completePendingAction(db, campaignName, checkId);
  return { result, roll: pending.resolution };
}
