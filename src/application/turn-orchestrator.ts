import type { DatabaseSync } from "node:sqlite";
import type { CampaignDirector } from "../director/director.ts";
import type { TurnResult, VelmoraContent } from "../domain/types.ts";
import { isMajorPlayerAction } from "./action-classifier.ts";
import { appendEvent, captureSnapshot, getCampaign, insertCheckpoint } from "../persistence/database.ts";
import { validateToolRequest } from "../tools/validator.ts";
import { executeToolRequest } from "../tools/executor.ts";
import { buildPerspectiveContext } from "./context-builder.ts";
import { evaluateStageProgression } from "./stage-progression.ts";
import { maybePersistTearArrival } from "./tear-event-generator.ts";

const MAX_DIRECTOR_ATTEMPTS = 2;

async function requestValidPlan(
  db: DatabaseSync,
  content: VelmoraContent,
  director: CampaignDirector,
  campaignName: string,
  playerInput: string
) {
  const context = buildPerspectiveContext(db, content, campaignName);
  let feedback: string[] | undefined;
  for (let attempt = 1; attempt <= MAX_DIRECTOR_ATTEMPTS; attempt += 1) {
    const plan = await director.planTurn(context, playerInput, feedback);
    try {
      for (const request of plan.toolRequests) validateToolRequest(db, content, context.campaignId, request);
      return plan;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      feedback = [`Attempt ${attempt} was rejected by the engine: ${message}`];
    }
  }
  throw new Error(`Director could not produce a valid plan after ${MAX_DIRECTOR_ATTEMPTS} attempts: ${feedback?.[0] ?? "unknown validation failure"}`);
}

export async function runPlayerAction(
  db: DatabaseSync,
  content: VelmoraContent,
  director: CampaignDirector,
  campaignName: string,
  playerInput: string
): Promise<TurnResult> {
  const campaign = getCampaign(db, campaignName);
  if (!campaign) throw new Error(`Campaign '${campaignName}' does not exist`);
  const plan = await requestValidPlan(db, content, director, campaignName, playerInput);

  const isMajor = isMajorPlayerAction(playerInput) || plan.majorActionProposal;
  if (!isMajor) {
    return {
      advanced: false,
      previousTurn: campaign.turn,
      currentTurn: campaign.turn,
      summary: plan.summary,
      appliedTools: 0
    };
  }

  const nextTurn = campaign.turn + 1;
  db.exec("BEGIN IMMEDIATE");
  try {
    const pre = captureSnapshot(db, campaign.id);
    insertCheckpoint(db, campaign.id, campaign.turn, nextTurn, "pre_turn", pre);
    for (const request of plan.toolRequests) validateToolRequest(db, content, campaign.id, request);
    for (const request of plan.toolRequests) executeToolRequest(db, campaign.id, nextTurn, request);
    db.prepare("UPDATE campaigns SET turn = ?, updated_at = ? WHERE id = ?")
      .run(nextTurn, new Date().toISOString(), campaign.id);
    evaluateStageProgression(db, content, campaignName, nextTurn);
    maybePersistTearArrival(db, campaign.id, campaign.seed, nextTurn);
    appendEvent(db, campaign.id, nextTurn, "world_turn_committed", {
      playerInput,
      directorSummary: plan.summary,
      toolCount: plan.toolRequests.length
    });
    const post = captureSnapshot(db, campaign.id);
    insertCheckpoint(db, campaign.id, campaign.turn, nextTurn, "post_turn", post);
    db.exec("COMMIT");
    return {
      advanced: true,
      previousTurn: campaign.turn,
      currentTurn: nextTurn,
      summary: plan.summary,
      appliedTools: plan.toolRequests.length
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
