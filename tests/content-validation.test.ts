import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";

test("approved Velmora foundation content validates", async () => {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  assert.equal(content.factions.length, 6);
  assert.equal(content.characters.length, 7);
  assert.equal(content.campaign.factionPathRequirement, 2);
  assert.equal(content.campaign.allowTemporaryTearTravel, false);
  assert.equal(content.sceneTemplates.length, 4, "One clearly labeled mechanical scaffold exists per stage");
});
