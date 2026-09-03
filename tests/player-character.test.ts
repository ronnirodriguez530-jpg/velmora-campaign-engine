import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { buildPerspectiveContext } from "../src/application/context-builder.ts";
import { createPlayerCharacter, type PlayerCharacterInput } from "../src/application/player-character.ts";
import { createCampaign, getPlayerCharacter, openDatabase } from "../src/persistence/database.ts";

const validInput: PlayerCharacterInput = {
  name: "Mara Vale",
  identityNotes: "A patient observer.",
  abilityScores: { strength: 10, dexterity: 15, constitution: 14, intelligence: 13, wisdom: 12, charisma: 8 },
  skillProficiencies: ["acrobatics", "investigation", "perception", "stealth"],
  saveProficiencies: ["dexterity", "wisdom"]
};

async function setup(name: string) {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), "velmora-character-test-")), "test.sqlite"));
  const campaignId = createCampaign(db, content, name, "fixed-character-seed");
  return { content, db, campaignId };
}

test("creates one persistent character with approved derived statistics", async () => {
  const { content, db, campaignId } = await setup("character-valid");
  try {
    assert.equal(buildPerspectiveContext(db, content, "character-valid").playerCharacter, null);
    const character = createPlayerCharacter(db, campaignId, validInput);
    assert.equal(character.abilityModifiers.dexterity, 2);
    assert.equal(character.abilityModifiers.charisma, -1);
    assert.equal(character.maxHp, 14);
    assert.equal(character.currentHp, 14);
    assert.equal(character.defense, 12);
    assert.deepEqual(getPlayerCharacter(db, campaignId), character);
    assert.equal(buildPerspectiveContext(db, content, "character-valid").playerCharacter?.name, "Mara Vale");
    assert.throws(() => createPlayerCharacter(db, campaignId, validInput), /already has a player character/);
  } finally { db.close(); }
});

test("rejects invalid ability arrays and proficiency selections without mutation", async () => {
  const { db, campaignId } = await setup("character-invalid");
  try {
    assert.throws(() => createPlayerCharacter(db, campaignId, { ...validInput, abilityScores: { ...validInput.abilityScores, strength: 15 } }), /use 15, 14, 13, 12, 10, and 8/);
    assert.throws(() => createPlayerCharacter(db, campaignId, { ...validInput, skillProficiencies: ["stealth", "stealth", "arcana", "history"] }), /four unique/);
    assert.throws(() => createPlayerCharacter(db, campaignId, { ...validInput, saveProficiencies: ["dexterity"] }), /two unique/);
    assert.equal(getPlayerCharacter(db, campaignId), undefined);
  } finally { db.close(); }
});
