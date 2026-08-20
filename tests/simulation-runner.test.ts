import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { runSimulations } from "../src/application/simulation-runner.ts";

test("bounded runner completes multiple independent paths without changing canon", async () => {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const report = await runSimulations(content, 4, 8);
  assert.equal(report.scope.canonChanged, false);
  assert.equal(report.paths.length, 4);
  assert.equal(report.validationFailures.length, 0);
  assert.equal(report.pathsReachingResolution, 4);
  assert.ok(report.paths.every((path) => path.committedTurns === 8));
});
