import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { endPlayerCombatTurn, getPlayerCombatTurnView, resolveCombatAttack, resolveCombatExit, startCombatEncounter, type StartEncounterInput } from "../src/application/combat-system.ts";
import { createPlayerCharacter, type PlayerCharacterInput } from "../src/application/player-character.ts";
import { captureSnapshot, createCampaign, getActiveCombatEncounter, getPlayerCharacter, insertCheckpoint, listCombatEncounters, openDatabase, restorePreviousTurn } from "../src/persistence/database.ts";

const characterInput: PlayerCharacterInput = {
  name: "Mara Vale",
  abilityScores: { strength: 10, dexterity: 15, constitution: 14, intelligence: 13, wisdom: 12, charisma: 8 },
  skillProficiencies: ["acrobatics", "investigation", "perception", "stealth"],
  saveProficiencies: ["dexterity", "wisdom"]
};

const quickEncounter: StartEncounterInput = {
  mode: "quick",
  objective: "Reach the far archway.",
  stakes: "Delay gives the hostile scout time to call for help.",
  participants: [{
    combatantId: "HOSTILE-001",
    name: "Hostile Scout",
    side: "hostile",
    maxHp: 5,
    defense: 11,
    initiativeModifier: 1,
    attackBonus: 2,
    damageDie: 4
  }],
  availableExits: ["escape", "surrender", "negotiation"]
};

async function setup(name: string) {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), "velmora-combat-test-")), "test.sqlite"));
  const campaignId = createCampaign(db, content, name, `${name}-seed`);
  createPlayerCharacter(db, campaignId, characterInput);
  return { db, campaignId };
}

function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++]!;
}

test("creates one bounded persistent theater-of-the-mind encounter with initiative", async () => {
  const { db, campaignId } = await setup("combat-start");
  try {
    const encounter = startCombatEncounter(db, campaignId, quickEncounter, sequence(18, 7));
    assert.equal(encounter.status, "active");
    assert.equal(encounter.round, 1);
    assert.equal(encounter.combatants[0]?.combatantId, "PC-001");
    assert.deepEqual(encounter.availableExits, ["escape", "surrender", "negotiation"]);
    assert.deepEqual(getActiveCombatEncounter(db, campaignId), encounter);
    assert.throws(() => startCombatEncounter(db, campaignId, quickEncounter), /Resolve the active encounter/);
  } finally { db.close(); }
});

test("resolves attacks, critical damage, defeat, and victory through turn order", async () => {
  const { db, campaignId } = await setup("combat-attack");
  try {
    startCombatEncounter(db, campaignId, quickEncounter, sequence(18, 7));
    const result = resolveCombatAttack(db, campaignId, "PC-001", "HOSTILE-001", () => 20, () => 3);
    assert.equal(result.hit, true);
    assert.equal(result.critical, true);
    assert.equal(result.damage, 6);
    assert.equal(result.encounter.combatants.find((entry) => entry.combatantId === "HOSTILE-001")?.status, "defeated");
    assert.equal(result.encounter.status, "resolved");
    assert.equal(result.encounter.resolution, "victory");
    assert.equal(getActiveCombatEncounter(db, campaignId), undefined);
  } finally { db.close(); }
});

test("preserves credible escape, surrender, and negotiation instead of forcing combat", async () => {
  const { db, campaignId } = await setup("combat-exits");
  try {
    startCombatEncounter(db, campaignId, quickEncounter, sequence(18, 7));
    const negotiated = resolveCombatExit(db, campaignId, "PC-001", "negotiation", "success_with_cost");
    assert.equal(negotiated.status, "resolved");
    assert.equal(negotiated.resolution, "negotiated");

    const second = startCombatEncounter(db, campaignId, quickEncounter, sequence(18, 7));
    assert.equal(resolveCombatExit(db, campaignId, "PC-001", "surrender", null).resolution, "surrendered");
    assert.equal(listCombatEncounters(db, campaignId).length, 2);
    assert.equal(second.availableExits.includes("escape"), true);
  } finally { db.close(); }
});

test("one-turn rollback restores encounter state and player health", async () => {
  const { db, campaignId } = await setup("combat-rollback");
  try {
    startCombatEncounter(db, campaignId, quickEncounter, sequence(1, 20));
    insertCheckpoint(db, campaignId, 0, 1, "pre_turn", captureSnapshot(db, campaignId));
    db.prepare("UPDATE campaigns SET turn = 1 WHERE id = ?").run(campaignId);
    resolveCombatAttack(db, campaignId, "HOSTILE-001", "PC-001", () => 20, () => 4);
    assert.equal(getPlayerCharacter(db, campaignId)?.currentHp, 6);

    restorePreviousTurn(db, "combat-rollback");
    assert.equal(getPlayerCharacter(db, campaignId)?.currentHp, 14);
    const restored = getActiveCombatEncounter(db, campaignId)!;
    assert.equal(restored.currentTurnIndex, 0);
    assert.equal(restored.combatants.find((entry) => entry.combatantId === "PC-001")?.currentHp, 14);
  } finally { db.close(); }
});

