import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { buildPerspectiveContext } from "../src/application/context-builder.ts";
import { createPlayerCharacter, type PlayerCharacterInput } from "../src/application/player-character.ts";
import { activateSustainedPower, deactivateSustainedPower, grantPlayerPower } from "../src/application/power-system.ts";
import { captureSnapshot, createCampaign, insertCheckpoint, listPlayerPowers, openDatabase, restorePreviousTurn } from "../src/persistence/database.ts";

const characterInput: PlayerCharacterInput = {
  name: "Iria Quill",
  abilityScores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 },
  skillProficiencies: ["arcana", "investigation", "perception", "stealth"],
  saveProficiencies: ["intelligence", "wisdom"]
};

async function setup(name: string) {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), "velmora-power-test-")), "test.sqlite"));
  const campaignId = createCampaign(db, content, name, "fixed-power-seed");
  createPlayerCharacter(db, campaignId, characterInput);
  return { content, db, campaignId };
}

test("persists approved power ownership and exposes definitions in player context", async () => {
  const { content, db, campaignId } = await setup("power-ownership");
  try {
    const power = grantPlayerPower(db, content, campaignId, {
      powerId: "PWR-SHORT-BLINK",
      source: "taught"
    });
    assert.equal(power.active, false);
    assert.equal(power.playerApproved, false);
    assert.equal(buildPerspectiveContext(db, content, "power-ownership").playerPowers[0]?.definition.name, "Short Blink");
    assert.throws(() => grantPlayerPower(db, content, campaignId, {
      powerId: "PWR-SHORT-BLINK",
      source: "taught"
    }), /already owned/);
  } finally { db.close(); }
});

test("activating a sustained power ends the previously sustained power", async () => {
  const { content, db, campaignId } = await setup("one-sustained-power");
  try {
    grantPlayerPower(db, content, campaignId, { powerId: "PWR-RIFT-SIGHT", source: "discovered" });
    grantPlayerPower(db, content, campaignId, { powerId: "PWR-SILENT-MOVEMENT", source: "taught" });
    activateSustainedPower(db, content, campaignId, "PWR-RIFT-SIGHT");
    activateSustainedPower(db, content, campaignId, "PWR-SILENT-MOVEMENT");
    const powers = listPlayerPowers(db, campaignId);
    assert.equal(powers.find((power) => power.powerId === "PWR-RIFT-SIGHT")?.active, false);
    assert.equal(powers.find((power) => power.powerId === "PWR-SILENT-MOVEMENT")?.active, true);
    assert.equal(deactivateSustainedPower(db, content, campaignId, "PWR-SILENT-MOVEMENT").active, false);
    assert.throws(() => activateSustainedPower(db, content, campaignId, "PWR-SHORT-BLINK"), /not a sustained power/);
  } finally { db.close(); }
});

test("Level 3 acquisition requires an eligible source and explicit player approval", async () => {
  const { content, db, campaignId } = await setup("level-three-gate");
  try {
    assert.throws(() => grantPlayerPower(db, content, campaignId, {
      powerId: "PWR-WORLD-ANCHOR",
      source: "tear"
    }), /explicit player approval/);
    assert.throws(() => grantPlayerPower(db, content, campaignId, {
      powerId: "PWR-WORLD-ANCHOR",
      source: "taught",
      playerApproved: true
    }), /cannot be acquired/);
    const power = grantPlayerPower(db, content, campaignId, {
      powerId: "PWR-WORLD-ANCHOR",
      source: "void_rift",
      playerApproved: true
    });
    assert.equal(power.playerApproved, true);
  } finally { db.close(); }
});

test("one-turn rollback restores power ownership and sustained activation", async () => {
  const { content, db, campaignId } = await setup("power-rollback");
  try {
    grantPlayerPower(db, content, campaignId, { powerId: "PWR-RIFT-SIGHT", source: "discovered" });
    activateSustainedPower(db, content, campaignId, "PWR-RIFT-SIGHT");
    const beforeTurn = captureSnapshot(db, campaignId);
    insertCheckpoint(db, campaignId, 0, 1, "pre_turn", beforeTurn);
    db.prepare("UPDATE campaigns SET turn = 1 WHERE id = ?").run(campaignId);
    grantPlayerPower(db, content, campaignId, { powerId: "PWR-SILENT-MOVEMENT", source: "taught" });
    activateSustainedPower(db, content, campaignId, "PWR-SILENT-MOVEMENT");

    restorePreviousTurn(db, "power-rollback");
    const restored = listPlayerPowers(db, campaignId);
    assert.equal(restored.length, 1);
    assert.equal(restored[0]?.powerId, "PWR-RIFT-SIGHT");
    assert.equal(restored[0]?.active, true);
  } finally { db.close(); }
});
