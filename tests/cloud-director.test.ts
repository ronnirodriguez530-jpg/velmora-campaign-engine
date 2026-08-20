import test from "node:test";
import assert from "node:assert/strict";
import { CloudDirector } from "../src/director/cloud-director.ts";
import type { PerspectiveContext } from "../src/domain/types.ts";

const context: PerspectiveContext = {
  campaignId: "SAVE-TEST",
  seed: "fixed-seed",
  stage: "opening",
  stageAnchor: "The Endless Surge begins.",
  stageMaxThreatLevel: 1,
  turn: 0,
  currentLocation: { id: "LOC-COUNCIL-CROWN", name: "Council Hall", district: "Crown", connections: [], perspectiveTags: [] },
  connectedLocations: [],
  presentCharacterIds: ["NPC-FIRST-SPEAKER"],
  persistentConsequences: [],
  encounteredScene: null,
  factionPathProgress: [],
  factionConditions: [],
  presentCharacters: [],
  recentTearArrivals: []
};

test("cloud Director submits a strict bounded plan without executing it", async () => {
  let sentBody: Record<string, unknown> | undefined;
  const fakeFetch = async (_input: string | URL | Request, init?: RequestInit) => {
    sentBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      output: [{
        type: "function_call",
        name: "submit_turn_plan",
        arguments: JSON.stringify({
          summary: "The League acknowledges the player's support.",
          majorActionProposal: true,
          factionChanges: [{ factionId: "FAC-001", delta: 1, reason: "Direct player support" }],
          npcReputationChanges: [],
          movements: [],
          factionPathAdvances: [],
          locationConsequences: [],
          suggestedActions: ["Ask what the League needs", "Return to the avenue"],
          allowsFreeText: true
        })
      }]
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const plan = await new CloudDirector({ apiKey: "test-key", fetchImpl: fakeFetch }).planTurn(context, "support the League");
  assert.equal(plan.toolRequests.length, 1);
  assert.equal(plan.toolRequests[0]?.type, "change_faction_condition");
  const tool = (sentBody?.tools as Array<Record<string, unknown>>)[0];
  assert.equal(tool.strict, true);
  assert.equal((tool.parameters as Record<string, unknown>).additionalProperties, false);
});

test("cloud Director rejects malformed provider output", async () => {
  const fakeFetch = async () => new Response(JSON.stringify({ output: [{ type: "message" }] }), { status: 200 });
  const director = new CloudDirector({ apiKey: "test-key", fetchImpl: fakeFetch });
  await assert.rejects(() => director.planTurn(context, "wait"), /did not submit a turn plan/);
});

test("cloud Campaign Master presents a grounded story scene", async () => {
  const fakeFetch = async () => new Response(JSON.stringify({ output: [{
    type: "function_call",
    name: "present_scene",
    arguments: JSON.stringify({ title: "The Crown Trembles", narration: "A violet pulse travels through the council stone.", suggestedActions: ["Approach the chamber", "Question the guard"] })
  }] }), { status: 200, headers: { "content-type": "application/json" } });
  const director = new CloudDirector({ apiKey: "test-key", fetchImpl: fakeFetch });
  const scene = {
    id: "SCN-TEST", campaignId: context.campaignId, turn: 0, stage: context.stage, locationId: context.currentLocation.id,
    participantIds: [], factionIds: [], questLinks: [], conflictKey: "pressure", objectiveKey: "assess", threatLevel: 1,
    visibleFacts: [], proposedConsequences: [], suggestedActions: ["A", "B"] as [string, string], allowsFreeText: true as const, templateId: "TPL-SCAFFOLD-OPENING"
  };
  const presentation = await director.presentScene(context, scene);
  assert.equal(presentation.source, "cloud");
  assert.equal(presentation.sceneId, scene.id);
  assert.equal(presentation.suggestedActions.length, 2);
});
