import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCampaignBlueprint } from "../src/application/campaign-blueprint-generator.ts";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { buildDirectorPlanningContext, buildPerspectiveContext } from "../src/application/context-builder.ts";
import { createCampaign, getCampaignBlueprint, listStoryThreads, openDatabase } from "../src/persistence/database.ts";

const projectRoot = resolve(import.meta.dirname, "..");

function variableSignature(blueprint: ReturnType<typeof generateCampaignBlueprint>): string {
  return JSON.stringify({
    openingPressureId: blueprint.openingPressure.id,
    focalFactionIds: blueprint.focalFactionIds,
    factionPressureId: blueprint.factionPressure.id,
    clueRouteIds: blueprint.clueRoutes.map((route) => route.id),
    reversalId: blueprint.reversal.id
  });
}

test("campaign blueprint is deterministic for a seed and varied across runs", async () => {
  const content = await loadVelmoraContent(projectRoot);
  const first = generateCampaignBlueprint(content, "SAVE-A", "same-seed");
  const repeated = generateCampaignBlueprint(content, "SAVE-B", "same-seed");
  assert.equal(variableSignature(first), variableSignature(repeated));

  const signatures = new Set(
    Array.from({ length: 24 }, (_, index) => variableSignature(
      generateCampaignBlueprint(content, `SAVE-${index}`, `campaign-seed-${index}`)
    ))
  );
  assert.ok(signatures.size >= 12, `Expected meaningful campaign variation, received ${signatures.size} unique blueprints`);
});

test("campaign creation persists a hidden stage-gated blueprint", async () => {
  const root = mkdtempSync(join(tmpdir(), "velmora-blueprint-"));
  const db = openDatabase(join(root, "save.sqlite"));
  const content = await loadVelmoraContent(projectRoot);
  const campaignId = createCampaign(db, content, "blueprint-test", "blueprint-seed");
  const blueprint = getCampaignBlueprint(db, campaignId)!;

  assert.equal(blueprint.campaignId, campaignId);
  assert.equal(blueprint.openingPressure.threatLevel <= 2, true);
  assert.equal(blueprint.focalFactionIds[0] === blueprint.focalFactionIds[1], false);
  assert.equal(blueprint.clueRoutes.length, content.storyBlueprintPools.clueRouteCount);
  assert.notEqual(blueprint.reversal.minimumStage, "opening");
  assert.equal(blueprint.endgameMinimumStage, "resolution");
  const initialThreads = listStoryThreads(db, campaignId);
  assert.equal(initialThreads.some((thread) => thread.threadId === "THREAD-OPENING-PRESSURE" && thread.visibility === "player"), true);
  assert.equal(initialThreads.some((thread) => thread.threadId === "THREAD-FIRST-SPEAKER-TRANSFORMATION" && thread.visibility === "director"), true);
  assert.equal(initialThreads.find((thread) => thread.threadId === "THREAD-CAMPAIGN-REVERSAL")?.minimumStage, blueprint.reversal.minimumStage);

  const perspective = buildPerspectiveContext(db, content, "blueprint-test");
  assert.equal(perspective.visibleOpeningPressure?.id, blueprint.openingPressure.id);
  assert.equal(JSON.stringify(perspective).includes(blueprint.factionPressure.id), false);
  assert.equal(JSON.stringify(perspective).includes(blueprint.reversal.id), false);
  const planning = buildDirectorPlanningContext(db, content, "blueprint-test");
  assert.equal(planning.campaignBlueprint.openingPressure.id, blueprint.openingPressure.id);
  assert.equal(planning.campaignBlueprint.endgameMinimumStage, "resolution");
  db.close();
});
