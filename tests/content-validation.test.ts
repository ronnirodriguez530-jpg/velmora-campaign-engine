import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";

test("approved Velmora foundation content validates", async () => {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  assert.equal(content.factions.length, 6);
  assert.equal(content.characters.length, 8);
  assert.deepEqual(content.openingSpawns.map((spawn) => spawn.roll), [1, 2, 3, 4, 5, 6]);
  assert.equal(content.factions.every((faction) => faction.districtIdentity.colors.length === 3), true);
  const orderOfGlass = content.factions.find((faction) => faction.id === "FAC-006");
  assert.equal(orderOfGlass?.hiddenStructure?.methods.includes("targeted theft"), true);
  assert.match(orderOfGlass?.hiddenStructure?.doctrine ?? "", /nothing in velmora/i);
  assert.deepEqual(orderOfGlass?.hiddenStructure?.publicAwareness && [
    orderOfGlass.hiddenStructure.publicAwareness.unawarePercent,
    orderOfGlass.hiddenStructure.publicAwareness.speculationPercent,
    orderOfGlass.hiddenStructure.publicAwareness.suspicionPercent,
    orderOfGlass.hiddenStructure.publicAwareness.knowsAndKeepsQuietPercent
  ], [75, 15, 5, 5]);
  assert.equal(content.campaign.factionPathRequirement, 2);
  assert.equal(content.campaign.allowTemporaryTearTravel, false);
  assert.equal(content.powers.length, 7);
  assert.equal(content.powers.find((power) => power.id === "PWR-WORLD-ANCHOR")?.requiresPlayerApproval, true);
  assert.equal(content.sceneTemplates.length, 4, "One clearly labeled mechanical scaffold exists per stage");
});
