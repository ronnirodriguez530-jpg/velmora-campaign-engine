import { randomInt } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { OpeningState, PlayerOpeningState, VelmoraContent } from "../domain/types.ts";

type OpeningRow = {
  campaignId: string;
  phase: OpeningState["phase"];
  spawnRoll: number | null;
  spawnId: string | null;
  convergenceRoll: number | null;
  convergenceHookId: string | null;
  explorationTurns: number;
};

export function getOpeningState(db: DatabaseSync, campaignId: string): OpeningState {
  db.prepare("INSERT OR IGNORE INTO opening_state(campaign_id, phase, exploration_turns) VALUES(?, 'awaiting_roll', 0)").run(campaignId);
  const row = db.prepare(`SELECT campaign_id AS campaignId, phase, spawn_roll AS spawnRoll,
      spawn_id AS spawnId, convergence_roll AS convergenceRoll,
      convergence_hook_id AS convergenceHookId, exploration_turns AS explorationTurns
    FROM opening_state WHERE campaign_id = ?`).get(campaignId) as OpeningRow | undefined;
  if (!row) throw new Error(`Campaign ${campaignId} has no opening state`);
  return row;
}

export function getPlayerOpeningState(db: DatabaseSync, content: VelmoraContent, campaignId: string): PlayerOpeningState {
  const state = getOpeningState(db, campaignId);
  const spawn = state.spawnId ? content.openingSpawns.find((entry) => entry.id === state.spawnId) ?? null : null;
  return {
    campaignId: state.campaignId,
    phase: state.phase,
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

export function recordOpeningExplorationTurn(db: DatabaseSync, campaignId: string): void {
  db.prepare("UPDATE opening_state SET exploration_turns = exploration_turns + 1 WHERE campaign_id = ? AND phase = 'exploration'").run(campaignId);
}
