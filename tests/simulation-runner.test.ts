import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { runSimulations } from "../src/application/simulation-runner.ts";
import { runQuestSimulations } from "../src/application/quest-simulation-runner.ts";

test("bounded runner completes multiple independent paths without changing canon", async () => {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const report = await runSimulations(content, 4, 8);
  assert.equal(report.scope.canonChanged, false);
  assert.equal(report.paths.length, 4);
  assert.equal(report.validationFailures.length, 0);
  assert.equal(report.pathsReachingResolution, 0);
  assert.ok(report.paths.every((path) => path.finalStage === "stabilization"));
  assert.ok(report.paths.every((path) => path.committedTurns === 8));
});

test("stage dwell gates preserve a long arc while still allowing eventual Resolution", async () => {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const beforeEndgame = await runSimulations(content, 2, 47);
  assert.equal(beforeEndgame.pathsReachingResolution, 0);
  assert.ok(beforeEndgame.paths.every((path) => path.finalStage === "escalation"));

  const eligibleForEndgame = await runSimulations(content, 2, 48);
  assert.equal(eligibleForEndgame.pathsReachingResolution, 2);
});

test("sustained quest simulation preserves adaptive, recovery, concurrency, and journal invariants", async () => {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const report = await runQuestSimulations(content, 8);
  assert.equal(report.scope.canonChanged, false);
  assert.equal(report.scope.threadsPerPath, 4);
  assert.equal(report.validationFailures.length, 0);
  assert.equal(report.paths.length, 8);
  assert.ok(report.paths.every((path) => path.totalQuests === 7));
  assert.ok(report.paths.every((path) => path.completedQuests === 3));
  assert.ok(report.paths.every((path) => path.failedQuests === 1));
  assert.ok(report.paths.every((path) => path.recoveryQuests === 2));
  assert.ok(report.paths.every((path) => path.adaptiveObjectives === 1));
  assert.ok(report.paths.every((path) => path.unexpectedCompletions === 1));
  assert.ok(report.paths.every((path) => path.maximumUnresolvedPerThread === 2));
  assert.ok(report.paths.every((path) => path.hardCapRejected));
  assert.ok(report.paths.every((path) => path.activeJournalQuests === 0));
  assert.ok(report.paths.every((path) => path.recentJournalEvents === 5));
});
