import type { DatabaseSync } from "node:sqlite";
import type { PlayerPower, PowerAcquisitionSource, PowerDefinition, VelmoraContent } from "../domain/types.ts";
import { appendEvent, getPlayerCharacter, listPlayerPowers, persistPlayerPower } from "../persistence/database.ts";

export type GrantPlayerPowerInput = {
  powerId: string;
  source: PowerAcquisitionSource;
  playerApproved?: boolean;
};

function campaignTurn(db: DatabaseSync, campaignId: string): number {
  const campaign = db.prepare("SELECT turn FROM campaigns WHERE id = ?").get(campaignId) as { turn: number } | undefined;
  if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
  return campaign.turn;
}

function findPower(content: VelmoraContent, powerId: string): PowerDefinition {
  const power = content.powers.find((candidate) => candidate.id === powerId);
  if (!power) throw new Error(`Unknown power ${powerId}`);
  return power;
}

export function listOwnedPlayerPowers(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string
): Array<PlayerPower & { definition: PowerDefinition }> {
  return listPlayerPowers(db, campaignId).map((power) => ({
    ...power,
    definition: findPower(content, power.powerId)
  }));
}

export function grantPlayerPower(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  input: GrantPlayerPowerInput
): PlayerPower {
  if (!getPlayerCharacter(db, campaignId)) throw new Error("Create the player character before granting a power");
  const definition = findPower(content, input.powerId);
  if (!definition.allowedSources.includes(input.source)) {
    throw new Error(`${definition.name} cannot be acquired from ${input.source}`);
  }
  if (listPlayerPowers(db, campaignId).some((power) => power.powerId === definition.id)) {
    throw new Error(`${definition.name} is already owned`);
  }
  const playerApproved = input.playerApproved === true;
  if (definition.level === 3) {
    if (input.source !== "tear" && input.source !== "void_rift") {
      throw new Error("Level 3 powers must originate from the Tear or a void-rift");
    }
    if (!playerApproved) throw new Error("Level 3 powers require explicit player approval");
  }

  const turn = campaignTurn(db, campaignId);
  const power: PlayerPower = {
    campaignId,
    powerId: definition.id,
    source: input.source,
    playerApproved,
    active: false,
    acquiredTurn: turn,
    activatedTurn: null
  };
  db.exec("BEGIN IMMEDIATE");
  try {
    persistPlayerPower(db, power);
    appendEvent(db, campaignId, turn, "player_power_acquired", {
      powerId: power.powerId,
      source: power.source,
      level: definition.level,
      playerApproved: power.playerApproved
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return listPlayerPowers(db, campaignId).find((candidate) => candidate.powerId === power.powerId)!;
}

export function activateSustainedPower(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  powerId: string
): PlayerPower {
  const definition = findPower(content, powerId);
  if (definition.useType !== "sustained") throw new Error(`${definition.name} is not a sustained power`);
  const powers = listPlayerPowers(db, campaignId);
  const target = powers.find((power) => power.powerId === powerId);
  if (!target) throw new Error(`${definition.name} is not owned by the player`);
  if (target.active) return target;

  const turn = campaignTurn(db, campaignId);
  db.exec("BEGIN IMMEDIATE");
  try {
    const replaced = powers.find((power) => power.active);
    if (replaced) persistPlayerPower(db, { ...replaced, active: false, activatedTurn: null });
    persistPlayerPower(db, { ...target, active: true, activatedTurn: turn });
    appendEvent(db, campaignId, turn, "player_sustained_power_activated", {
      powerId,
      replacedPowerId: replaced?.powerId ?? null
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return listPlayerPowers(db, campaignId).find((power) => power.powerId === powerId)!;
}

export function deactivateSustainedPower(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  powerId: string
): PlayerPower {
  const definition = findPower(content, powerId);
  if (definition.useType !== "sustained") throw new Error(`${definition.name} is not a sustained power`);
  const target = listPlayerPowers(db, campaignId).find((power) => power.powerId === powerId);
  if (!target) throw new Error(`${definition.name} is not owned by the player`);
  if (!target.active) return target;

  const turn = campaignTurn(db, campaignId);
  db.exec("BEGIN IMMEDIATE");
  try {
    persistPlayerPower(db, { ...target, active: false, activatedTurn: null });
    appendEvent(db, campaignId, turn, "player_sustained_power_deactivated", { powerId });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return listPlayerPowers(db, campaignId).find((power) => power.powerId === powerId)!;
}
