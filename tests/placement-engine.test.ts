import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { buildPerspectiveContext } from "../src/application/context-builder.ts";
import { generateScene, getOrCreateEncounteredScene } from "../src/application/placement-engine.ts";
import { countScenes, createCampaign, openDatabase, restorePreviousTurn } from "../src/persistence/database.ts";
import { runPlayerAction } from "../src/application/turn-orchestrator.ts";
import { MockDirector } from "../src/director/mock-director.ts";
import { withOpeningTestTemplate } from "./test-content.ts";

async function setup(name = "placement-test") {
  const content = withOpeningTestTemplate(await loadVelmoraContent(resolve(import.meta.dirname, "..")));
  const dir = mkdtempSync(join(tmpdir(), "velmora-placement-test-"));
  const db = openDatabase(join(dir, "test.sqlite"));
  const campaignId = createCampaign(db, content, name, "fixed-placement-seed");
  return { content, db, campaignId };
}

test("perspective context contains only current and directly connected locations", async () => {
  const { content, db } = await setup();
  try {
    const context = buildPerspectiveContext(db, content, "placement-test");
    assert.equal(context.currentLocation.id, "LOC-COUNCIL-CROWN");
    assert.deepEqual(context.connectedLocations.map((location) => location.id).sort(), [
      "LOC-DIST-AURORUS",
      "LOC-DIST-GLASS",
      "LOC-GUARDED-AVENUE"
    ]);
    assert.equal(context.connectedLocations.some((location) => location.id === "LOC-DIST-THORNS"), false);
  } finally {
    db.close();
  }
});

test("seeded placement is reproducible and stage-valid", async () => {
  const { content, db } = await setup();
  try {
    const context = buildPerspectiveContext(db, content, "placement-test");
    const first = generateScene(context, content);
    const second = generateScene(context, content);
    assert.deepEqual(first, second);
    assert.equal(first.stage, "opening");
    assert.ok(first.threatLevel <= context.stageMaxThreatLevel);
    assert.equal(first.locationId, context.currentLocation.id);
  } finally {
    db.close();
  }
});

test("encountered scene persists and is reused", async () => {
  const { content, db, campaignId } = await setup();
  try {
    const context = buildPerspectiveContext(db, content, "placement-test");
    const first = getOrCreateEncounteredScene(db, context, content);
    const second = getOrCreateEncounteredScene(db, context, content);
    assert.equal(first.reused, false);
    assert.equal(second.reused, true);
    assert.deepEqual(first.scene, second.scene);
    assert.equal(countScenes(db, campaignId), 1);
  } finally {
    db.close();
  }
});

test("rollback removes encountered scenes created after the restored checkpoint", async () => {
  const { content, db, campaignId } = await setup();
  try {
    await runPlayerAction(db, content, new MockDirector(), "placement-test", "support league");
    const turnOneContext = buildPerspectiveContext(db, content, "placement-test");
    getOrCreateEncounteredScene(db, turnOneContext, content);
    assert.equal(countScenes(db, campaignId), 1);
    restorePreviousTurn(db, "placement-test");
    assert.equal(countScenes(db, campaignId), 0);
  } finally {
    db.close();
  }
});
