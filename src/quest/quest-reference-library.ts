import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type QuestReferenceRightsBasis =
  | "PUBLIC_DOMAIN_US"
  | "CC-BY-4.0"
  | "USER_OWNED"
  | "ORIGINAL"
  | "OBSERVATIONAL_REFERENCE";

export type QuestReferenceSource = {
  id: string;
  title: string;
  creator: string;
  kind: "game" | "developer_commentary" | "design_text" | "velmora_contract";
  url?: string;
  rightsBasis: QuestReferenceRightsBasis;
  allowedUse: "abstract_design_analysis" | "distilled_principles" | "rules_reference";
  attribution?: string;
  storesSourceText: false;
  observedWork?: string;
  recognition?: Array<{ organization: string; award: string; url: string }>;
};

export type QuestDesignPattern = {
  id: string;
  sourceIds: string[];
  tags: string[];
  emotionalPromise: string;
  setupFunction: string;
  pressureFunction: string;
  structuralTurn: string;
  choiceShape: string;
  failureMotion: string;
  consequenceEcho: string;
  transferRules: string[];
  forbiddenElements: string[];
  sourceSpecificReferences: [];
};

export type QuestReferencePolicy = {
  version: number;
  purpose: string;
  minimumDistinctSourcesPerComposition: number;
  maximumPatternsPerComposition: number;
  copiedExpressionAllowed: false;
  storedSourceTextAllowed: false;
  liveModelTrainingAllowed: false;
  requireSourceProvenance: true;
  requireOriginalVelmoraRealization: true;
  prohibitedMaterial: string[];
};

export type QuestReferenceLibrary = {
  policy: QuestReferencePolicy;
  sources: QuestReferenceSource[];
  patterns: QuestDesignPattern[];
};

const ALLOWED_RIGHTS_BASES = new Set<QuestReferenceRightsBasis>([
  "PUBLIC_DOMAIN_US",
  "CC-BY-4.0",
  "USER_OWNED",
  "ORIGINAL",
  "OBSERVATIONAL_REFERENCE"
]);

export async function loadQuestReferenceLibrary(projectRoot: string): Promise<QuestReferenceLibrary> {
  const referenceRoot = resolve(projectRoot, "content", "quest-reference");
  const [policyText, sourcesText, patternsText] = await Promise.all([
    readFile(resolve(referenceRoot, "policy.json"), "utf8"),
    readFile(resolve(referenceRoot, "sources.json"), "utf8"),
    readFile(resolve(referenceRoot, "patterns.json"), "utf8")
  ]);
  const library = {
    policy: JSON.parse(policyText) as QuestReferencePolicy,
    sources: JSON.parse(sourcesText) as QuestReferenceSource[],
    patterns: JSON.parse(patternsText) as QuestDesignPattern[]
  };
  validateQuestReferenceLibrary(library);
  return library;
}

function containsForbiddenSourceField(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsForbiddenSourceField);
  return Object.entries(value).some(([key, nested]) =>
    ["sourceText", "dialogueExcerpt", "questTranscript", "copiedSequence"].includes(key) || containsForbiddenSourceField(nested)
  );
}

export function validateQuestReferenceLibrary(library: QuestReferenceLibrary): void {
  const { policy } = library;
  if (policy.version < 1 || policy.minimumDistinctSourcesPerComposition < 2 || policy.maximumPatternsPerComposition < policy.minimumDistinctSourcesPerComposition) {
    throw new Error("Quest reference policy requires bounded cross-source composition");
  }
  if (policy.copiedExpressionAllowed !== false || policy.storedSourceTextAllowed !== false || policy.liveModelTrainingAllowed !== false) {
    throw new Error("Quest reference policy may not permit copied expression, stored source text, or live model training");
  }
  if (!policy.requireSourceProvenance || !policy.requireOriginalVelmoraRealization || policy.prohibitedMaterial.length < 5) {
    throw new Error("Quest reference policy requires provenance, original realization, and concrete exclusions");
  }
  if (containsForbiddenSourceField(library)) throw new Error("Quest reference library contains a forbidden source-content field");

  const sourceIds = new Set<string>();
  for (const source of library.sources) {
    if (sourceIds.has(source.id)) throw new Error(`Duplicate quest reference source ${source.id}`);
    sourceIds.add(source.id);
    if (!ALLOWED_RIGHTS_BASES.has(source.rightsBasis)) throw new Error(`Unapproved quest reference rights basis ${source.rightsBasis}`);
    if (source.storesSourceText !== false) throw new Error(`Quest reference source ${source.id} may not store source text`);
    if (source.rightsBasis === "OBSERVATIONAL_REFERENCE" && source.allowedUse !== "abstract_design_analysis") {
      throw new Error(`Copyrighted observational source ${source.id} is limited to abstract design analysis`);
    }
    if (source.rightsBasis === "OBSERVATIONAL_REFERENCE" && (!source.url?.trim() || !source.observedWork?.trim() || !source.recognition?.length)) {
      throw new Error(`Copyrighted observational source ${source.id} requires a public design reference and recognition provenance`);
    }
    if (source.rightsBasis === "CC-BY-4.0" && !source.attribution?.trim()) {
      throw new Error(`CC BY quest reference ${source.id} requires attribution`);
    }
  }

  const patternIds = new Set<string>();
  for (const pattern of library.patterns) {
    if (patternIds.has(pattern.id)) throw new Error(`Duplicate quest design pattern ${pattern.id}`);
    patternIds.add(pattern.id);
    if (pattern.sourceIds.length === 0 || pattern.tags.length === 0 || pattern.transferRules.length < 2 || pattern.forbiddenElements.length < 2) {
      throw new Error(`Quest design pattern ${pattern.id} is incomplete`);
    }
    if (pattern.sourceSpecificReferences.length !== 0) throw new Error(`Quest design pattern ${pattern.id} contains source-specific references`);
    for (const sourceId of pattern.sourceIds) {
      if (!sourceIds.has(sourceId)) throw new Error(`Quest design pattern ${pattern.id} references missing source ${sourceId}`);
    }
    const structuralFields = [pattern.emotionalPromise, pattern.setupFunction, pattern.pressureFunction, pattern.structuralTurn, pattern.choiceShape, pattern.failureMotion, pattern.consequenceEcho];
    if (structuralFields.some((value) => value.trim().length < 12)) throw new Error(`Quest design pattern ${pattern.id} requires complete abstract structure`);
  }
}

export function retrieveQuestDesignPatterns(
  library: QuestReferenceLibrary,
  requestedTags: string[],
  limit = 5
): QuestDesignPattern[] {
  const boundedLimit = Math.max(1, Math.min(limit, library.policy.maximumPatternsPerComposition));
  const tags = new Set(requestedTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  return library.patterns
    .map((pattern) => ({
      pattern,
      score: pattern.tags.reduce((total, tag) => total + (tags.has(tag.toLowerCase()) ? 1 : 0), 0)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.pattern.id.localeCompare(right.pattern.id))
    .slice(0, boundedLimit)
    .map((entry) => entry.pattern);
}
