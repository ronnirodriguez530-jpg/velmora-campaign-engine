import { randomInt } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { OpeningConvergenceProposal, OpeningState, PlayerOpeningState, VelmoraContent } from "../domain/types.ts";

type OpeningRow = {
  campaignId: string;
  phase: OpeningState["phase"];
  spawnRoll: number | null;
  spawnId: string | null;
  convergenceRoll: number | null;
  convergenceHookId: string | null;
  explorationTurns: number;
  readinessTurn: number | null;
  readinessReason: string | null;
};

export function getOpeningState(db: DatabaseSync, campaignId: string): OpeningState {
  db.prepare("INSERT OR IGNORE INTO opening_state(campaign_id, phase, exploration_turns) VALUES(?, 'awaiting_roll', 0)").run(campaignId);
  const row = db.prepare(`SELECT campaign_id AS campaignId, phase, spawn_roll AS spawnRoll,
      spawn_id AS spawnId, convergence_roll AS convergenceRoll,
      convergence_hook_id AS convergenceHookId, exploration_turns AS explorationTurns,
      readiness_turn AS readinessTurn, readiness_reason AS readinessReason
    FROM opening_state WHERE campaign_id = ?`).get(campaignId) as OpeningRow | undefined;
  if (!row) throw new Error(`Campaign ${campaignId} has no opening state`);
  return row;
}

export function getPlayerOpeningState(db: DatabaseSync, content: VelmoraContent, campaignId: string): PlayerOpeningState {
  const state = getOpeningState(db, campaignId);
  const spawn = state.spawnId ? content.openingSpawns.find((entry) => entry.id === state.spawnId) ?? null : null;
  return {
    campaignId: state.campaignId,
    phase: state.phase === "awaiting_roll" ? "awaiting_roll" : "exploration",
    spawnRoll: state.spawnRoll,
    spawnId: state.spawnId,
    explorationTurns: state.explorationTurns,
    spawn
  };
}

export function rollOpeningStart(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  rollD6: () => number = () => randomInt(1, 7)
): PlayerOpeningState {
  const existing = getOpeningState(db, campaignId);
  if (existing.phase !== "awaiting_roll") return getPlayerOpeningState(db, content, campaignId);
  const spawnRoll = rollD6();
  const convergenceRoll = rollD6();
  if (![spawnRoll, convergenceRoll].every((roll) => Number.isInteger(roll) && roll >= 1 && roll <= 6)) {
    throw new Error("Opening d6 source returned an invalid result");
  }
  const spawn = content.openingSpawns.find((entry) => entry.roll === spawnRoll);
  const hook = content.openingConvergenceHooks.find((entry) => entry.roll === convergenceRoll);
  if (!spawn || !hook) throw new Error("Opening d6 content is incomplete");
  db.prepare(`UPDATE opening_state SET phase = 'exploration', spawn_roll = ?, spawn_id = ?,
      convergence_roll = ?, convergence_hook_id = ? WHERE campaign_id = ? AND phase = 'awaiting_roll'`)
    .run(spawnRoll, spawn.id, convergenceRoll, hook.id, campaignId);
  return getPlayerOpeningState(db, content, campaignId);
}

export function validateOpeningConvergenceProposal(
  db: DatabaseSync,
  campaignId: string,
  proposal: OpeningConvergenceProposal
): void {
  const state = getOpeningState(db, campaignId);
  if (state.phase !== "exploration") throw new Error("Opening convergence can only be proposed during exploration");
  if (state.explorationTurns + 1 < 2) throw new Error("The opening requires at least two meaningful exploratory scenes");
  if (!(["player_entered_witnessing_position", "public_address_reached_player", "established_duty_placed_player_at_address"] as const).includes(proposal.evidence)) {
    throw new Error("Opening convergence requires approved witnessing evidence");
  }
  if (proposal.reason.trim().length < 12 || proposal.reason.length > 240) {
    throw new Error("Opening convergence requires a specific 12-240 character reason");
  }
}

export function recordOpeningExplorationTurn(
  db: DatabaseSync,
  campaignId: string,
  turn: number,
  proposal: OpeningConvergenceProposal | null = null
): OpeningState {
  const state = getOpeningState(db, campaignId);
  if (state.phase !== "exploration") return state;
  if (proposal) validateOpeningConvergenceProposal(db, campaignId, proposal);
  const nextCount = state.explorationTurns + 1;
  const ready = nextCount >= 4 || (nextCount >= 2 && proposal !== null);
  const reason = proposal?.reason.trim() ?? (ready
    ? "The hidden convergence hook has reached the player's situation after four meaningful exploratory scenes."
    : null);
  db.prepare(`UPDATE opening_state SET exploration_turns = ?, phase = ?, readiness_turn = ?, readiness_reason = ?
      WHERE campaign_id = ? AND phase = 'exploration'`)
    .run(nextCount, ready ? "convergence_ready" : "exploration", ready ? turn : null, reason, campaignId);
  return getOpeningState(db, campaignId);
}
