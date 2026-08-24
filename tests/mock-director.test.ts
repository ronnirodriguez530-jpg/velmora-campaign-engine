import test from "node:test";
import assert from "node:assert/strict";
import { MockDirector } from "../src/director/mock-director.ts";

test("mock Director previews without mutating state", async () => {
  const director = new MockDirector();
  const preview = await director.preview({
    campaignId: "SAVE-TEST",
    stage: "opening",
    turn: 0,
    locationId: "LOC-COUNCIL-CROWN"
  });
  assert.equal(preview.intent, "inspect");
  assert.equal(preview.allowsFreeText, true);
  assert.equal(preview.suggestedActions.length, 2);
});

test("mock Director proposes a bounded tool for known test input", async () => {
  const director = new MockDirector();
  const plan = await director.planTurn({
    campaignId: "SAVE-TEST",
    seed: "fixed-seed",
    stage: "opening",
    campaignOpeningPremise: "The player witnesses the attack at the Council Crown.",
    stageAnchor: "The Endless Surge begins.",
    stageMaxThreatLevel: 1,
    turn: 0,
    currentLocation: { id: "LOC-COUNCIL-CROWN", name: "Council Hall", district: "Crown", connections: [], perspectiveTags: [] },
    connectedLocations: [],
    presentCharacterIds: [],
    persistentConsequences: [],
    encounteredScene: null,
    factionPathProgress: [],
    factionConditions: [],
    presentCharacters: [],
    recentTearArrivals: []
  }, "support league");
  assert.equal(plan.toolRequests.length, 1);
  assert.equal(plan.toolRequests[0]?.type, "change_faction_condition");
});
