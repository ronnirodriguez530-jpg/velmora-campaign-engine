import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { buildDirectorPlanningContext, buildPerspectiveContext } from "../src/application/context-builder.ts";
import { getOpeningState, recordOpeningExplorationTurn, rollOpeningStart, validateOpeningConvergenceProposal } from "../src/application/opening-system.ts";
import { createCampaign, openDatabase } from "../src/persistence/database.ts";
import { restorePreviousTurn } from "../src/persistence/database.ts";
import { runPlayerAction } from "../src/application/turn-orchestrator.ts";
import { MockDirector } from "../src/director/mock-director.ts";

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

test("adaptive convergence protects two scenes and accepts only grounded witnessing evidence", async () => {
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), "velmora-opening-ready-")), "save.sqlite"));
  const content = await loadVelmoraContent(projectRoot);
  const campaignId = createCampaign(db, content, "opening-ready", "opening-ready-seed");
  try {
    rollOpeningStart(db, content, campaignId, () => 2);
    const proposal = {
      evidence: "public_address_reached_player" as const,
      reason: "The rescheduled public address has moved into the player's current courtyard."
    };
    assert.throws(() => validateOpeningConvergenceProposal(db, campaignId, proposal), /at least two meaningful exploratory scenes/);
    assert.equal(recordOpeningExplorationTurn(db, campaignId, 1).phase, "exploration");
    const ready = recordOpeningExplorationTurn(db, campaignId, 2, proposal);
    assert.equal(ready.phase, "convergence_ready");
    assert.equal(ready.explorationTurns, 2);
    assert.equal(ready.readinessTurn, 2);
    assert.match(ready.readinessReason ?? "", /public address/);

    const player = buildPerspectiveContext(db, content, "opening-ready");
    assert.equal(player.opening.phase, "exploration");
    assert.equal(JSON.stringify(player).includes("readinessReason"), false);
    const director = buildDirectorPlanningContext(db, content, "opening-ready");
    assert.equal(director.directorOpening.phase, "convergence_ready");
  } finally {
    db.close();
  }
});

test("opening convergence cannot drift beyond four meaningful scenes", async () => {
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), "velmora-opening-ceiling-")), "save.sqlite"));
  const content = await loadVelmoraContent(projectRoot);
  const campaignId = createCampaign(db, content, "opening-ceiling", "opening-ceiling-seed");
  try {
    rollOpeningStart(db, content, campaignId, () => 4);
    for (let turn = 1; turn <= 3; turn += 1) {
      assert.equal(recordOpeningExplorationTurn(db, campaignId, turn).phase, "exploration");
    }
    const ready = recordOpeningExplorationTurn(db, campaignId, 4);
    assert.equal(ready.phase, "convergence_ready");
    assert.equal(ready.explorationTurns, 4);
    assert.equal(ready.readinessTurn, 4);
    assert.match(ready.readinessReason ?? "", /four meaningful exploratory scenes/);
    assert.equal(recordOpeningExplorationTurn(db, campaignId, 5).explorationTurns, 4);
  } finally {
    db.close();
  }
});

test("rollback restores the prior opening convergence state", async () => {
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), "velmora-opening-rollback-")), "save.sqlite"));
  const content = await loadVelmoraContent(projectRoot);
  const campaignId = createCampaign(db, content, "opening-rollback", "opening-rollback-seed");
  try {
    rollOpeningStart(db, content, campaignId, () => 1);
    const director = new MockDirector();
    for (const action of ["support league", "neglect league", "support league", "neglect league"]) {
      await runPlayerAction(db, content, director, "opening-rollback", action);
    }
    assert.equal(getOpeningState(db, campaignId).phase, "convergence_ready");
    restorePreviousTurn(db, "opening-rollback");
    const restored = getOpeningState(db, campaignId);
    assert.equal(restored.phase, "exploration");
    assert.equal(restored.explorationTurns, 3);
    assert.equal(restored.readinessTurn, null);
  } finally {
    db.close();
  }
});
