import { randomInt, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { CombatEncounter, EncounterCombatant, EncounterMode, EncounterResolution, RollOutcome } from "../domain/types.ts";
import { appendEvent, getActiveCombatEncounter, getPlayerCharacter, persistCombatEncounter, persistPlayerCharacter } from "../persistence/database.ts";

const MODE_LIMITS: Record<EncounterMode, { hostiles: number; total: number }> = {
  quick: { hostiles: 2, total: 4 },
  standard: { hostiles: 4, total: 7 },
  set_piece: { hostiles: 6, total: 10 }
};

export type EncounterParticipantInput = {
  combatantId: string;
  name: string;
  side: "hostile" | "support";
  maxHp: number;
  defense: number;
  initiativeModifier: number;
  attackBonus: number;
  damageDie: 4 | 6 | 8 | 10 | 12;
};

export type StartEncounterInput = {
  mode: EncounterMode;
  objective: string;
  stakes: string;
  participants: EncounterParticipantInput[];
  availableExits: Array<"escape" | "surrender" | "negotiation">;
};

function assertText(value: string, label: string, maximum: number): string {
  const text = value.trim();
  if (!text || text.length > maximum) throw new Error(`${label} must be 1-${maximum} characters`);
  return text;
}

function validateParticipant(participant: EncounterParticipantInput): void {
  assertText(participant.combatantId, "Combatant ID", 80);
  assertText(participant.name, "Combatant name", 80);
  if (!Number.isInteger(participant.maxHp) || participant.maxHp < 1 || participant.maxHp > 200) throw new Error("Combatant HP must be 1-200");
  if (!Number.isInteger(participant.defense) || participant.defense < 5 || participant.defense > 30) throw new Error("Combatant Defense must be 5-30");
  if (!Number.isInteger(participant.initiativeModifier) || participant.initiativeModifier < -5 || participant.initiativeModifier > 10) throw new Error("Initiative modifier must be -5 to 10");
  if (!Number.isInteger(participant.attackBonus) || participant.attackBonus < -5 || participant.attackBonus > 15) throw new Error("Attack bonus must be -5 to 15");
  if (![4, 6, 8, 10, 12].includes(participant.damageDie)) throw new Error("Damage die must be d4, d6, d8, d10, or d12");
}

function initiativeOrder(combatants: EncounterCombatant[]): EncounterCombatant[] {
  return combatants.sort((left, right) => right.initiativeTotal - left.initiativeTotal || right.initiativeModifier - left.initiativeModifier || left.combatantId.localeCompare(right.combatantId));
}

export function startCombatEncounter(
  db: DatabaseSync,
  campaignId: string,
  input: StartEncounterInput,
  rollD20: () => number = () => randomInt(1, 21)
): CombatEncounter {
  if (getActiveCombatEncounter(db, campaignId)) throw new Error("Resolve the active encounter before starting another");
  const character = getPlayerCharacter(db, campaignId);
  if (!character) throw new Error("Create the player character before starting an encounter");
  if (character.currentHp === 0) throw new Error("The defeated player character must recover before starting an encounter");
  const campaign = db.prepare("SELECT turn FROM campaigns WHERE id = ?").get(campaignId) as { turn: number } | undefined;
  if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
  if (!Object.hasOwn(MODE_LIMITS, input.mode)) throw new Error("Unknown encounter mode");
  if (!input.participants.some((participant) => participant.side === "hostile")) throw new Error("An encounter requires at least one hostile participant");
  input.participants.forEach(validateParticipant);
  const ids = ["PC-001", ...input.participants.map((participant) => participant.combatantId)];
  if (new Set(ids).size !== ids.length) throw new Error("Encounter combatant IDs must be unique");
  const limits = MODE_LIMITS[input.mode];
  if (input.participants.filter((participant) => participant.side === "hostile").length > limits.hostiles || input.participants.length + 1 > limits.total) {
    throw new Error(`${input.mode} encounter exceeds its bounded participant limit`);
  }
  const exits = [...new Set(input.availableExits)];
  if (!exits.every((exit) => ["escape", "surrender", "negotiation"].includes(exit))) throw new Error("Unknown encounter exit");
  const makeRoll = (): number => {
    const roll = rollD20();
    if (!Number.isInteger(roll) || roll < 1 || roll > 20) throw new Error("Initiative source returned an invalid d20 result");
    return roll;
  };
  const playerRoll = makeRoll();
  const playerAttackAbility = Math.max(character.abilityModifiers.strength, character.abilityModifiers.dexterity);
  const combatants: EncounterCombatant[] = [{
    combatantId: character.characterId,
    name: character.name,
    side: "player",
    maxHp: character.maxHp,
    currentHp: character.currentHp,
    defense: character.defense,
    initiativeModifier: character.abilityModifiers.dexterity,
    initiativeRoll: playerRoll,
    initiativeTotal: playerRoll + character.abilityModifiers.dexterity,
    attackBonus: playerAttackAbility + character.proficiencyBonus,
    damageDie: 6,
    status: character.currentHp === 0 ? "defeated" : "active"
  }, ...input.participants.map((participant) => {
    const roll = makeRoll();
    return {
      ...participant,
      currentHp: participant.maxHp,
      initiativeRoll: roll,
      initiativeTotal: roll + participant.initiativeModifier,
      status: "active" as const
    };
  })];
  const ordered = initiativeOrder(combatants);
  const encounter: CombatEncounter = {
    campaignId,
    encounterId: `ENC-${randomUUID()}`,
    mode: input.mode,
    objective: assertText(input.objective, "Encounter objective", 240),
    stakes: assertText(input.stakes, "Encounter stakes", 300),
    status: "active",
    resolution: null,
    round: 1,
    currentTurnIndex: 0,
    combatants: ordered,
    availableExits: exits,
    createdTurn: campaign.turn,
    updatedTurn: campaign.turn
  };
  db.exec("BEGIN IMMEDIATE");
  try {
    persistCombatEncounter(db, encounter);
    appendEvent(db, campaignId, campaign.turn, "combat_encounter_started", { encounterId: encounter.encounterId, mode: encounter.mode, combatantIds: ordered.map((combatant) => combatant.combatantId) });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return encounter;
}

function activeEncounter(db: DatabaseSync, campaignId: string): CombatEncounter {
  const encounter = getActiveCombatEncounter(db, campaignId);
  if (!encounter) throw new Error("No active encounter exists");
  return encounter;
}

function campaignTurn(db: DatabaseSync, campaignId: string): number {
  const campaign = db.prepare("SELECT turn FROM campaigns WHERE id = ?").get(campaignId) as { turn: number } | undefined;
  if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
  return campaign.turn;
}

function currentActor(encounter: CombatEncounter): EncounterCombatant {
  const actor = encounter.combatants[encounter.currentTurnIndex];
  if (!actor || actor.status !== "active") throw new Error("Encounter turn order is invalid");
  return actor;
}

function advanceTurn(encounter: CombatEncounter): void {
  const start = encounter.currentTurnIndex;
  do {
    encounter.currentTurnIndex = (encounter.currentTurnIndex + 1) % encounter.combatants.length;
    if (encounter.currentTurnIndex === 0) encounter.round += 1;
    if (encounter.combatants[encounter.currentTurnIndex]?.status === "active") return;
  } while (encounter.currentTurnIndex !== start);
}

function finishIfDecided(encounter: CombatEncounter): EncounterResolution | null {
  const player = encounter.combatants.find((combatant) => combatant.side === "player")!;
  if (player.status === "defeated") return "defeat";
  if (!encounter.combatants.some((combatant) => combatant.side === "hostile" && combatant.status === "active")) return "victory";
  return null;
}

function commitEncounter(db: DatabaseSync, encounter: CombatEncounter, resolution: EncounterResolution | null): void {
  if (resolution) {
    encounter.status = "resolved";
    encounter.resolution = resolution;
  } else {
    advanceTurn(encounter);
  }
  persistCombatEncounter(db, encounter);
}

export function resolveCombatAttack(
  db: DatabaseSync,
  campaignId: string,
  actorId: string,
  targetId: string,
  rollD20: () => number = () => randomInt(1, 21),
  rollDamage: (sides: number) => number = (sides) => randomInt(1, sides + 1)
): { encounter: CombatEncounter; hit: boolean; critical: boolean; attackRoll: number; attackTotal: number; damage: number } {
  const encounter = activeEncounter(db, campaignId);
  encounter.updatedTurn = campaignTurn(db, campaignId);
  const actor = currentActor(encounter);
  if (actor.combatantId !== actorId) throw new Error(`It is ${actor.name}'s turn`);
  const target = encounter.combatants.find((combatant) => combatant.combatantId === targetId);
  if (!target || target.status !== "active") throw new Error("Attack target must be an active combatant");
  if (actor.side === target.side || (actor.side !== "hostile" && target.side === "support") || (actor.side === "support" && target.side === "player")) throw new Error("Attack target must be on an opposing side");
  const attackRoll = rollD20();
  if (!Number.isInteger(attackRoll) || attackRoll < 1 || attackRoll > 20) throw new Error("Attack source returned an invalid d20 result");
  const attackTotal = attackRoll + actor.attackBonus;
  const critical = attackRoll === 20;
  const hit = critical || (attackRoll !== 1 && attackTotal >= target.defense);
  let damage = 0;
  if (hit) {
    const first = rollDamage(actor.damageDie);
    const second = critical ? rollDamage(actor.damageDie) : 0;
    if (![first, second].every((roll) => Number.isInteger(roll)) || first < 1 || first > actor.damageDie || second < 0 || second > actor.damageDie) throw new Error("Damage source returned an invalid result");
    damage = first + second;
    target.currentHp = Math.max(0, target.currentHp - damage);
    if (target.currentHp === 0) target.status = "defeated";
  }
  const resolution = finishIfDecided(encounter);
  db.exec("BEGIN IMMEDIATE");
  try {
    if (target.side === "player") {
      const character = getPlayerCharacter(db, campaignId)!;
      persistPlayerCharacter(db, { ...character, currentHp: target.currentHp, updatedTurn: encounter.updatedTurn });
    }
    commitEncounter(db, encounter, resolution);
    appendEvent(db, campaignId, encounter.updatedTurn, "combat_attack_resolved", { encounterId: encounter.encounterId, actorId, targetId, attackRoll, attackTotal, hit, critical, damage, resolution });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { encounter, hit, critical, attackRoll, attackTotal, damage };
}

export function resolveCombatExit(
  db: DatabaseSync,
  campaignId: string,
  actorId: "PC-001",
  route: "escape" | "surrender" | "negotiation",
  outcome: RollOutcome | null
): CombatEncounter {
  const encounter = activeEncounter(db, campaignId);
  encounter.updatedTurn = campaignTurn(db, campaignId);
  const actor = currentActor(encounter);
  if (actor.combatantId !== actorId) throw new Error(`It is ${actor.name}'s turn`);
  if (!encounter.availableExits.includes(route)) throw new Error(`${route} is not credible in this encounter`);
  if (route !== "surrender" && outcome === null) throw new Error(`${route} requires a resolved action check`);
  const succeeded = route === "surrender" || outcome === "critical_success" || outcome === "success" || outcome === "success_with_cost";
  db.exec("BEGIN IMMEDIATE");
  try {
    if (succeeded) {
      actor.status = route === "surrender" ? "surrendered" : "withdrawn";
      const resolution: EncounterResolution = route === "escape" ? "escaped" : route === "negotiation" ? "negotiated" : "surrendered";
      commitEncounter(db, encounter, resolution);
    } else {
      advanceTurn(encounter);
      persistCombatEncounter(db, encounter);
    }
    appendEvent(db, campaignId, encounter.updatedTurn, "combat_exit_resolved", { encounterId: encounter.encounterId, route, outcome, succeeded });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return encounter;
}
