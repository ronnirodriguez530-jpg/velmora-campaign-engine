import type { DatabaseSync } from "node:sqlite";
import type { CreateQuestInput } from "./quest-system.ts";
import type { QuestDirection, QuestRelationship, StoryThread, VelmoraContent } from "../domain/types.ts";
import { listQuestInstances, listStoryThreads } from "../persistence/database.ts";
import { seededSample } from "./seeded-random.ts";
import { applyQuestCreation, createQuestInstance, QUEST_TYPE_BY_THREAD_KIND, validateQuestCreation } from "./quest-system.ts";

type ObjectiveFamily = "discover" | "influence" | "secure" | "change";
type PressureFamily = "opposition" | "instability" | "scarcity" | "conflict";
type ComplicationFamily = "new_information" | "changed_access" | "third_party" | "bounded_cost";

type QuestModule = {
  key: string;
  family: ObjectiveFamily;
  directionSummary: (thread: StoryThread) => string;
  likelyTradeoff: (thread: StoryThread) => string;
  approachKey: string;
  tradeoffKey: string;
  costKey: string;
  immediateObjective: (thread: StoryThread) => string;
  causalScore: (thread: StoryThread) => number;
};

type PressureModule = {
  family: PressureFamily;
  causalScore: (thread: StoryThread) => number;
  stakes: (thread: StoryThread) => string;
};

type ComplicationModule = {
  family: ComplicationFamily;
  causalScore: (thread: StoryThread) => number;
  seed: (thread: StoryThread) => string;
};

const OBJECTIVE_MODULES: QuestModule[] = [
  {
    key: "discover",
    family: "discover",
    directionSummary: (thread) => `Investigate what is driving ${thread.title} before choosing an intervention.`,
    likelyTradeoff: () => "Greater certainty may give the active pressure room to move.",
    approachKey: "evidence-first",
    tradeoffKey: "certainty-before-speed",
    costKey: "time-and-exposure",
    immediateObjective: (thread) => `Find one reliable lead that reveals what is driving ${thread.title}.`,
    causalScore: (thread) => 1 + Number(thread.kind === "main" || thread.kind === "mystery") + Number(thread.urgency >= 2)
  },
  {
    key: "secure",
    family: "secure",
    directionSummary: (thread) => `Secure what is currently endangered by ${thread.title}.`,
    likelyTradeoff: () => "Immediate protection may leave less reach for pursuing the source.",
    approachKey: "protection-first",
    tradeoffKey: "safety-before-pursuit",
    costKey: "lost-ground-or-limited-cover",
    immediateObjective: (thread) => `Reach and secure the most exposed part of ${thread.title}.`,
    causalScore: (thread) => Number(thread.npcIds.length > 0 || thread.locationIds.length > 0) + Number(thread.urgency >= 2) + Number(thread.kind === "personal")
  },
  {
    key: "influence",
    family: "influence",
    directionSummary: (thread) => `Influence the people shaping ${thread.title} through cooperation, leverage, or deception.`,
    likelyTradeoff: () => "Support may require an obligation, concession, or loss of independence.",
    approachKey: "negotiation-first",
    tradeoffKey: "obligation-for-cooperation",
    costKey: "independence-or-political-capital",
    immediateObjective: (thread) => `Establish what one involved party wants from ${thread.title} and what could move them.`,
    causalScore: (thread) => Number(thread.npcIds.length > 0) + Number(thread.factionIds.length > 0) * 2 + Number(thread.kind === "faction")
  },
  {
    key: "change",
    family: "change",
    directionSummary: (thread) => `Directly change, contain, disrupt, repair, or remove the cause sustaining ${thread.title}.`,
    likelyTradeoff: () => "Changing the source may create a cost elsewhere or close off a gentler option.",
    approachKey: "change-the-source",
    tradeoffKey: "direct-change-versus-secondary-cost",
    costKey: "resources-access-or-trust",
    immediateObjective: (thread) => `Reach the part of ${thread.title} that can still be directly changed.`,
    causalScore: (thread) => Number(thread.locationIds.length > 0) + Number(thread.kind === "dynamic" || thread.kind === "mystery") + Number(thread.urgency >= 2)
  }
];

