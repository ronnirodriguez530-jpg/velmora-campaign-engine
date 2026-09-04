import test from "node:test";
import assert from "node:assert/strict";
import { CloudDirector } from "../src/director/cloud-director.ts";
import type { DirectorPlanningContext } from "../src/domain/types.ts";

const context: DirectorPlanningContext = {
  campaignId: "SAVE-TEST",
  seed: "fixed-seed",
  stage: "opening",
  campaignOpeningPremise: "The player witnesses the attack at the Council Crown.",
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
  recentTearArrivals: [],
  npcContext: { full: [], supporting: [], omittedCount: 0, budgetUsed: 0, budgetLimit: 36 },
  publicFacts: [],
  playerCharacter: null,
  playerKnownStoryThreads: [],
  visibleOpeningPressure: null,
  directorStoryThreads: [],
  directorQuests: [],
  recoveryEvidenceEvents: [],
  campaignBlueprint: {
    campaignId: "SAVE-TEST",
    version: 1,
    openingPressure: { id: "OPEN-TEST", title: "Test pressure", summary: "A bounded test pressure.", threatLevel: 1, tags: ["test"] },
    focalFactionIds: ["FAC-001", "FAC-002"],
    factionPressure: { id: "FACTION-TEST", summary: "A bounded faction pressure." },
    clueRoutes: [{ id: "CLUE-TEST", summary: "A bounded clue route." }],
    reversal: { id: "REVERSAL-TEST", summary: "A later bounded reversal.", minimumStage: "stabilization" },
    endgameMinimumStage: "resolution",
    createdTurn: 0
  }
};

test("cloud Director requests a bounded hidden-DC action check", async () => {
  let sentBody: Record<string, unknown> | undefined;
  const fakeFetch = async (_input: string | URL | Request, init?: RequestInit) => {
    sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      output: [{
        type: "function_call",
        name: "assess_player_action",
        arguments: JSON.stringify({
          resolution: "check",
          category: "skill",
          ability: "dexterity",
          skill: "stealth",
          difficulty: "hard",
          mode: "advantage",
          stakes: "Cross unseen or alert the patrol while retaining an escape route.",
          reason: "The patrol makes the attempt uncertain and meaningful."
        })
      }]
    }));
  };
  const director = new CloudDirector({ apiKey: "test-key", fetchImpl: fakeFetch });
  const assessment = await director.assessAction(context, "Slip past the patrol");
  assert.equal(assessment.resolution, "check");
  if (assessment.resolution === "check") {
    assert.equal(assessment.skill, "stealth");
    assert.equal(assessment.difficulty, "hard");
    assert.equal(assessment.mode, "advantage");
  }
  const tool = (sentBody?.tools as Array<Record<string, unknown>>)[0];
  assert.equal(tool.name, "assess_player_action");
  assert.equal(tool.strict, true);
});

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
          npcRequests: [],
          npcUpdates: [],
          storyThreadUpdates: [],
          storyThreadCreations: [],
          questGenerations: [],
          questRecoveries: [],
          questUpdates: [],
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

test("cloud Director can request one bounded minor NPC without creating it directly", async () => {
  const fakeFetch = async () => new Response(JSON.stringify({
    output: [{
      type: "function_call",
      name: "submit_turn_plan",
      arguments: JSON.stringify({
        summary: "The search points toward a local repairer.",
        majorActionProposal: true,
        factionChanges: [],
        npcReputationChanges: [],
        movements: [],
        factionPathAdvances: [],
        locationConsequences: [],
        npcRequests: [{
          role: "council lamp repairer",
          factionId: null,
          locationId: "LOC-COUNCIL-CROWN",
          category: "active",
          reason: "The committed player search requires a persistent specialist."
        }],
        npcUpdates: [],
        storyThreadUpdates: [],
        storyThreadCreations: [],
        questGenerations: [],
        questRecoveries: [],
        questUpdates: [],
        suggestedActions: ["Question the repairer", "Inspect the lamp"],
        allowsFreeText: true
      })
    }]
  }), { status: 200, headers: { "content-type": "application/json" } });
  const plan = await new CloudDirector({ apiKey: "test-key", fetchImpl: fakeFetch }).planTurn(context, "find the repairer");
  assert.equal(plan.toolRequests.length, 1);
  assert.equal(plan.toolRequests[0]?.type, "request_minor_npc");
});

test("cloud Director can propose one sourced non-main story thread", async () => {
  const fakeFetch = async () => new Response(JSON.stringify({
    output: [{
      type: "function_call",
      name: "submit_turn_plan",
      arguments: JSON.stringify({
        summary: "The player commits to a rescue that cannot be completed immediately.",
        majorActionProposal: true,
        factionChanges: [],
        npcReputationChanges: [],
        movements: [],
        factionPathAdvances: [],
        locationConsequences: [],
        npcRequests: [],
        npcUpdates: [],
        storyThreadUpdates: [],
        storyThreadCreations: [{
          threadId: "THREAD-PLAYER-RESCUE-PROMISE",
          origin: "player_goal",
          basisId: "player_input",
          kind: "personal",
          title: "A Rescue Promise",
          summary: "The player promised to continue an unfinished rescue.",
          visibility: "player",
          maximumStage: "stabilization",
          urgency: 2,
          locationIds: ["LOC-COUNCIL-CROWN"],
          factionIds: [],
          npcIds: [],
          recoveryPaths: ["A survivor can provide another lead."],
          reason: "The player explicitly accepted unfinished responsibility."
        }],
        questGenerations: [],
        questRecoveries: [],
        questUpdates: [],
        suggestedActions: ["Follow the rescue route", "Question survivors"],
        allowsFreeText: true
      })
    }]
  }), { status: 200, headers: { "content-type": "application/json" } });
  const plan = await new CloudDirector({ apiKey: "test-key", fetchImpl: fakeFetch }).planTurn(context, "I promise to finish the rescue");
  assert.equal(plan.toolRequests.length, 1);
  assert.equal(plan.toolRequests[0]?.type, "create_story_thread");
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

test("cloud Director can request engine-owned quest generation and recovery", async () => {
  const fakeFetch = async () => new Response(JSON.stringify({
    output: [{
      type: "function_call",
      name: "submit_turn_plan",
      arguments: JSON.stringify({
        summary: "The opening pressure becomes a concrete objective.",
        majorActionProposal: true,
        factionChanges: [],
        npcReputationChanges: [],
        movements: [],
        factionPathAdvances: [],
        locationConsequences: [],
        npcRequests: [],
        npcUpdates: [],
        storyThreadUpdates: [],
        storyThreadCreations: [],
        questGenerations: [{
          sourceThreadId: "THREAD-OPENING-PRESSURE",
          relationships: [],
          reason: "The active visible crisis needs a playable quest structure."
        }],
        questRecoveries: [{
          failedQuestId: "QUEST-OPENING-PRESSURE-01",
          recoveryPath: "A survivor can reveal an altered route.",
          consequenceEventSequences: [12],
          reason: "The supplied failed quest retains this exact recovery path."
        }],
        questUpdates: [],
        suggestedActions: ["Accept the objective", "Study the immediate danger"],
        allowsFreeText: true
      })
    }]
  }), { status: 200, headers: { "content-type": "application/json" } });
  const plan = await new CloudDirector({ apiKey: "test-key", fetchImpl: fakeFetch }).planTurn(context, "respond to the crisis");
  assert.equal(plan.toolRequests.length, 2);
  assert.equal(plan.toolRequests[0]?.type, "generate_quest");
  assert.equal(plan.toolRequests[1]?.type, "generate_recovery_quest");
});
