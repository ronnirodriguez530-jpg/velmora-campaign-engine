import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import {
  composeQuestPatternRecipe,
  evaluateQuestPatternCandidate,
  type QuestPatternCandidate,
  type QuestPatternRecipe
} from "../src/quest/quest-pattern-transformer.ts";
import { loadQuestReferenceLibrary } from "../src/quest/quest-reference-library.ts";

const projectRoot = resolve(import.meta.dirname, "..");

function compositionInput() {
  return {
    seed: "velmora-pattern-test",
    requestedTags: ["choice", "consequence", "failure", "recovery"],
    desiredPatternCount: 3,
    maximumDirections: 2 as const,
    world: {
      threadId: "THREAD-GLASS-PRESSURE",
      threadTitle: "Missing ledgers beneath the Glass Archive",
      threadSummary: "Several public records vanished while rival officials blame one another.",
      locationIds: ["LOC-GLASS-ARCHIVE"],
      npcIds: ["NPC-ARCHIVIST"],
      factionIds: ["ORDER_OF_GLASS"],
      capabilityTags: ["investigation", "social"]
    }
  };
}

function originalCandidate(recipe: QuestPatternRecipe): QuestPatternCandidate {
  return {
    recipeId: recipe.recipeId,
    goal: "Determine who moved the missing civic ledgers and prevent the records from being used against uninvolved residents.",
    stakes: "Moving openly may preserve public trust but alert the hidden broker; moving quietly may protect the trail while leaving officials free to accuse one another.",
    directions: [
      {
        summary: "Compare archive access records with testimony from the archivist before confronting anyone.",
        likelyTradeoff: "The additional verification gives whoever holds the ledgers more time to relocate them."
      },
      {
        summary: "Use the conflicting accusations to pressure one official into revealing the private exchange route.",
        likelyTradeoff: "Leverage may expose the route quickly while creating an obligation to the cooperating official."
      }
    ],
    worldEntityIds: ["THREAD-GLASS-PRESSURE", "LOC-GLASS-ARCHIVE", "NPC-ARCHIVIST", "ORDER_OF_GLASS"],
    influences: recipe.influences.map((influence) => ({ patternId: influence.patternId, facets: [...influence.facets] })),
    sourceSpecificReferences: []
  };
}

test("quest-pattern recipes deterministically combine at least three causally relevant sources", async () => {
  const library = await loadQuestReferenceLibrary(projectRoot);
  const first = composeQuestPatternRecipe(library, compositionInput());
  const second = composeQuestPatternRecipe(library, compositionInput());
  assert.deepEqual(second, first);
  assert.equal(first.patternIds.length, 3);
  assert.ok(first.sourceIds.length >= library.policy.minimumDistinctSourcesPerComposition);
  assert.equal(new Set(first.influences.flatMap((influence) => influence.facets)).size, 5);
  assert.ok(first.influences.every((influence) => influence.facets.length <= 2));
  assert.deepEqual(first.world.locationIds, ["LOC-GLASS-ARCHIVE"]);
});

test("quest-pattern composition does not force unrelated sources to satisfy diversity", async () => {
  const library = await loadQuestReferenceLibrary(projectRoot);
  assert.throws(() => composeQuestPatternRecipe(library, {
    ...compositionInput(),
    requestedTags: ["nonlinear"],
    desiredPatternCount: 3
  }), /does not support enough causally relevant, distinct reference sources/);
});

test("original Velmora candidate passes bounded transformation and originality checks", async () => {
  const library = await loadQuestReferenceLibrary(projectRoot);
  const recipe = composeQuestPatternRecipe(library, compositionInput());
  const evaluation = evaluateQuestPatternCandidate(library, recipe, originalCandidate(recipe));
  assert.equal(evaluation.accepted, true, evaluation.problems.join("; "));
  assert.ok(evaluation.distinctSourceCount >= 3);
  assert.ok(evaluation.maximumPatternPhraseOverlap < 0.4);
});

test("candidate rejects unbound entities, source references, pattern dominance, and excessive similarity", async () => {
  const library = await loadQuestReferenceLibrary(projectRoot);
  const recipe = composeQuestPatternRecipe(library, compositionInput());
  const candidate = originalCandidate(recipe);
  candidate.worldEntityIds.push("NPC-UNBOUND-SAVIOR");
  candidate.sourceSpecificReferences.push("Use a recognizable source quest character as the broker");
  candidate.influences = [
    { patternId: recipe.patternIds[0]!, facets: ["setup", "pressure", "turn"] },
    { patternId: recipe.patternIds[1]!, facets: ["failure"] },
    { patternId: recipe.patternIds[2]!, facets: ["echo"] },
    { patternId: recipe.patternIds[0]!, facets: [] }
  ];
  const evaluation = evaluateQuestPatternCandidate(library, recipe, candidate, [
    { sourceId: recipe.sourceIds[0]!, kind: "semantic", score: 0.91 },
    { sourceId: recipe.sourceIds[1]!, kind: "sequence", score: 0.64 }
  ]);
  assert.equal(evaluation.accepted, false);
  assert.ok(evaluation.problems.some((problem) => problem.includes("unbound world entity")));
  assert.ok(evaluation.problems.some((problem) => problem.includes("source-specific references")));
  assert.ok(evaluation.problems.some((problem) => problem.includes("dominates")));
  assert.ok(evaluation.problems.some((problem) => problem.includes("repeats reference pattern")));
  assert.ok(evaluation.problems.some((problem) => problem.includes("semantic similarity threshold")));
  assert.ok(evaluation.problems.some((problem) => problem.includes("sequence similarity threshold")));
});

test("candidate rejects copied pattern phrasing even without an external similarity service", async () => {
  const library = await loadQuestReferenceLibrary(projectRoot);
  const recipe = composeQuestPatternRecipe(library, compositionInput());
  const pattern = library.patterns.find((entry) => entry.id === recipe.patternIds[0])!;
  const candidate = originalCandidate(recipe);
  candidate.goal = [
    pattern.emotionalPromise,
    pattern.setupFunction,
    pattern.pressureFunction,
    pattern.structuralTurn,
    pattern.choiceShape
  ].join(" ");
  candidate.stakes = pattern.failureMotion;
  candidate.directions[0]!.summary = pattern.consequenceEcho;
  const evaluation = evaluateQuestPatternCandidate(library, recipe, candidate);
  assert.equal(evaluation.accepted, false);
  assert.ok(evaluation.problems.some((problem) => problem.includes("copies too much phrasing")));
});
