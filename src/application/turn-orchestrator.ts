import type { DatabaseSync } from "node:sqlite";
import type { CampaignDirector } from "../director/director.ts";
import type { ActionResolution, TurnResult, VelmoraContent } from "../domain/types.ts";
import { isMajorPlayerAction } from "./action-classifier.ts";
import { appendEvent, captureSnapshot, getCampaign, insertCheckpoint } from "../persistence/database.ts";
import { validateToolRequest } from "../tools/validator.ts";
import { executeToolRequest } from "../tools/executor.ts";
import { buildDirectorPlanningContext } from "./context-builder.ts";
import { evaluateStageProgression } from "./stage-progression.ts";
import { maybePersistTearArrival } from "./tear-event-generator.ts";

const MAX_DIRECTOR_ATTEMPTS = 2;

async function requestValidPlan(
  db: DatabaseSync,
  content: VelmoraContent,
  director: CampaignDirector,
  campaignName: string,
  playerInput: string,
  actionResolution?: ActionResolution
) {
  const context = buildDirectorPlanningContext(db, content, campaignName);
  let feedback: string[] | undefined;
  for (let attempt = 1; attempt <= MAX_DIRECTOR_ATTEMPTS; attempt += 1) {
    const plan = await director.planTurn(context, playerInput, feedback, actionResolution);
    try {
      if (plan.toolRequests.filter((request) => request.type === "request_minor_npc").length > 1) {
        throw new Error("A turn may request at most one new minor NPC");
      }
      if (plan.toolRequests.filter((request) => request.type === "manage_npc_turn").length > 20) {
        throw new Error("A turn may manage at most twenty directly affected NPCs");
      }
      const threadRequests = plan.toolRequests.filter((request) => request.type === "manage_story_thread");
      if (threadRequests.length > 4) {
        throw new Error("A turn may manage at most four story threads");
      }
      const sourceIds = threadRequests.map((request) => request.threadId);
      if (new Set(sourceIds).size !== sourceIds.length) {
        throw new Error("A story thread may be managed at most once per turn");
      }
      const replacementIds = threadRequests.flatMap((request) => request.replacement ? [request.replacement.threadId] : []);
      if (new Set(replacementIds).size !== replacementIds.length) {
        throw new Error("Replacement story thread IDs must be unique within a turn");
      }
      const creationRequests = plan.toolRequests.filter((request) => request.type === "create_story_thread");
      if (creationRequests.length > 2) throw new Error("A turn may create at most two story threads");
      const createdIds = creationRequests.map((request) => request.threadId);
      if (new Set(createdIds).size !== createdIds.length) throw new Error("Created story thread IDs must be unique within a turn");
      const allNewIds = [...replacementIds, ...createdIds];
      if (new Set(allNewIds).size !== allNewIds.length) throw new Error("All new story thread IDs must be unique within a turn");
      const questGenerations = plan.toolRequests.filter((request) => request.type === "generate_quest");
      if (questGenerations.length > 2) throw new Error("A turn may generate at most two quests");
      const questSourceIds = questGenerations.map((request) => request.sourceThreadId);
      if (new Set(questSourceIds).size !== questSourceIds.length) throw new Error("A story thread may generate at most one quest per turn");
      const recoveryGenerations = plan.toolRequests.filter((request) => request.type === "generate_recovery_quest");
      if (recoveryGenerations.length > 1) throw new Error("A turn may generate at most one altered recovery quest");
      const questUpdates = plan.toolRequests.filter((request) => request.type === "manage_quest");
      if (questUpdates.length > 4) throw new Error("A turn may manage at most four quests");
      const questIds = questUpdates.map((request) => request.questId);
      if (new Set(questIds).size !== questIds.length) throw new Error("A quest may be managed at most once per turn");
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
  playerInput: string,
  actionResolution?: ActionResolution
): Promise<TurnResult> {
  const campaign = getCampaign(db, campaignName);
  if (!campaign) throw new Error(`Campaign '${campaignName}' does not exist`);
  const plan = await requestValidPlan(db, content, director, campaignName, playerInput, actionResolution);

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
    for (const request of plan.toolRequests) await executeToolRequest(db, content, campaign.id, nextTurn, request);
    db.prepare("UPDATE campaigns SET turn = ?, updated_at = ? WHERE id = ?")
      .run(nextTurn, new Date().toISOString(), campaign.id);
    evaluateStageProgression(db, content, campaignName, nextTurn);
    maybePersistTearArrival(db, campaign.id, campaign.seed, nextTurn);
    appendEvent(db, campaign.id, nextTurn, "world_turn_committed", {
      playerInput,
      directorSummary: plan.summary,
      toolCount: plan.toolRequests.length,
      roll: actionResolution?.kind === "rolled" ? { checkId: actionResolution.roll.checkId, total: actionResolution.roll.total, outcome: actionResolution.roll.outcome } : null
    });
    if (actionResolution?.kind === "rolled") {
      db.prepare("DELETE FROM pending_action_checks WHERE campaign_id = ? AND check_id = ?")
        .run(campaign.id, actionResolution.roll.checkId);
    }
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
