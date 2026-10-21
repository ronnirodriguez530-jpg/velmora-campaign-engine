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
  strikeTurn: number | null;
  strikeWitnessedTurn: number | null;
  crisisTurn: number | null;
  crisisPresentedTurn: number | null;
  firstQuestId: string | null;
};

export function getOpeningState(db: DatabaseSync, campaignId: string): OpeningState {
  db.prepare("INSERT OR IGNORE INTO opening_state(campaign_id, phase, exploration_turns) VALUES(?, 'awaiting_roll', 0)").run(campaignId);
  const row = db.prepare(`SELECT campaign_id AS campaignId, phase, spawn_roll AS spawnRoll,
      spawn_id AS spawnId, convergence_roll AS convergenceRoll,
      convergence_hook_id AS convergenceHookId, exploration_turns AS explorationTurns,
      readiness_turn AS readinessTurn, readiness_reason AS readinessReason,
      strike_turn AS strikeTurn, strike_witnessed_turn AS strikeWitnessedTurn,
      crisis_turn AS crisisTurn, crisis_presented_turn AS crisisPresentedTurn,
      first_quest_id AS firstQuestId
    FROM opening_state WHERE campaign_id = ?`).get(campaignId) as OpeningRow | undefined;
  if (!row) throw new Error(`Campaign ${campaignId} has no opening state`);
  return row;
}

export function getPlayerOpeningState(db: DatabaseSync, content: VelmoraContent, campaignId: string): PlayerOpeningState {
  const state = getOpeningState(db, campaignId);
  const spawn = state.spawnId ? content.openingSpawns.find((entry) => entry.id === state.spawnId) ?? null : null;
  return {
    campaignId: state.campaignId,
    phase: state.phase === "awaiting_roll" ? "awaiting_roll"
      : state.phase === "strike" ? "strike"
      : state.phase === "strike_witnessed" ? "strike_witnessed"
      : state.phase === "crisis" ? "crisis"
      : state.phase === "crisis_presented" ? "crisis_presented"
      : "exploration",
    spawnRoll: state.spawnRoll,
    spawnId: state.spawnId,
    explorationTurns: state.explorationTurns,
    firstQuestId: state.firstQuestId,
    spawn
  };
}

export function beginOpeningStrike(db: DatabaseSync, campaignId: string, turn: number): OpeningState {
  const state = getOpeningState(db, campaignId);
  if (["strike", "strike_witnessed", "crisis", "crisis_presented"].includes(state.phase)) return state;
  if (state.phase !== "convergence_ready") throw new Error("The First Speaker strike cannot begin before opening convergence is ready");
  db.prepare("UPDATE opening_state SET phase = 'strike', strike_turn = ? WHERE campaign_id = ? AND phase = 'convergence_ready'")
    .run(turn, campaignId);
  return getOpeningState(db, campaignId);
}

export function markOpeningStrikeWitnessed(db: DatabaseSync, campaignId: string, turn: number): OpeningState {
  const state = getOpeningState(db, campaignId);
  if (state.phase === "strike_witnessed") return state;
  if (state.phase !== "strike") throw new Error("The First Speaker strike cannot be witnessed before it begins");
  db.prepare("UPDATE opening_state SET phase = 'strike_witnessed', strike_witnessed_turn = ? WHERE campaign_id = ? AND phase = 'strike'")
    .run(turn, campaignId);
  return getOpeningState(db, campaignId);
}

export function revealOpeningCrisis(db: DatabaseSync, campaignId: string, turn: number, firstQuestId: string): OpeningState {
  const state = getOpeningState(db, campaignId);
  if (state.phase === "crisis" || state.phase === "crisis_presented") return state;
  if (state.phase !== "strike_witnessed") throw new Error("The opening crisis cannot be revealed before the First Speaker strike is witnessed");
  if (state.strikeWitnessedTurn === null || turn <= state.strikeWitnessedTurn) {
    throw new Error("The opening crisis must begin in a later meaningful scene");
  }
  if (!/^QUEST-[A-Z0-9][A-Z0-9-]{2,95}$/.test(firstQuestId)) throw new Error("The opening crisis requires a valid generated quest ID");
  db.prepare(`UPDATE opening_state SET phase = 'crisis', crisis_turn = ?, first_quest_id = ?
      WHERE campaign_id = ? AND phase = 'strike_witnessed'`)
    .run(turn, firstQuestId, campaignId);
  return getOpeningState(db, campaignId);
}

export function markOpeningCrisisPresented(db: DatabaseSync, campaignId: string, turn: number): OpeningState {
  const state = getOpeningState(db, campaignId);
  if (state.phase === "crisis_presented") return state;
  if (state.phase !== "crisis") throw new Error("The opening crisis cannot be presented before it is revealed");
  db.prepare(`UPDATE opening_state SET phase = 'crisis_presented', crisis_presented_turn = ?
      WHERE campaign_id = ? AND phase = 'crisis'`)
    .run(turn, campaignId);
  return getOpeningState(db, campaignId);
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
