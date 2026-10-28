import { randomInt, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { CombatEncounter, CombatTurnBudget, CombatTurnSlot, EncounterCombatant, EncounterMode, EncounterResolution, PendingCombatRoll, RollOutcome } from "../domain/types.ts";
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

export type CombatOptionView = {
  optionId: string;
  category: "fight" | "action" | "powers" | "bag" | "system";
  label: string;
  slotCosts: CombatTurnSlot[];
  available: boolean;
  unavailableReason: string | null;
  targetIds: string[];
};

export type PlayerCombatTurnView = {
  encounterId: string;
  round: number;
  currentActorId: string;
  currentActorName: string;
  isPlayerTurn: boolean;
  slots: CombatTurnBudget["slots"] | null;
  pendingRoll: PendingCombatRoll | null;
  options: CombatOptionView[];
};

export type PlayerCombatRollResult = {
  phase: "attack" | "damage";
  rollId: string;
  dice: number[];
  attackTotal: number | null;
  hit: boolean | null;
  critical: boolean;
  damage: number;
  resolution: EncounterResolution | null;
  pendingRoll: PendingCombatRoll | null;
  encounter: CombatEncounter;
};

const FRESH_PLAYER_SLOTS: CombatTurnBudget["slots"] = {
  power: "available",
  action: "available",
  movement: "available",
  minor_interaction: "available"
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
    turnBudget: ordered[0]?.side === "player" ? { actorId: "PC-001", round: 1, slots: { ...FRESH_PLAYER_SLOTS } } : null,
    pendingPlayerRoll: null,
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

function ensurePlayerTurnBudget(encounter: CombatEncounter): CombatTurnBudget | null {
  const actor = currentActor(encounter);
  if (actor.side !== "player") {
    encounter.turnBudget = null;
    return null;
  }
  if (!encounter.turnBudget || encounter.turnBudget.actorId !== actor.combatantId || encounter.turnBudget.round !== encounter.round) {
    encounter.turnBudget = { actorId: "PC-001", round: encounter.round, slots: { ...FRESH_PLAYER_SLOTS } };
  }
  return encounter.turnBudget;
}

function requirePlayerSlots(encounter: CombatEncounter, slotCosts: CombatTurnSlot[]): CombatTurnBudget {
  const budget = ensurePlayerTurnBudget(encounter);
  if (!budget) throw new Error("Only the player turn uses selectable combat slots");
  const unavailable = slotCosts.find((slot) => budget.slots[slot] !== "available");
  if (unavailable) {
    const state = budget.slots[unavailable];
    throw new Error(state === "reserved"
      ? `The ${unavailable.replace("_", " ")} slot is reserved by a pending roll`
      : `The ${unavailable.replace("_", " ")} slot has already been spent`);
  }
  return budget;
}

function reservePlayerSlots(encounter: CombatEncounter, slotCosts: CombatTurnSlot[]): void {
  const budget = requirePlayerSlots(encounter, slotCosts);
  for (const slot of slotCosts) budget.slots[slot] = "reserved";
}

function spendPlayerSlots(encounter: CombatEncounter, slotCosts: CombatTurnSlot[]): void {
  const budget = ensurePlayerTurnBudget(encounter);
  if (!budget) throw new Error("Only the player turn uses selectable combat slots");
  const invalid = slotCosts.find((slot) => budget.slots[slot] !== "available" && budget.slots[slot] !== "reserved");
  if (invalid) throw new Error(`The ${invalid.replace("_", " ")} slot has already been spent`);
  for (const slot of slotCosts) budget.slots[slot] = "spent";
}

function advanceTurn(encounter: CombatEncounter): void {
  const start = encounter.currentTurnIndex;
  encounter.pendingPlayerRoll = null;
  do {
    encounter.currentTurnIndex = (encounter.currentTurnIndex + 1) % encounter.combatants.length;
    if (encounter.currentTurnIndex === 0) encounter.round += 1;
    if (encounter.combatants[encounter.currentTurnIndex]?.status === "active") {
      encounter.turnBudget = null;
      ensurePlayerTurnBudget(encounter);
      return;
    }
  } while (encounter.currentTurnIndex !== start);
}

function finishIfDecided(encounter: CombatEncounter): EncounterResolution | null {
  const player = encounter.combatants.find((combatant) => combatant.side === "player")!;
  if (player.status === "defeated") return "defeat";
  if (!encounter.combatants.some((combatant) => combatant.side === "hostile" && combatant.status === "active")) return "victory";
  return null;
}

function commitEncounter(db: DatabaseSync, encounter: CombatEncounter, resolution: EncounterResolution | null, endActorTurn = true): void {
  if (resolution) {
    encounter.status = "resolved";
    encounter.resolution = resolution;
  } else if (endActorTurn) {
    advanceTurn(encounter);
  }
  persistCombatEncounter(db, encounter);
}

export function getPlayerCombatTurnView(db: DatabaseSync, campaignId: string): PlayerCombatTurnView {
  const encounter = activeEncounter(db, campaignId);
  const actor = currentActor(encounter);
  const isPlayerTurn = actor.side === "player";
  const budget = isPlayerTurn ? ensurePlayerTurnBudget(encounter) : null;
  const actionAvailable = budget?.slots.action === "available";
  const opposingTargets = encounter.combatants
    .filter((combatant) => combatant.status === "active" && combatant.side === "hostile")
    .map((combatant) => combatant.combatantId);
  const turnReason = isPlayerTurn ? null : `It is ${actor.name}'s turn`;
  const actionReason = turnReason
    ?? (encounter.pendingPlayerRoll ? `Complete the pending ${encounter.pendingPlayerRoll.phase} roll` : null)
    ?? (actionAvailable ? null : "The action slot has already been spent");
  const options: CombatOptionView[] = [{
    optionId: "fight.basic_attack",
    category: "fight",
    label: "Attack",
    slotCosts: ["action"],
    available: isPlayerTurn && actionAvailable && opposingTargets.length > 0,
    unavailableReason: actionReason ?? (opposingTargets.length === 0 ? "No active hostile target remains" : null),
    targetIds: opposingTargets
  }, ...encounter.availableExits.map((route): CombatOptionView => ({
    optionId: `action.${route}`,
    category: "action",
    label: route[0]!.toUpperCase() + route.slice(1),
    slotCosts: ["action"],
    available: isPlayerTurn && actionAvailable,
    unavailableReason: actionReason,
    targetIds: []
  })), {
    optionId: "system.end_turn",
    category: "system",
    label: "End Turn",
    slotCosts: [],
    available: isPlayerTurn,
    unavailableReason: turnReason,
    targetIds: []
  }];
  return {
    encounterId: encounter.encounterId,
    round: encounter.round,
    currentActorId: actor.combatantId,
    currentActorName: actor.name,
    isPlayerTurn,
    slots: budget ? { ...budget.slots } : null,
    pendingRoll: encounter.pendingPlayerRoll ?? null,
    options
  };
}

export function endPlayerCombatTurn(db: DatabaseSync, campaignId: string): CombatEncounter {
  const encounter = activeEncounter(db, campaignId);
  encounter.updatedTurn = campaignTurn(db, campaignId);
  const actor = currentActor(encounter);
  if (actor.side !== "player") throw new Error(`It is ${actor.name}'s turn`);
  if (encounter.pendingPlayerRoll) throw new Error(`Complete the pending ${encounter.pendingPlayerRoll.phase} roll before ending the turn`);
  ensurePlayerTurnBudget(encounter);
  db.exec("BEGIN IMMEDIATE");
  try {
    const spentSlots = Object.entries(encounter.turnBudget!.slots)
      .filter(([, state]) => state === "spent")
      .map(([slot]) => slot);
    advanceTurn(encounter);
    persistCombatEncounter(db, encounter);
    appendEvent(db, campaignId, encounter.updatedTurn, "combat_player_turn_ended", { encounterId: encounter.encounterId, actorId: actor.combatantId, spentSlots });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return encounter;
}

function requireAttackTarget(encounter: CombatEncounter, actor: EncounterCombatant, targetId: string): EncounterCombatant {
  const target = encounter.combatants.find((combatant) => combatant.combatantId === targetId);
  if (!target || target.status !== "active") throw new Error("Attack target must be an active combatant");
  if (actor.side === target.side || (actor.side !== "hostile" && target.side === "support") || (actor.side === "support" && target.side === "player")) {
    throw new Error("Attack target must be on an opposing side");
  }
  return target;
}

export function beginPlayerCombatAttack(db: DatabaseSync, campaignId: string, targetId: string): PendingCombatRoll {
  const encounter = activeEncounter(db, campaignId);
  encounter.updatedTurn = campaignTurn(db, campaignId);
  const actor = currentActor(encounter);
  if (actor.side !== "player" || actor.combatantId !== "PC-001") throw new Error(`It is ${actor.name}'s turn`);
  if (encounter.pendingPlayerRoll) throw new Error(`Complete the pending ${encounter.pendingPlayerRoll.phase} roll before selecting another combat action`);
  requirePlayerSlots(encounter, ["action"]);
  const target = requireAttackTarget(encounter, actor, targetId);
  reservePlayerSlots(encounter, ["action"]);
  const pending: PendingCombatRoll = {
    rollId: `COMBAT-ROLL-${randomUUID()}`,
    phase: "attack",
    actorId: "PC-001",
    targetId: target.combatantId,
    actorName: actor.name,
    targetName: target.name,
    attackModifier: actor.attackBonus,
    targetDefense: target.defense,
    damageDie: actor.damageDie,
    damageDice: 1,
    attackRoll: null,
    attackTotal: null,
    critical: false,
    createdTurn: encounter.updatedTurn
  };
  encounter.pendingPlayerRoll = pending;
  db.exec("BEGIN IMMEDIATE");
  try {
    persistCombatEncounter(db, encounter);
    appendEvent(db, campaignId, encounter.updatedTurn, "combat_attack_roll_requested", {
      encounterId: encounter.encounterId,
      rollId: pending.rollId,
      actorId: actor.combatantId,
      targetId: target.combatantId,
      attackModifier: actor.attackBonus,
      targetDefense: target.defense,
      slotCost: "action"
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return pending;
}

export function rollPendingPlayerCombat(
  db: DatabaseSync,
  campaignId: string,
  rollId: string,
  rollD20: () => number = () => randomInt(1, 21),
  rollDamage: (sides: number) => number = (sides) => randomInt(1, sides + 1)
): PlayerCombatRollResult {
  const encounter = activeEncounter(db, campaignId);
  encounter.updatedTurn = campaignTurn(db, campaignId);
  const actor = currentActor(encounter);
  if (actor.side !== "player" || actor.combatantId !== "PC-001") throw new Error(`It is ${actor.name}'s turn`);
  const pending = encounter.pendingPlayerRoll;
  if (!pending || pending.rollId !== rollId) throw new Error("That combat roll is not pending");
  const target = requireAttackTarget(encounter, actor, pending.targetId);

  if (pending.phase === "attack") {
    const die = rollD20();
    if (!Number.isInteger(die) || die < 1 || die > 20) throw new Error("Attack source returned an invalid d20 result");
    const attackTotal = die + pending.attackModifier;
    const critical = die === 20;
    const hit = critical || (die !== 1 && attackTotal >= pending.targetDefense);
    const nextPending: PendingCombatRoll | null = hit ? {
      ...pending,
      rollId: `COMBAT-ROLL-${randomUUID()}`,
      phase: "damage",
      damageDice: critical ? 2 : 1,
      attackRoll: die,
      attackTotal,
      critical
    } : null;
    if (hit) encounter.pendingPlayerRoll = nextPending;
    else {
      encounter.pendingPlayerRoll = null;
      spendPlayerSlots(encounter, ["action"]);
    }
    db.exec("BEGIN IMMEDIATE");
    try {
      persistCombatEncounter(db, encounter);
      appendEvent(db, campaignId, encounter.updatedTurn, "combat_attack_roll_resolved", {
        encounterId: encounter.encounterId,
        rollId,
        actorId: actor.combatantId,
        targetId: target.combatantId,
        attackRoll: die,
        attackModifier: pending.attackModifier,
        attackTotal,
        targetDefense: pending.targetDefense,
        hit,
        critical,
        nextRollId: nextPending?.rollId ?? null
      });
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return { phase: "attack", rollId, dice: [die], attackTotal, hit, critical, damage: 0, resolution: null, pendingRoll: nextPending, encounter };
  }

  const dice = Array.from({ length: pending.damageDice }, () => rollDamage(pending.damageDie));
  if (!dice.every((die) => Number.isInteger(die) && die >= 1 && die <= pending.damageDie)) throw new Error("Damage source returned an invalid result");
  const damage = dice.reduce((total, die) => total + die, 0);
  target.currentHp = Math.max(0, target.currentHp - damage);
  if (target.currentHp === 0) target.status = "defeated";
  encounter.pendingPlayerRoll = null;
  spendPlayerSlots(encounter, ["action"]);
  const resolution = finishIfDecided(encounter);
  db.exec("BEGIN IMMEDIATE");
  try {
    commitEncounter(db, encounter, resolution, false);
    appendEvent(db, campaignId, encounter.updatedTurn, "combat_damage_roll_resolved", {
      encounterId: encounter.encounterId,
      rollId,
      actorId: actor.combatantId,
      targetId: target.combatantId,
      damageDie: pending.damageDie,
      dice,
      damage,
      critical: pending.critical,
      targetHp: target.currentHp,
      resolution
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return {
    phase: "damage",
    rollId,
    dice,
    attackTotal: pending.attackTotal,
    hit: true,
    critical: pending.critical,
    damage,
    resolution,
    pendingRoll: null,
    encounter
  };
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
  if (actor.side === "player") throw new Error("Player attacks require a player-clicked combat roll");
  const target = requireAttackTarget(encounter, actor, targetId);
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
  requirePlayerSlots(encounter, ["action"]);
  if (!encounter.availableExits.includes(route)) throw new Error(`${route} is not credible in this encounter`);
  if (route !== "surrender" && outcome === null) throw new Error(`${route} requires a resolved action check`);
  const succeeded = route === "surrender" || outcome === "critical_success" || outcome === "success" || outcome === "success_with_cost";
  spendPlayerSlots(encounter, ["action"]);
  db.exec("BEGIN IMMEDIATE");
  try {
    if (succeeded) {
      actor.status = route === "surrender" ? "surrendered" : "withdrawn";
      const resolution: EncounterResolution = route === "escape" ? "escaped" : route === "negotiation" ? "negotiated" : "surrendered";
      commitEncounter(db, encounter, resolution);
    } else {
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
