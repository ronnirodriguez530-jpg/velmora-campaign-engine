import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { createCampaign, getCampaign, openDatabase } from "../src/persistence/database.ts";

test("creates and reloads a named campaign", async () => {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const dir = mkdtempSync(join(tmpdir(), "velmora-test-"));
  const db = openDatabase(join(dir, "test.sqlite"));
  try {
    const id = createCampaign(db, content, "test-campaign", "fixed-seed");
    const campaign = getCampaign(db, "test-campaign");
    assert.equal(campaign?.id, id);
    assert.equal(campaign?.stage, "opening");
    assert.equal(campaign?.turn, 0);
    assert.equal(campaign?.currentLocationId, "LOC-COUNCIL-CROWN");
    const questCount = db.prepare("SELECT COUNT(*) AS count FROM quest_instances").get() as { count: number };
    assert.equal(questCount.count, 0, "Mechanical faction progress must not invent authored quests");
    const restoredTables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('faction_path_state','tear_arrivals') ORDER BY name").all();
    assert.equal(restoredTables.length, 2);
  } finally {
    db.close();
  }
});
