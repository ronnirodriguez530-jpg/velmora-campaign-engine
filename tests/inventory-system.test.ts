import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { buildPerspectiveContext } from "../src/application/context-builder.ts";
import { addPlayerItem, consumePlayerItem, equipPlayerItem, unequipPlayerItem } from "../src/application/inventory-system.ts";
import { createPlayerCharacter, type PlayerCharacterInput } from "../src/application/player-character.ts";
import { captureSnapshot, createCampaign, getPlayerCharacter, insertCheckpoint, listPlayerInventory, openDatabase, restorePreviousTurn } from "../src/persistence/database.ts";

const characterInput: PlayerCharacterInput = {
  name: "Sable North",
  abilityScores: { strength: 12, dexterity: 15, constitution: 14, intelligence: 10, wisdom: 13, charisma: 8 },
  skillProficiencies: ["acrobatics", "athletics", "perception", "survival"],
  saveProficiencies: ["dexterity", "constitution"]
};

async function setup(name: string) {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), "velmora-inventory-test-")), "test.sqlite"));
  const campaignId = createCampaign(db, content, name, "fixed-inventory-seed");
  createPlayerCharacter(db, campaignId, characterInput);
  return { content, db, campaignId };
}

test("stores bounded inventory quantities and exposes definitions in player context", async () => {
  const { content, db, campaignId } = await setup("inventory-storage");
  try {
    addPlayerItem(db, content, campaignId, { itemId: "ITM-FIRST-AID-WRAP", quantity: 2, source: "starting" });
    const stacked = addPlayerItem(db, content, campaignId, { itemId: "ITM-FIRST-AID-WRAP", quantity: 2, source: "found" });
    assert.equal(stacked.quantity, 4);
    assert.equal(buildPerspectiveContext(db, content, "inventory-storage").playerInventory[0]?.definition.name, "First-Aid Wrap");
    assert.throws(() => addPlayerItem(db, content, campaignId, {
      itemId: "ITM-FIRST-AID-WRAP",
      quantity: 2,
      source: "reward"
    }), /cannot exceed a stack of 5/);
    addPlayerItem(db, content, campaignId, { itemId: "ITM-FIELD-KNIFE", source: "starting" });
    assert.throws(() => addPlayerItem(db, content, campaignId, {
      itemId: "ITM-FIELD-KNIFE",
      source: "found"
    }), /cannot stack/);
  } finally { db.close(); }
});

test("equipment slots replace prior items and recalculate defense", async () => {
  const { content, db, campaignId } = await setup("inventory-equipment");
  try {
    addPlayerItem(db, content, campaignId, { itemId: "ITM-REINFORCED-COAT", source: "starting" });
    addPlayerItem(db, content, campaignId, { itemId: "ITM-WARDED-RIOT-SHIELD", source: "found" });
    addPlayerItem(db, content, campaignId, { itemId: "ITM-NULL-LANTERN", source: "reward" });
    equipPlayerItem(db, content, campaignId, "ITM-REINFORCED-COAT");
    equipPlayerItem(db, content, campaignId, "ITM-WARDED-RIOT-SHIELD");
    assert.equal(getPlayerCharacter(db, campaignId)?.defense, 14);
    equipPlayerItem(db, content, campaignId, "ITM-NULL-LANTERN");
    assert.equal(listPlayerInventory(db, campaignId).find((item) => item.itemId === "ITM-WARDED-RIOT-SHIELD")?.equippedSlot, null);
    assert.equal(getPlayerCharacter(db, campaignId)?.defense, 13);
    unequipPlayerItem(db, content, campaignId, "ITM-REINFORCED-COAT");
    assert.equal(getPlayerCharacter(db, campaignId)?.defense, 12);
  } finally { db.close(); }
});

test("consumables decrement once and non-consumable items cannot be consumed", async () => {
  const { content, db, campaignId } = await setup("inventory-consumption");
  try {
    addPlayerItem(db, content, campaignId, { itemId: "ITM-FIRST-AID-WRAP", quantity: 2, source: "starting" });
    assert.equal(consumePlayerItem(db, content, campaignId, "ITM-FIRST-AID-WRAP")?.quantity, 1);
    assert.equal(consumePlayerItem(db, content, campaignId, "ITM-FIRST-AID-WRAP"), null);
    addPlayerItem(db, content, campaignId, { itemId: "ITM-RIFT-DETECTOR", source: "given" });
    assert.throws(() => consumePlayerItem(db, content, campaignId, "ITM-RIFT-DETECTOR"), /not consumable/);
  } finally { db.close(); }
});

test("one-turn rollback restores inventory, equipment, and derived defense", async () => {
  const { content, db, campaignId } = await setup("inventory-rollback");
  try {
    addPlayerItem(db, content, campaignId, { itemId: "ITM-REINFORCED-COAT", source: "starting" });
    equipPlayerItem(db, content, campaignId, "ITM-REINFORCED-COAT");
    insertCheckpoint(db, campaignId, 0, 1, "pre_turn", captureSnapshot(db, campaignId));
    db.prepare("UPDATE campaigns SET turn = 1 WHERE id = ?").run(campaignId);
    addPlayerItem(db, content, campaignId, { itemId: "ITM-WARDED-RIOT-SHIELD", source: "found" });
    equipPlayerItem(db, content, campaignId, "ITM-WARDED-RIOT-SHIELD");
    assert.equal(getPlayerCharacter(db, campaignId)?.defense, 14);

    restorePreviousTurn(db, "inventory-rollback");
    assert.equal(listPlayerInventory(db, campaignId).length, 1);
    assert.equal(getPlayerCharacter(db, campaignId)?.defense, 13);
  } finally { db.close(); }
});
