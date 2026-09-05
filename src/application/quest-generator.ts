import type { DatabaseSync } from "node:sqlite";
import type { CreateQuestInput } from "./quest-system.ts";
import type { QuestDirection, QuestRelationship, StoryThread, VelmoraContent } from "../domain/types.ts";
import { listQuestInstances, listStoryThreads } from "../persistence/database.ts";
import { seededSample } from "./seeded-random.ts";
import { applyQuestCreation, createQuestInstance, QUEST_TYPE_BY_THREAD_KIND, validateQuestCreation } from "./quest-system.ts";

type QuestPattern = {
  key: string;
  directionSummary: string;
  likelyTradeoff: string;
  approachKey: string;
  tradeoffKey: string;
  costKey: string;
  firstObjective: (title: string) => string;
  secondObjective: (title: string) => string;
  firstOutcome: string;
  secondOutcome: string;
  causalScore: (thread: StoryThread) => number;
};

const QUEST_PATTERNS: QuestPattern[] = [
  {
    key: "investigate-and-act",
    directionSummary: "Investigate the cause before committing to an intervention.",
    likelyTradeoff: "Greater certainty may cost time and allow the immediate pressure to move.",
    approachKey: "evidence-first",
    tradeoffKey: "certainty-before-speed",
    costKey: "time-and-exposure",
    firstObjective: (title) => `Establish what is actually happening behind ${title}.`,
    secondObjective: (title) => `Use the evidence to choose and carry out a response to ${title}.`,
    firstOutcome: "Intervene directly using the clearest available evidence.",
    secondOutcome: "Use the evidence as leverage for an indirect solution.",
    causalScore: (thread) => 1 + Number(thread.kind === "main" || thread.kind === "mystery") + Number(thread.urgency >= 2)
  },
  {
    key: "protect-and-pursue",
    directionSummary: "Protect the people or place currently exposed by the threat.",
    likelyTradeoff: "Immediate safety may give the source of the danger room to escape or advance.",
    approachKey: "protection-first",
    tradeoffKey: "safety-before-pursuit",
    costKey: "lost-ground-or-limited-cover",
    firstObjective: (title) => `Identify who or what is most exposed by ${title}.`,
    secondObjective: (title) => `Protect the immediate target while preserving a route toward ${title}.`,
    firstOutcome: "Prioritize immediate protection and accept what escapes attention.",
    secondOutcome: "Prioritize pursuing the source while arranging limited protection.",
    causalScore: (thread) => Number(thread.npcIds.length > 0 || thread.locationIds.length > 0) + Number(thread.urgency >= 2) + Number(thread.kind === "personal")
  },
  {
    key: "negotiate-and-commit",
    directionSummary: "Seek cooperation, terms, or leverage from the people involved.",
    likelyTradeoff: "Support may require an obligation, concession, or loss of independence.",
    approachKey: "negotiation-first",
    tradeoffKey: "obligation-for-cooperation",
    costKey: "independence-or-political-capital",
    firstObjective: (title) => `Learn what the involved sides want from ${title}.`,
    secondObjective: (title) => `Commit to an agreement, refusal, or third path that changes ${title}.`,
    firstOutcome: "Reach terms with one involved side and inherit its obligations.",
    secondOutcome: "Reject the offered terms and create independent leverage.",
    causalScore: (thread) => Number(thread.npcIds.length > 0) + Number(thread.factionIds.length > 0) * 2 + Number(thread.kind === "faction")
  },
  {
    key: "recover-and-contain",
    directionSummary: "Secure or contain the unstable source before it spreads further.",
    likelyTradeoff: "Control may restrict access, damage trust, or place the danger in contested custody.",
    approachKey: "control-the-instability",
    tradeoffKey: "custody-versus-access",
    costKey: "control-or-public-trust",
    firstObjective: (title) => `Locate the unstable person, object, or information driving ${title}.`,
    secondObjective: (title) => `Recover, contain, or deliberately release it before ${title} worsens.`,
    firstOutcome: "Secure the unstable element under controlled custody.",
    secondOutcome: "Leave it outside official control for a specific immediate reason.",
    causalScore: (thread) => Number(thread.locationIds.length > 0) + Number(thread.kind === "dynamic" || thread.kind === "mystery") + Number(thread.urgency >= 2)
  }
];

function chooseCausalDirections(seed: string, thread: StoryThread, baseId: string, sequence: number, modules: QuestPattern[]): Array<{ module: QuestPattern; direction: QuestDirection }> {
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
      summary: module.directionSummary,
      likelyTradeoff: module.likelyTradeoff,
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
  pattern: QuestPattern,
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
    ? QUEST_PATTERNS.filter((candidate) => isMeaningfullyDistinct(unresolved[0]!, candidate, locationIds, thread.npcIds))
    : QUEST_PATTERNS;
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
      { objectiveId: `OBJ-${baseId}-${String(sequence).padStart(2, "0")}-A`, summary: bounded(pattern.firstObjective(thread.title), 240), state: "pending", required: true, isMajorObjective: false, dependsOnObjectiveIds: [], branchGroupId: null },
      { objectiveId: `OBJ-${baseId}-${String(sequence).padStart(2, "0")}-B`, summary: bounded(pattern.secondObjective(thread.title), 240), state: "pending", required: true, isMajorObjective: hasPacedMajorObjective, dependsOnObjectiveIds: [`OBJ-${baseId}-${String(sequence).padStart(2, "0")}-A`], branchGroupId: null }
    ],
    possibleDirections: possibleDirections.map((entry) => entry.direction),
    selectedDirectionId: null,
    stakes: bounded(`If no one meaningfully responds, the pressure represented by ${thread.title} may change the people, factions, or locations already involved.`, 300),
    outcomes: [
      {
        outcomeId: `OUT-${baseId}-${String(sequence).padStart(2, "0")}-A`,
        summary: pattern.firstOutcome,
        consequenceSeeds: [`Direct action changes the immediate state of ${thread.title}.`]
      },
      {
        outcomeId: `OUT-${baseId}-${String(sequence).padStart(2, "0")}-B`,
        summary: pattern.secondOutcome,
        consequenceSeeds: [`Indirect action creates new leverage and an unresolved cost around ${thread.title}.`]
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
        summary: bounded(`Establish what changed after the failure of ${failedQuest.title}.`, 240)
      },
      {
        ...base.objectives[1]!,
        summary: bounded(`Use the altered route without erasing its cost: ${recoveryPath}`, 240)
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