const PRESSURE_MODULES: PressureModule[] = [
  { family: "opposition", causalScore: (thread) => thread.factionIds.length + thread.npcIds.length, stakes: (thread) => `An involved person or faction is actively pursuing an incompatible result around ${thread.title}.` },
  { family: "instability", causalScore: (thread) => Number(thread.kind === "dynamic" || thread.kind === "mystery") * 2 + thread.locationIds.length + thread.urgency, stakes: (thread) => `The established condition behind ${thread.title} can worsen or spread if it remains unchanged.` },
  { family: "scarcity", causalScore: (thread) => 1 + Number(thread.urgency >= 2), stakes: (thread) => `Safe access, reliable information, or usable resources connected to ${thread.title} are limited.` },
  { family: "conflict", causalScore: (thread) => Number(thread.factionIds.length + thread.npcIds.length >= 2) * 3, stakes: (thread) => `The people affected by ${thread.title} want incompatible things, so helping one interest may strain another.` }
];

const COMPLICATION_MODULES: ComplicationModule[] = [
  { family: "new_information", causalScore: (thread) => 1 + Number(thread.kind === "main" || thread.kind === "mystery"), seed: (thread) => `New reliable information may change what a workable response to ${thread.title} requires.` },
  { family: "changed_access", causalScore: (thread) => thread.locationIds.length + 1, seed: (thread) => `Access to a relevant person, place, object, or route around ${thread.title} may change.` },
  { family: "third_party", causalScore: (thread) => thread.npcIds.length + thread.factionIds.length, seed: (thread) => `Another established actor may intervene in ${thread.title} for their own reason.` },
  { family: "bounded_cost", causalScore: () => 1, seed: (thread) => `Progress on ${thread.title} may create one proportional resource, relationship, injury, or obligation cost.` }
];

function rankModules<T>(seed: string, modules: T[], score: (module: T) => number): T[] {
  const ranked = modules.map((module) => ({ module, score: score(module) })).filter((entry) => entry.score > 0).sort((left, right) => right.score - left.score);
  const ordered: T[] = [];
  for (const value of [...new Set(ranked.map((entry) => entry.score))].sort((a, b) => b - a)) {
    const tied = ranked.filter((entry) => entry.score === value).map((entry) => entry.module);
    ordered.push(...seededSample(`${seed}|${value}`, tied, tied.length));
  }
  return ordered;
}

export function composeReplacementQuestDirection(
  db: DatabaseSync,
  campaignId: string,
  quest: ReturnType<typeof listQuestInstances>[number],
  consequenceEventSequences: number[],
  previouslyInvalidatedApproachKeys: string[] = []
): QuestDirection | null {
  const campaign = db.prepare("SELECT seed FROM campaigns WHERE id = ?").get(campaignId) as { seed: string } | undefined;
  if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
  const thread = listStoryThreads(db, campaignId).find((candidate) => candidate.threadId === quest.sourceThreadId);
  if (!thread) throw new Error(`Unknown quest source thread ${quest.sourceThreadId}`);
  const usedApproaches = new Set([...quest.possibleDirections.map((direction) => direction.approachKey), ...previouslyInvalidatedApproachKeys]);
  const ranked = OBJECTIVE_MODULES
    .map((module) => ({ module, score: module.causalScore(thread) }))
    .filter(({ module, score }) => score > 0 && !usedApproaches.has(module.approachKey))
    .sort((left, right) => right.score - left.score);
  if (ranked.length === 0) return null;
  const bestScore = ranked[0]!.score;
  const tied = ranked.filter((entry) => entry.score === bestScore);
  const selected = seededSample(`${campaign.seed}|direction-replacement|${quest.questId}|${consequenceEventSequences.join("-")}`, tied, 1)[0]!.module;
  const suffix = consequenceEventSequences.at(-1) ?? quest.updatedTurn;
  const baseId = quest.questId.replace(/^QUEST-/, "").slice(0, 60);
  return {
    directionId: `DIR-${baseId}-R${suffix}`,
    summary: selected.directionSummary(thread),
    likelyTradeoff: selected.likelyTradeoff(thread),
    approachKey: selected.approachKey,
    tradeoffKey: selected.tradeoffKey,
    costKey: selected.costKey
  };
}

