import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { buildDirectorPlanningContext, buildPerspectiveContext } from "../src/application/context-builder.ts";
import { getOpeningState, rollOpeningStart } from "../src/application/opening-system.ts";
import { createCampaign, openDatabase } from "../src/persistence/database.ts";

const projectRoot = resolve(import.meta.dirname, "..");

test("opening d6 persists one visible spawn and keeps the convergence roll Director-only", async () => {
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), "velmora-opening-")), "save.sqlite"));
  const content = await loadVelmoraContent(projectRoot);
  const campaignId = createCampaign(db, content, "opening-test", "opening-seed");
  try {
    assert.equal(getOpeningState(db, campaignId).phase, "awaiting_roll");
    const rolls = [3, 5];
    const playerOpening = rollOpeningStart(db, content, campaignId, () => rolls.shift()!);
    assert.equal(playerOpening.spawnRoll, 3);
    assert.equal(playerOpening.spawn?.id, "OPEN-RECORDS-DELIVERY");
    assert.equal("convergenceRoll" in playerOpening, false);

    const repeated = rollOpeningStart(db, content, campaignId, () => 6);
    assert.equal(repeated.spawnRoll, 3);
    const perspective = buildPerspectiveContext(db, content, "opening-test");
    assert.equal(perspective.opening.spawn?.id, "OPEN-RECORDS-DELIVERY");
    assert.equal(JSON.stringify(perspective).includes("OPEN-HOOK-MINOR-EMERGENCY"), false);
    assert.equal(perspective.visibleOpeningPressure, null);

    const planning = buildDirectorPlanningContext(db, content, "opening-test");
    assert.equal(planning.directorOpening.convergenceRoll, 5);
    assert.equal(planning.directorOpening.convergenceHook?.id, "OPEN-HOOK-MINOR-EMERGENCY");
  } finally {
    db.close();
  }
});
