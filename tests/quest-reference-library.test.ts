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
  assert.equal(JSON.stringify(library).includes("sourceText"), false);
});

test("quest pattern retrieval returns bounded abstract structure rather than source scenes", async () => {
  const library = await loadQuestReferenceLibrary(projectRoot);
  const patterns = retrieveQuestDesignPatterns(library, ["failure", "recovery", "consequence"], 20);
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0]!.id, "QPAT-CONSEQUENCE-CREATES-ROUTE");
  assert.ok(patterns[0]!.transferRules.length >= 2);
  assert.ok(patterns[0]!.forbiddenElements.length >= 2);
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
