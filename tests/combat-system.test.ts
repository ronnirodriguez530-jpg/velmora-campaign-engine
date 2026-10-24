import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { resolveCombatAttack, resolveCombatExit, startCombatEncounter, type StartEncounterInput } from "../src/application/combat-system.ts";
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
