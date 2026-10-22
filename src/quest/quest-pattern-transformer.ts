import { createHash } from "node:crypto";
import { seededSample } from "../application/seeded-random.ts";
import type { QuestDesignPattern, QuestReferenceLibrary } from "./quest-reference-library.ts";

export type QuestDesignFacet = "setup" | "pressure" | "turn" | "failure" | "echo";

export type QuestPatternWorldContext = {
  threadId: string;
  threadTitle: string;
  threadSummary: string;
  locationIds: string[];
  npcIds: string[];
  factionIds: string[];
  capabilityTags: string[];
};

export type QuestPatternCompositionInput = {
  seed: string;
  requestedTags: string[];
  desiredPatternCount?: number;
  maximumDirections: 2 | 3;
  world: QuestPatternWorldContext;
};

export type QuestPatternInfluence = {
  patternId: string;
  sourceIds: string[];
  facets: QuestDesignFacet[];
};

export type QuestPatternRecipe = {
  recipeId: string;
  requestedTags: string[];
  patternIds: string[];
  sourceIds: string[];
  influences: QuestPatternInfluence[];
  world: QuestPatternWorldContext;
  maximumDirections: 2 | 3;
  transformationRequirements: string[];
  originalityRequirements: string[];
};

export type QuestPatternCandidate = {
  recipeId: string;
  goal: string;
  stakes: string;
  directions: Array<{ summary: string; likelyTradeoff: string }>;
  worldEntityIds: string[];
  influences: Array<{ patternId: string; facets: QuestDesignFacet[] }>;
  sourceSpecificReferences: string[];
};

export type QuestSimilaritySignal = {
  sourceId: string;
  kind: "lexical" | "semantic" | "sequence";
  score: number;
};

export type QuestOriginalityEvaluation = {
  accepted: boolean;
  problems: string[];
  distinctSourceCount: number;
  maximumPatternPhraseOverlap: number;
};

const FACETS: QuestDesignFacet[] = ["setup", "pressure", "turn", "failure", "echo"];

function normalizedTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].sort();
}

function sourceIdsForPatterns(patterns: QuestDesignPattern[]): string[] {
  return [...new Set(patterns.flatMap((pattern) => pattern.sourceIds))].sort();
}

function scorePattern(pattern: QuestDesignPattern, tags: Set<string>): number {
  return pattern.tags.reduce((score, tag) => score + Number(tags.has(tag.toLowerCase())), 0);
}

function chooseRelevantPatterns(
  library: QuestReferenceLibrary,
  seed: string,
  requestedTags: string[],
  desiredPatternCount: number
): QuestDesignPattern[] {
  const tags = new Set(requestedTags);
  const scored = library.patterns
    .map((pattern) => ({ pattern, score: scorePattern(pattern, tags) }))
    .filter((entry) => entry.score > 0);
  const ordered: QuestDesignPattern[] = [];
  for (const score of [...new Set(scored.map((entry) => entry.score))].sort((left, right) => right - left)) {
    const tied = scored.filter((entry) => entry.score === score).map((entry) => entry.pattern);
    ordered.push(...seededSample(`${seed}|quest-pattern-score|${score}`, tied, tied.length));
  }

  const selected: QuestDesignPattern[] = [];
  const coveredSources = new Set<string>();
  for (const pattern of ordered) {
    if (selected.length >= desiredPatternCount) break;
    if (pattern.sourceIds.some((sourceId) => !coveredSources.has(sourceId))) {
      selected.push(pattern);
      pattern.sourceIds.forEach((sourceId) => coveredSources.add(sourceId));
    }
  }
  for (const pattern of ordered) {
    if (selected.length >= desiredPatternCount) break;
    if (!selected.includes(pattern)) selected.push(pattern);
  }
  return selected;
}

function validateWorldContext(world: QuestPatternWorldContext): void {
  if (!world.threadId.trim() || !world.threadTitle.trim() || !world.threadSummary.trim()) {
    throw new Error("Quest-pattern transformation requires an established story thread");
  }
  const bindings = [...world.locationIds, ...world.npcIds, ...world.factionIds];
  if (bindings.some((id) => !id.trim())) throw new Error("Quest-pattern world bindings require stable IDs");
  if (new Set(bindings).size !== bindings.length) throw new Error("Quest-pattern world bindings may not contain duplicate IDs");
}

