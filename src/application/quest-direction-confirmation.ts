import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { PendingQuestDirectionConfirmationView, QuestDirectionInterpretation } from "../domain/types.ts";
import { appendEvent, listQuestInstances } from "../persistence/database.ts";
import { commitQuestDirection } from "./quest-system.ts";

type PendingDirectionRow = {
  campaignId: string;
  confirmationId: string;
  questId: string;
  directionId: string;
  playerInput: string;
  explanation: string;
  createdTurn: number;
};

function pendingRow(db: DatabaseSync, campaignId: string): PendingDirectionRow | undefined {
  return db.prepare(`SELECT campaign_id AS campaignId, confirmation_id AS confirmationId,
    quest_id AS questId, direction_id AS directionId, player_input AS playerInput,
    explanation, created_turn AS createdTurn
    FROM pending_quest_direction_confirmations WHERE campaign_id = ?`).get(campaignId) as PendingDirectionRow | undefined;
}

function toView(db: DatabaseSync, row: PendingDirectionRow): PendingQuestDirectionConfirmationView {
  const quest = listQuestInstances(db, row.campaignId).find((candidate) => candidate.questId === row.questId);
  if (!quest) throw new Error(`Pending direction references unknown quest ${row.questId}`);
  const direction = quest.possibleDirections.find((candidate) => candidate.directionId === row.directionId);
  if (!direction) throw new Error(`Pending direction references unknown option ${row.directionId}`);
  return {
    confirmationId: row.confirmationId,
    questId: row.questId,
    directionId: row.directionId,
    playerInput: row.playerInput,
    explanation: row.explanation,
    questTitle: quest.title,
    directionSummary: direction.summary,
    likelyTradeoff: direction.likelyTradeoff
  };
}

export function getPendingQuestDirectionConfirmation(
  db: DatabaseSync,
  campaignId: string
): PendingQuestDirectionConfirmationView | null {
  const row = pendingRow(db, campaignId);
  return row ? toView(db, row) : null;
}

export function createPendingQuestDirectionConfirmation(
  db: DatabaseSync,
  campaignId: string,
  playerInput: string,
  interpretation: QuestDirectionInterpretation
): PendingQuestDirectionConfirmationView {
  if (pendingRow(db, campaignId)) throw new Error("Resolve the pending quest direction before another action");
  const campaign = db.prepare("SELECT turn FROM campaigns WHERE id = ?").get(campaignId) as { turn: number } | undefined;
  if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
  const quest = listQuestInstances(db, campaignId).find((candidate) => candidate.questId === interpretation.questId);
  if (!quest || quest.visibility !== "player") throw new Error("The interpreted quest is not player-known");
  if (quest.state !== "available" || quest.selectedDirectionId !== null) throw new Error("Only an available uncommitted quest may propose a direction");
  if (!quest.possibleDirections.some((direction) => direction.directionId === interpretation.directionId)) throw new Error("The interpreted direction is not recorded on this quest");
  const input = playerInput.trim();
  const explanation = interpretation.explanation.trim();
  if (input.length < 1 || input.length > 1000) throw new Error("Direction confirmation requires the original player action");
  if (explanation.length < 3 || explanation.length > 400) throw new Error("Direction interpretation requires a concise explanation");
  const digest = createHash("sha256").update(`${campaignId}|${campaign.turn}|${quest.questId}|${interpretation.directionId}|${input}`).digest("hex").slice(0, 16).toUpperCase();
  const confirmationId = `QCONF-${digest}`;
  db.prepare(`INSERT INTO pending_quest_direction_confirmations(
    campaign_id, confirmation_id, quest_id, direction_id, player_input, explanation, created_turn
  ) VALUES(?, ?, ?, ?, ?, ?, ?)`).run(campaignId, confirmationId, quest.questId, interpretation.directionId, input, explanation, campaign.turn);
  return getPendingQuestDirectionConfirmation(db, campaignId)!;
}

export function rejectPendingQuestDirectionConfirmation(
  db: DatabaseSync,
  campaignId: string,
  confirmationId: string
): PendingQuestDirectionConfirmationView {
  const row = pendingRow(db, campaignId);
  if (!row || row.confirmationId !== confirmationId) throw new Error("Unknown pending quest direction confirmation");
  const view = toView(db, row);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM pending_quest_direction_confirmations WHERE campaign_id = ? AND confirmation_id = ?").run(campaignId, confirmationId);
    appendEvent(db, campaignId, row.createdTurn, "quest_direction_rejected", { questId: row.questId, directionId: row.directionId });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return view;
}

export function acceptPendingQuestDirectionConfirmation(
  db: DatabaseSync,
  campaignId: string,
  confirmationId: string
): { confirmation: PendingQuestDirectionConfirmationView; playerInput: string } {
  const row = pendingRow(db, campaignId);
  if (!row || row.confirmationId !== confirmationId) throw new Error("Unknown pending quest direction confirmation");
  const confirmation = toView(db, row);
  commitQuestDirection(db, campaignId, row.questId, row.directionId);
  db.prepare("DELETE FROM pending_quest_direction_confirmations WHERE campaign_id = ? AND confirmation_id = ?").run(campaignId, confirmationId);
  return { confirmation, playerInput: row.playerInput };
}
