import type { DatabaseSync } from "node:sqlite";
import type { CampaignDirector } from "../director/director.ts";
import type { PendingActionCheckView, ScenePackage, TurnResult, VelmoraContent } from "../domain/types.ts";
import { buildPerspectiveContext } from "./context-builder.ts";
import { getOrCreateEncounteredScene } from "./placement-engine.ts";
import { runPlayerAction } from "./turn-orchestrator.ts";
import { assessPlayerAction, completePendingAction, rollPendingAction } from "./dice-resolution.ts";

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
  return begun.result;
}

export type BegunPlayableAction =
  | { status: "resolved"; result: TurnResult }
  | { status: "roll_required"; pendingCheck: PendingActionCheckView };

export async function beginPlayableAction(
  db: DatabaseSync,
  content: VelmoraContent,
  director: CampaignDirector,
  campaignName: string,
  playerInput: string
): Promise<BegunPlayableAction> {
  openPlayableMoment(db, content, campaignName);
  const assessment = await assessPlayerAction(db, content, director, campaignName, playerInput);
  if (assessment.automatic) return { status: "resolved", result: await runPlayerAction(db, content, director, campaignName, playerInput, { kind: "automatic", reason: assessment.reason }) };
  return { status: "roll_required", pendingCheck: assessment.check };
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