export function composeQuestPatternRecipe(
  library: QuestReferenceLibrary,
  input: QuestPatternCompositionInput
): QuestPatternRecipe {
  validateWorldContext(input.world);
  const requestedTags = normalizedTags(input.requestedTags);
  if (requestedTags.length === 0) throw new Error("Quest-pattern transformation requires causal tags");
  const minimum = library.policy.minimumDistinctSourcesPerComposition;
  const desiredPatternCount = input.desiredPatternCount ?? minimum;
  if (!Number.isInteger(desiredPatternCount) || desiredPatternCount < minimum || desiredPatternCount > library.policy.maximumPatternsPerComposition) {
    throw new Error(`Quest-pattern composition must use ${minimum} to ${library.policy.maximumPatternsPerComposition} patterns`);
  }
  const patterns = chooseRelevantPatterns(library, input.seed, requestedTags, desiredPatternCount);
  const sourceIds = sourceIdsForPatterns(patterns);
  if (patterns.length < desiredPatternCount || sourceIds.length < minimum) {
    throw new Error("The established quest need does not support enough causally relevant, distinct reference sources");
  }

  const facetAssignments = new Map<string, QuestDesignFacet[]>();
  FACETS.forEach((facet, index) => {
    const pattern = patterns[index % patterns.length]!;
    facetAssignments.set(pattern.id, [...(facetAssignments.get(pattern.id) ?? []), facet]);
  });
  const influences = patterns.map((pattern) => ({
    patternId: pattern.id,
    sourceIds: [...pattern.sourceIds].sort(),
    facets: facetAssignments.get(pattern.id) ?? []
  }));
  const fingerprint = JSON.stringify({
    seed: input.seed,
    tags: requestedTags,
    patterns: patterns.map((pattern) => pattern.id),
    threadId: input.world.threadId,
    maximumDirections: input.maximumDirections
  });

  return {
    recipeId: `QRECIPE-${createHash("sha256").update(fingerprint).digest("hex").slice(0, 16).toUpperCase()}`,
    requestedTags,
    patternIds: patterns.map((pattern) => pattern.id),
    sourceIds,
    influences,
    world: {
      ...input.world,
      locationIds: [...input.world.locationIds],
      npcIds: [...input.world.npcIds],
      factionIds: [...input.world.factionIds],
      capabilityTags: normalizedTags(input.world.capabilityTags)
    },
    maximumDirections: input.maximumDirections,
    transformationRequirements: [
      "Construct the goal and stakes only from the bound story thread and current Velmora world state.",
      "Use the assigned design facets as functions, not as text to paraphrase or a scene sequence to reproduce.",
      "Offer two credible directions, with a third only when the recipe explicitly permits it and world state supports it.",
      "Preserve actual failure and consequence state instead of resetting an intended route."
    ],
    originalityRequirements: [
      "Use only stable Velmora entity IDs supplied by this recipe.",
      "Do not reproduce source identities, dialogue, setting, signature objects, twists, set pieces, or quest sequences.",
      "Do not let one reference pattern control more than two design facets.",
      "Reject the candidate when lexical, semantic, or sequence similarity exceeds the approved thresholds."
    ]
  };
}

