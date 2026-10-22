import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { loadQuestReferenceLibrary, retrieveQuestDesignPatterns, validateQuestReferenceLibrary } from "../src/quest/quest-reference-library.ts";

const projectRoot = resolve(import.meta.dirname, "..");

test("quest references preserve provenance without storing protected source content", async () => {
  const library = await loadQuestReferenceLibrary(projectRoot);
  assert.equal(library.policy.minimumDistinctSourcesPerComposition, 3);
  assert.equal(library.policy.copiedExpressionAllowed, false);
  assert.equal(library.policy.storedSourceTextAllowed, false);
  assert.equal(library.policy.liveModelTrainingAllowed, false);
  assert.ok(library.sources.every((source) => source.storesSourceText === false));
  assert.ok(library.patterns.every((pattern) => pattern.sourceSpecificReferences.length === 0));
  const observational = library.sources.filter((source) => source.rightsBasis === "OBSERVATIONAL_REFERENCE");
  assert.equal(observational.length, 9);
  assert.ok(observational.every((source) => source.allowedUse === "abstract_design_analysis" && Boolean(source.observedWork) && Boolean(source.recognition?.length)));
  assert.equal(JSON.stringify(library).includes("sourceText"), false);
});

test("first acclaimed-game batch yields distinct abstract lessons without source identities", async () => {
  const library = await loadQuestReferenceLibrary(projectRoot);
  const patterns = retrieveQuestDesignPatterns(library, ["exploration", "dialogue", "callback"], 5);
  const ids = patterns.map((pattern) => pattern.id);
  assert.ok(ids.includes("QPAT-CURIOSITY-LED-PROGRESSION"));
  assert.ok(ids.includes("QPAT-EXPRESSIVE-BRANCHING"));
  assert.ok(ids.includes("QPAT-PERSISTENT-REACTIVE-STORY"));
  assert.ok(patterns.every((pattern) => pattern.sourceSpecificReferences.length === 0));
  assert.equal(JSON.stringify(patterns).includes("Zagreus"), false);
  assert.equal(JSON.stringify(patterns).includes("Revachol"), false);
});

test("deeper acclaimed-game batch covers six missing quest-design departments", async () => {
  const library = await loadQuestReferenceLibrary(projectRoot);
  const expected = new Map([
    ["moral_choice", "QPAT-MORAL-RECONTEXTUALIZATION"],
    ["faction", "QPAT-FACTION-PLURALISM"],
    ["unexpected_solution", "QPAT-RESILIENT-UNEXPECTED-SOLUTION"],
    ["investigation", "QPAT-INCOMPLETE-INVESTIGATION"],
    ["capability", "QPAT-CAPABILITY-BASED-APPROACHES"],
    ["convergence", "QPAT-RELATIONSHIP-PAYOFF-CONVERGENCE"]
  ]);
  for (const [tag, patternId] of expected) {
    const matches = retrieveQuestDesignPatterns(library, [tag], 5);
    assert.ok(matches.some((pattern) => pattern.id === patternId), `${tag} should retrieve ${patternId}`);
  }
  const deepPatterns = library.patterns.filter((pattern) => [...expected.values()].includes(pattern.id));
  assert.equal(deepPatterns.length, 6);
  assert.ok(deepPatterns.every((pattern) => pattern.sourceSpecificReferences.length === 0));
  const serialized = JSON.stringify(deepPatterns);
  for (const protectedIdentity of ["Geralt", "Mojave", "Gondian", "Andreas", "Shepard", "Adam Jensen"]) {
    assert.equal(serialized.includes(protectedIdentity), false);
  }
});

test("quest pattern retrieval returns bounded abstract structure rather than source scenes", async () => {
  const library = await loadQuestReferenceLibrary(projectRoot);
  const patterns = retrieveQuestDesignPatterns(library, ["failure", "recovery", "consequence"], 20);
  assert.ok(patterns.length >= 1 && patterns.length <= library.policy.maximumPatternsPerComposition);
  assert.equal(patterns[0]!.id, "QPAT-CONSEQUENCE-CREATES-ROUTE");
  assert.ok(patterns.every((pattern) => pattern.transferRules.length >= 2));
  assert.ok(patterns.every((pattern) => pattern.forbiddenElements.length >= 2));
});

test("copyrighted observational references cannot carry source text or non-abstract authority", () => {
  const base = {
    policy: {
      version: 1,
      purpose: "Test only",
      minimumDistinctSourcesPerComposition: 3,
      maximumPatternsPerComposition: 5,
      copiedExpressionAllowed: false as const,
      storedSourceTextAllowed: false as const,
      liveModelTrainingAllowed: false as const,
      requireSourceProvenance: true as const,
      requireOriginalVelmoraRealization: true as const,
      prohibitedMaterial: ["dialogue", "characters", "lore", "assets", "sequences"]
    },
    patterns: []
  };
  assert.throws(() => validateQuestReferenceLibrary({
    ...base,
    sources: [{
      id: "SRC-TEST-GAME",
      title: "Test Game",
      creator: "Test Studio",
      kind: "game",
      rightsBasis: "OBSERVATIONAL_REFERENCE",
      allowedUse: "rules_reference",
      storesSourceText: false
    }]
  }), /limited to abstract design analysis/);

  assert.throws(() => validateQuestReferenceLibrary({
    ...base,
    sources: [{
      id: "SRC-TEST-GAME",
      title: "Test Game",
      creator: "Test Studio",
      kind: "game",
      rightsBasis: "OBSERVATIONAL_REFERENCE",
      allowedUse: "abstract_design_analysis",
      storesSourceText: false,
      sourceText: "Copied quest material"
    } as never]
  }), /forbidden source-content field/);
});
