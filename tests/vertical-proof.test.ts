import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { openPlayableMoment, submitPlayableAction } from "../src/application/gameplay-session.ts";
import { MockDirector } from "../src/director/mock-director.ts";
import { countScenes, createCampaign, getCampaign, getFactionCondition, openDatabase, restorePreviousTurn } from "../src/persistence/database.ts";
import { withOpeningTestTemplate } from "./test-content.ts";

test("test-fixture turn places, acts, saves, reopens, and rolls back", async () => {
  const content = withOpeningTestTemplate(await loadVelmoraContent(resolve(import.meta.dirname, "..")));
  const dir = mkdtempSync(join(tmpdir(), "velmora-proof-"));
  const dbPath = join(dir, "proof.sqlite");
  let db = openDatabase(dbPath);
  const campaignId = createCampaign(db, content, "proof", "vertical-proof-seed");

  const firstMoment = openPlayableMoment(db, content, "proof");
  assert.equal(firstMoment.reused, false);
  assert.equal(firstMoment.scene.locationId, "LOC-COUNCIL-CROWN");
  assert.equal(firstMoment.scene.suggestedActions.length, 2);

  const result = await submitPlayableAction(db, content, new MockDirector(), "proof", "support league");
  assert.equal(result.advanced, true);
  assert.equal(result.currentTurn, 1);
  assert.equal(getFactionCondition(db, campaignId, "FAC-001"), 3);
  db.close();

  db = openDatabase(dbPath);
  assert.equal(getCampaign(db, "proof")?.turn, 1);
  assert.equal(getFactionCondition(db, campaignId, "FAC-001"), 3);
  restorePreviousTurn(db, "proof");
  assert.equal(getCampaign(db, "proof")?.turn, 0);
  assert.equal(getFactionCondition(db, campaignId, "FAC-001"), 2);
  assert.equal(countScenes(db, campaignId), 1);
  db.close();
});