function words(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

function shingles(value: string, width = 5): Set<string> {
  const tokens = words(value);
  const result = new Set<string>();
  for (let index = 0; index <= tokens.length - width; index += 1) result.add(tokens.slice(index, index + width).join(" "));
  return result;
}

function patternText(pattern: QuestDesignPattern): string {
  return [
    pattern.emotionalPromise,
    pattern.setupFunction,
    pattern.pressureFunction,
    pattern.structuralTurn,
    pattern.choiceShape,
    pattern.failureMotion,
    pattern.consequenceEcho,
    ...pattern.transferRules
  ].join(" ");
}

function overlapRatio(candidateText: string, referenceText: string): number {
  const candidate = shingles(candidateText);
  if (candidate.size === 0) return 0;
  const reference = shingles(referenceText);
  let overlap = 0;
  for (const value of candidate) if (reference.has(value)) overlap += 1;
  return overlap / candidate.size;
}

export function evaluateQuestPatternCandidate(
  library: QuestReferenceLibrary,
  recipe: QuestPatternRecipe,
  candidate: QuestPatternCandidate,
  similaritySignals: QuestSimilaritySignal[] = []
): QuestOriginalityEvaluation {
  const problems: string[] = [];
  if (candidate.recipeId !== recipe.recipeId) problems.push("Candidate does not belong to the supplied transformation recipe");
  if (!candidate.goal.trim() || !candidate.stakes.trim()) problems.push("Candidate requires a concrete goal and stakes");
  if (candidate.directions.length < 2 || candidate.directions.length > recipe.maximumDirections) {
    problems.push(`Candidate requires two to ${recipe.maximumDirections} credible directions`);
  }
  if (candidate.directions.some((direction) => !direction.summary.trim() || !direction.likelyTradeoff.trim())) {
    problems.push("Every candidate direction requires a summary and likely tradeoff");
  }
  if (candidate.sourceSpecificReferences.length > 0) problems.push("Candidate contains source-specific references");

  const allowedWorldIds = new Set([
    recipe.world.threadId,
    ...recipe.world.locationIds,
    ...recipe.world.npcIds,
    ...recipe.world.factionIds
  ]);
  if (!candidate.worldEntityIds.includes(recipe.world.threadId)) problems.push("Candidate must remain grounded in its source story thread");
  for (const id of candidate.worldEntityIds) {
    if (!allowedWorldIds.has(id)) problems.push(`Candidate introduced an unbound world entity ${id}`);
  }

  const allowedPatternIds = new Set(recipe.patternIds);
  const influencedPatternIds = new Set<string>();
  for (const influence of candidate.influences) {
    if (!allowedPatternIds.has(influence.patternId)) problems.push(`Candidate used an unselected reference pattern ${influence.patternId}`);
    if (influencedPatternIds.has(influence.patternId)) problems.push(`Candidate repeats reference pattern ${influence.patternId}`);
    if (influence.facets.length === 0) problems.push(`Candidate pattern ${influence.patternId} has no applied design facet`);
    if (new Set(influence.facets).size !== influence.facets.length) problems.push(`Candidate pattern ${influence.patternId} repeats a design facet`);
    if (influence.facets.length > 2) problems.push(`Candidate pattern ${influence.patternId} dominates more than two design facets`);
    influence.facets.forEach((facet) => {
      if (!FACETS.includes(facet)) problems.push(`Candidate contains an unknown design facet ${facet}`);
    });
    influencedPatternIds.add(influence.patternId);
  }
  const contributingSources = new Set(
    recipe.influences
      .filter((influence) => influencedPatternIds.has(influence.patternId))
      .flatMap((influence) => influence.sourceIds)
  );
  if (contributingSources.size < library.policy.minimumDistinctSourcesPerComposition) {
    problems.push(`Candidate must materially combine at least ${library.policy.minimumDistinctSourcesPerComposition} distinct sources`);
  }
  const appliedFacets = candidate.influences.flatMap((influence) => influence.facets);
  if (appliedFacets.length !== FACETS.length || new Set(appliedFacets).size !== FACETS.length || FACETS.some((facet) => !appliedFacets.includes(facet))) {
    problems.push("Candidate must account for setup, pressure, turn, failure, and echo exactly once");
  }

  const candidateText = [candidate.goal, candidate.stakes, ...candidate.directions.flatMap((direction) => [direction.summary, direction.likelyTradeoff])].join(" ");
  const selectedPatterns = library.patterns.filter((pattern) => allowedPatternIds.has(pattern.id));
  const maximumPatternPhraseOverlap = selectedPatterns.reduce(
    (maximum, pattern) => Math.max(maximum, overlapRatio(candidateText, patternText(pattern))),
    0
  );
  if (maximumPatternPhraseOverlap > 0.4) problems.push("Candidate copies too much phrasing from an abstract reference pattern");

  const knownSourceIds = new Set(library.sources.map((source) => source.id));
  for (const signal of similaritySignals) {
    if (!knownSourceIds.has(signal.sourceId)) problems.push(`Similarity signal references unknown source ${signal.sourceId}`);
    if (!Number.isFinite(signal.score) || signal.score < 0 || signal.score > 1) {
      problems.push("Similarity scores must be between zero and one");
      continue;
    }
    const threshold = signal.kind === "semantic" ? 0.72 : signal.kind === "sequence" ? 0.5 : 0.35;
    if (signal.score >= threshold) problems.push(`Candidate exceeds the ${signal.kind} similarity threshold for ${signal.sourceId}`);
  }

  return {
    accepted: problems.length === 0,
    problems: [...new Set(problems)],
    distinctSourceCount: contributingSources.size,
    maximumPatternPhraseOverlap
  };
}