test("rejects overfilled modes and invalid attacks without partial mutation", async () => {
  const { db, campaignId } = await setup("combat-bounds");
  try {
    const overfilled: StartEncounterInput = {
      ...quickEncounter,
      participants: [...quickEncounter.participants, { ...quickEncounter.participants[0]!, combatantId: "HOSTILE-002" }, { ...quickEncounter.participants[0]!, combatantId: "HOSTILE-003" }]
    };
    assert.throws(() => startCombatEncounter(db, campaignId, overfilled), /bounded participant limit/);
    startCombatEncounter(db, campaignId, quickEncounter, sequence(18, 7));
    assert.throws(() => resolveCombatAttack(db, campaignId, "HOSTILE-001", "PC-001"), /Mara Vale's turn/);
    assert.equal(getActiveCombatEncounter(db, campaignId)?.combatants.find((entry) => entry.combatantId === "HOSTILE-001")?.currentHp, 5);
  } finally { db.close(); }
});

test("player attacks spend only the Action slot and require explicit End Turn", async () => {
  const { db, campaignId } = await setup("combat-player-slots");
  try {
    startCombatEncounter(db, campaignId, quickEncounter, sequence(18, 7));
    const initial = getPlayerCombatTurnView(db, campaignId);
    assert.equal(initial.isPlayerTurn, true);
    assert.deepEqual(initial.slots, {
      power: "available",
      action: "available",
      movement: "available",
      minor_interaction: "available"
    });
    assert.equal(initial.options.find((option) => option.optionId === "fight.basic_attack")?.available, true);

    const missed = resolveCombatAttack(db, campaignId, "PC-001", "HOSTILE-001", () => 1);
    assert.equal(missed.hit, false);
    assert.equal(missed.encounter.currentTurnIndex, 0);
    const afterAttack = getPlayerCombatTurnView(db, campaignId);
    assert.equal(afterAttack.slots?.action, "spent");
    assert.equal(afterAttack.slots?.movement, "available");
    assert.equal(afterAttack.options.find((option) => option.optionId === "fight.basic_attack")?.unavailableReason, "The action slot has already been spent");
    assert.throws(() => resolveCombatAttack(db, campaignId, "PC-001", "HOSTILE-001", () => 20), /action slot has already been spent/);

    const ended = endPlayerCombatTurn(db, campaignId);
    assert.equal(ended.combatants[ended.currentTurnIndex]?.combatantId, "HOSTILE-001");
    assert.equal(getPlayerCombatTurnView(db, campaignId).isPlayerTurn, false);
  } finally { db.close(); }
});

test("a new player turn refreshes every slot and End Turn may leave slots unused", async () => {
  const { db, campaignId } = await setup("combat-slot-refresh");
  try {
    startCombatEncounter(db, campaignId, quickEncounter, sequence(18, 7));
    endPlayerCombatTurn(db, campaignId);
    resolveCombatAttack(db, campaignId, "HOSTILE-001", "PC-001", () => 1);
    const nextTurn = getPlayerCombatTurnView(db, campaignId);
    assert.equal(nextTurn.round, 2);
    assert.equal(nextTurn.isPlayerTurn, true);
    assert.deepEqual(nextTurn.slots, {
      power: "available",
      action: "available",
      movement: "available",
      minor_interaction: "available"
    });
  } finally { db.close(); }
});

test("a failed combat exit spends Action without silently ending the player turn", async () => {
  const { db, campaignId } = await setup("combat-exit-slot");
  try {
    startCombatEncounter(db, campaignId, quickEncounter, sequence(18, 7));
    const encounter = resolveCombatExit(db, campaignId, "PC-001", "escape", "failure");
    assert.equal(encounter.currentTurnIndex, 0);
    const view = getPlayerCombatTurnView(db, campaignId);
    assert.equal(view.slots?.action, "spent");
    assert.equal(view.options.find((option) => option.optionId === "action.escape")?.available, false);
    assert.throws(() => resolveCombatExit(db, campaignId, "PC-001", "surrender", null), /action slot has already been spent/);
  } finally { db.close(); }
});

test("legacy active encounters gain a safe full player budget on first use", async () => {
  const { db, campaignId } = await setup("combat-legacy-budget");
  try {
    const encounter = startCombatEncounter(db, campaignId, quickEncounter, sequence(18, 7));
    const legacy = { ...encounter };
    delete legacy.turnBudget;
    db.prepare("UPDATE combat_encounters SET encounter_json = ? WHERE campaign_id = ? AND encounter_id = ?")
      .run(JSON.stringify(legacy), campaignId, encounter.encounterId);

    const view = getPlayerCombatTurnView(db, campaignId);
    assert.equal(view.slots?.action, "available");
    resolveCombatAttack(db, campaignId, "PC-001", "HOSTILE-001", () => 1);
    assert.equal(getActiveCombatEncounter(db, campaignId)?.turnBudget?.slots.action, "spent");
  } finally { db.close(); }
});

test("rollback restores the player combat slot budget", async () => {
  const { db, campaignId } = await setup("combat-slot-rollback");
  try {
    startCombatEncounter(db, campaignId, quickEncounter, sequence(18, 7));
    insertCheckpoint(db, campaignId, 0, 1, "pre_turn", captureSnapshot(db, campaignId));
    db.prepare("UPDATE campaigns SET turn = 1 WHERE id = ?").run(campaignId);
    resolveCombatAttack(db, campaignId, "PC-001", "HOSTILE-001", () => 1);
    assert.equal(getPlayerCombatTurnView(db, campaignId).slots?.action, "spent");

    restorePreviousTurn(db, "combat-slot-rollback");
    assert.equal(getPlayerCombatTurnView(db, campaignId).slots?.action, "available");
  } finally { db.close(); }
});