function chooseCausalDirections(seed: string, thread: StoryThread, baseId: string, sequence: number, modules: QuestModule[]): Array<{ module: QuestModule; direction: QuestDirection }> {
  const ranked = modules
    .map((module) => ({ module, score: module.causalScore(thread) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
  if (ranked.length < 2) throw new Error("The established quest state does not support two credible directions");
  const directionCount = thread.urgency === 3 && ranked.length >= 3 ? 3 : 2;
  const ordered: typeof ranked = [];
  for (const score of [...new Set(ranked.map((entry) => entry.score))].sort((a, b) => b - a)) {
    ordered.push(...seededSample(`${seed}|direction-tie|${score}`, ranked.filter((entry) => entry.score === score), ranked.filter((entry) => entry.score === score).length));
  }
  return ordered.slice(0, directionCount).map(({ module }, index) => ({
    module,
    direction: {
      directionId: `DIR-${baseId}-${String(sequence).padStart(2, "0")}-${String.fromCharCode(65 + index)}`,
      summary: module.directionSummary(thread),
      likelyTradeoff: module.likelyTradeoff(thread),
      approachKey: module.approachKey,
      tradeoffKey: module.tradeoffKey,
      costKey: module.costKey
    }
  }));
}

function bounded(value: string, maximum: number): string {
  if (value.length <= maximum) return value;
  return `${value.slice(0, maximum - 1).trimEnd()}…`;
}

function sameIds(left: string[], right: string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function isMeaningfullyDistinct(
  existing: ReturnType<typeof listQuestInstances>[number],
  pattern: QuestModule,
  locationIds: string[],
  npcIds: string[]
): boolean {
  const differentApproachAndTradeoff = existing.routeProfile.approachKey !== pattern.approachKey && existing.routeProfile.tradeoffKey !== pattern.tradeoffKey;
  const differentAlliesOrLocation = !sameIds(existing.npcIds, npcIds) || !sameIds(existing.locationIds, locationIds);
  const differentMoralOrResourceCost = existing.routeProfile.costKey !== pattern.costKey;
  return differentApproachAndTradeoff || differentAlliesOrLocation || differentMoralOrResourceCost;
}

export function composeQuestFromThread(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  threadId: string,
  relationships: QuestRelationship[] = []
): CreateQuestInput {
  const campaign = db.prepare("SELECT seed, stage, turn, current_location_id AS currentLocationId FROM campaigns WHERE id = ?")
    .get(campaignId) as { seed: string; stage: StoryThread["minimumStage"]; turn: number; currentLocationId: string } | undefined;
  if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
  const thread = listStoryThreads(db, campaignId).find((candidate) => candidate.threadId === threadId);
  if (!thread) throw new Error(`Unknown quest source thread ${threadId}`);
  if (thread.status !== "active") throw new Error("Quests may be composed only from active story threads");
  const existing = listQuestInstances(db, campaignId).filter((quest) => quest.sourceThreadId === threadId);
  const unresolved = existing.filter((quest) => !["completed", "failed"].includes(quest.state));
  if (unresolved.length >= 2) {
    throw new Error("This story thread already has two unresolved quests");
  }
  if (unresolved.length === 1 && !relationships.some((relationship) => ["parallel", "optional_branch"].includes(relationship.type) && relationship.questId === unresolved[0]!.questId)) {
    throw new Error("A second unresolved route must explicitly link to the existing route as parallel or optional");
  }
  const locationIds = thread.locationIds.length > 0 ? thread.locationIds : [campaign.currentLocationId];
  const sequence = existing.length + 1;
  const hasPacedMajorObjective = thread.urgency >= 2 && existing.length === 0;
  const candidatePatterns = unresolved.length === 1
    ? OBJECTIVE_MODULES.filter((candidate) => isMeaningfullyDistinct(unresolved[0]!, candidate, locationIds, thread.npcIds))
    : OBJECTIVE_MODULES;
  if (candidatePatterns.length === 0) {
    throw new Error("No credible alternative route can be constructed from the established people, locations, costs, and approaches");
  }
  const baseId = thread.threadId.replace(/^THREAD-/, "");
  const causalDirections = chooseCausalDirections(`${campaign.seed}|quest|${threadId}|${sequence}`, thread, baseId, sequence, candidatePatterns);
  if (causalDirections.length < 2) {
    throw new Error("No credible alternative route can be constructed from the established people, locations, costs, and approaches");
  }
  const possibleDirections = causalDirections.slice(0, thread.urgency === 3 ? 3 : 2);
  const pattern = possibleDirections[0]!.module;
  const pressure = rankModules(`${campaign.seed}|pressure|${threadId}|${sequence}`, PRESSURE_MODULES, (module) => module.causalScore(thread))[0]!;
  const complications = rankModules(`${campaign.seed}|complication|${threadId}|${sequence}`, COMPLICATION_MODULES, (module) => module.causalScore(thread)).slice(0, 2);
  const questId = `QUEST-${baseId}-${String(sequence).padStart(2, "0")}`;
  const recoveryPaths = thread.recoveryPaths.length > 0
    ? thread.recoveryPaths.slice(0, 4)
    : [`A changed condition tied to ${thread.title} must create another route forward.`];
  const questType = QUEST_TYPE_BY_THREAD_KIND[thread.kind];
  if (questType === "faction" && thread.factionIds.length === 0) {
    throw new Error("A faction story thread requires a faction before quest composition");
  }
  const factionIds = thread.factionIds;

  return {
    questId,
    title: bounded(thread.title, 120),
    goal: bounded(`Meaningfully change the active pressure represented by ${thread.title}.`, 300),
    summary: bounded(`Pursue a concrete response to this active thread: ${thread.summary}`, 600),
    questType,
    state: thread.visibility === "player" ? "available" : "locked",
    visibility: thread.visibility,
    sourceThreadId: thread.threadId,
    minimumStage: campaign.stage,
    maximumStage: thread.maximumStage,
    issuerId: null,
    locationIds,
    factionIds,
    npcIds: thread.npcIds,
    objectives: [
      { objectiveId: `OBJ-${baseId}-${String(sequence).padStart(2, "0")}-A`, summary: bounded(pattern.immediateObjective(thread), 240), state: "pending", required: true, isMajorObjective: hasPacedMajorObjective, dependsOnObjectiveIds: [], branchGroupId: null }
    ],
    possibleDirections: possibleDirections.map((entry) => entry.direction),
    selectedDirectionId: null,
    stakes: bounded(pressure.stakes(thread), 300),
    outcomes: [
      {
        outcomeId: `OUT-${baseId}-${String(sequence).padStart(2, "0")}-A`,
        summary: "Resolve the central problem while accepting the chosen direction's likely tradeoff.",
        consequenceSeeds: complications.map((module) => module.seed(thread))
      },
      {
        outcomeId: `OUT-${baseId}-${String(sequence).padStart(2, "0")}-B`,
        summary: "Change the terms of the problem while preserving what the likely tradeoff threatens.",
        consequenceSeeds: complications.map((module) => module.seed(thread))
      }
    ],
    failureMode: "recoverable",
    warningSignals: [`The world clearly signals that ${thread.title} may worsen if the player deliberately chooses another priority.`],
    neglectTriggers: [
      `After receiving a recorded warning, the player deliberately chooses another priority instead of addressing ${thread.title}.`,
      `A recorded world event directly advances the threat represented by ${thread.title}.`
    ],
    recoveryPaths,
    prerequisiteQuestIds: relationships.filter((relationship) => relationship.type === "prerequisite").map((relationship) => relationship.questId),
    linkedQuestIds: relationships.map((relationship) => relationship.questId),
    relationships,
    routeProfile: {
      approachKey: pattern.approachKey,
      tradeoffKey: pattern.tradeoffKey,
      costKey: pattern.costKey
    },
    neglectPolicy: {
      allowedTriggers: ["ignored_warning_after_deliberate_choice", "recorded_world_event_advances_threat"],
      maximumEffect: "proportional_complication"
    },
    warningHistory: [],
    neglectHistory: [],
    recoveryOfQuestId: null,
    recoveryPathUsed: null,
    recoveryEvidenceEventSequences: [],
    failureReason: null,
    failureEvidenceEventSequences: [],
    truthEvidenceIds: [],
    isTurningPoint: false
  };
}

export function generateQuestFromThread(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  threadId: string,
  relationships: QuestRelationship[] = []
) {
  return createQuestInstance(db, content, campaignId, composeQuestFromThread(db, content, campaignId, threadId, relationships));
}

export function validateGeneratedQuest(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  threadId: string,
  relationships: QuestRelationship[] = []
): void {
  validateQuestCreation(db, content, campaignId, composeQuestFromThread(db, content, campaignId, threadId, relationships));
}

export function applyGeneratedQuest(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  threadId: string,
  turn: number,
  relationships: QuestRelationship[] = []
) {
  return applyQuestCreation(db, content, campaignId, turn, composeQuestFromThread(db, content, campaignId, threadId, relationships));
}

export function composeRecoveryQuest(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  failedQuestId: string,
  recoveryPath: string,
  consequenceEventSequences: number[]
): CreateQuestInput {
  const failedQuest = listQuestInstances(db, campaignId).find((quest) => quest.questId === failedQuestId);
  if (!failedQuest || failedQuest.state !== "failed" || failedQuest.failureMode !== "recoverable") {
    throw new Error("Recovery composition requires a recoverably failed quest");
  }
  if (!failedQuest.recoveryPaths.includes(recoveryPath)) {
    throw new Error("Recovery composition must use an exact recorded recovery path");
  }
  const existingRecoveries = listQuestInstances(db, campaignId)
    .filter((quest) => quest.recoveryOfQuestId === failedQuestId);
  if (existingRecoveries.length >= 2) throw new Error("This failed quest already has two altered recovery quests");
  if (existingRecoveries.some((quest) => quest.recoveryPathUsed === recoveryPath)) {
    throw new Error("This recovery path already has an altered quest");
  }
  const unresolved = listQuestInstances(db, campaignId).filter((quest) => quest.sourceThreadId === failedQuest.sourceThreadId && !["completed", "failed"].includes(quest.state));
  const baseRelationships: QuestRelationship[] = unresolved.length === 1
    ? [{ questId: unresolved[0]!.questId, type: "parallel" }]
    : [];
  const base = composeQuestFromThread(db, content, campaignId, failedQuest.sourceThreadId, baseRelationships);
  const alteredTitle = bounded(`Altered Route: ${failedQuest.title}`, 120);
  return {
    ...base,
    title: alteredTitle,
    summary: bounded(`The original approach failed. Continue through this changed route: ${recoveryPath}`, 600),
    objectives: [
      {
        ...base.objectives[0]!,
        summary: bounded(`Act on what changed after ${failedQuest.title} failed: ${recoveryPath}`, 240)
      }
    ],
    stakes: bounded(`This route preserves the underlying story problem, but the failed approach and its consequences remain part of the world.`, 300),
    prerequisiteQuestIds: [],
    linkedQuestIds: [...new Set([failedQuest.questId, ...(unresolved.length === 1 ? [unresolved[0]!.questId] : [])])],
    relationships: [
      { questId: failedQuest.questId, type: "consequence" },
      ...(unresolved.length === 1 ? [{ questId: unresolved[0]!.questId, type: "parallel" as const }] : [])
    ],
    recoveryOfQuestId: failedQuest.questId,
    recoveryPathUsed: recoveryPath,
    recoveryEvidenceEventSequences: consequenceEventSequences,
    failureReason: null,
    failureEvidenceEventSequences: []
  };
}

export function validateRecoveryQuest(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  failedQuestId: string,
  recoveryPath: string,
  consequenceEventSequences: number[]
): void {
  validateQuestCreation(db, content, campaignId, composeRecoveryQuest(db, content, campaignId, failedQuestId, recoveryPath, consequenceEventSequences));
}

export function applyRecoveryQuest(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  failedQuestId: string,
  recoveryPath: string,
  consequenceEventSequences: number[],
  turn: number
) {
  return applyQuestCreation(db, content, campaignId, turn, composeRecoveryQuest(db, content, campaignId, failedQuestId, recoveryPath, consequenceEventSequences));
}
