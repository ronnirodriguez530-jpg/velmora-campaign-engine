import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CampaignDirector } from "../src/director/director.ts";
import { MockDirector } from "../src/director/mock-director.ts";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { runPlayerAction } from "../src/application/turn-orchestrator.ts";
import {
  countCheckpoints,
  createCampaign,
  getCampaign,
  getFactionCondition,
  listEvents,
  openDatabase,
  restorePreviousTurn
} from "../src/persistence/database.ts";

async function setup() {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const dir = mkdtempSync(join(tmpdir(), "velmora-turn-test-"));
  const db = openDatabase(join(dir, "test.sqlite"));
  const campaignId = createCampaign(db, content, "turn-test", "fixed-seed");
  return { content, db, campaignId };
}

test("minor input does not advance or mutate the world", async () => {
  const { content, db, campaignId } = await setup();
  try {
    const result = await runPlayerAction(db, content, new MockDirector(), "turn-test", "look around");
    assert.equal(result.advanced, false);
    assert.equal(getCampaign(db, "turn-test")?.turn, 0);
    assert.equal(getFactionCondition(db, campaignId, "FAC-001"), 2);
    assert.equal(countCheckpoints(db, campaignId), 0);
  } finally {
    db.close();
  }
});

test("major input commits one atomic world turn with checkpoints", async () => {
  const { content, db, campaignId } = await setup();
  try {
    const result = await runPlayerAction(db, content, new MockDirector(), "turn-test", "support league");
    assert.equal(result.advanced, true);
    assert.equal(result.currentTurn, 1);
    assert.equal(getFactionCondition(db, campaignId, "FAC-001"), 3);
    assert.equal(countCheckpoints(db, campaignId), 2);
    assert.ok(listEvents(db, campaignId).some((event) => event.eventType === "world_turn_committed"));
  } finally {
    db.close();
  }
});

test("invalid tool requests are retried then rejected without mutation", async () => {
  const { content, db, campaignId } = await setup();
  const invalidDirector: CampaignDirector = {
    preview: (context) => new MockDirector().preview(context),
    planTurn: async () => ({
      summary: "invalid test",
      majorActionProposal: true,
      toolRequests: [{ type: "change_faction_condition", factionId: "FAC-MISSING", delta: 1, reason: "invalid faction" }],
      suggestedActions: ["A", "B"],
      allowsFreeText: true
    })
  };
  try {
    await assert.rejects(() => runPlayerAction(db, content, invalidDirector, "turn-test", "commit now"), /could not produce a valid plan/);
    assert.equal(getCampaign(db, "turn-test")?.turn, 0);
    assert.equal(getFactionCondition(db, campaignId, "FAC-001"), 2);
    assert.equal(countCheckpoints(db, campaignId), 0);
  } finally {
    db.close();
  }
});

test("one-turn rollback restores mutable state and preserves audit history", async () => {
  const { content, db, campaignId } = await setup();
  try {
    await runPlayerAction(db, content, new MockDirector(), "turn-test", "support league");
    const restored = restorePreviousTurn(db, "turn-test");
    assert.equal(restored.turn, 0);
    assert.equal(getFactionCondition(db, campaignId, "FAC-001"), 2);
    assert.ok(listEvents(db, campaignId).some((event) => event.eventType === "turn_rolled_back"));
  } finally {
    db.close();
  }
});
