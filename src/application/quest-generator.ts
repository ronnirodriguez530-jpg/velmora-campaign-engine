import type { DatabaseSync } from "node:sqlite";
import type { CreateQuestInput } from "./quest-system.ts";
import type { QuestRelationship, QuestType, StoryThread, VelmoraContent } from "../domain/types.ts";
import { listQuestInstances, listStoryThreads } from "../persistence/database.ts";
import { seededChoice } from "./seeded-random.ts";
import { applyQuestCreation, createQuestInstance, validateQuestCreation } from "./quest-system.ts";

type QuestPattern = {
  key: string;
  approachKey: string;
  tradeoffKey: string;
  costKey: string;
  firstObjective: (title: string) => string;
  secondObjective: (title: string) => string;
  firstOutcome: string;
  secondOutcome: string;
};

const QUEST_PATTERNS: QuestPattern[] = [
  {
    key: "investigate-and-act",
    approachKey: "evidence-first",
    tradeoffKey: "certainty-before-speed",
    costKey: "time-and-exposure",
    firstObjective: (title) => `Establish what is actually happening behind ${title}.`,
    secondObjective: (title) => `Use the evidence to choose and carry out a response to ${title}.`,
    firstOutcome: "Intervene directly using the clearest available evidence.",
    secondOutcome: "Use the evidence as leverage for an indirect solution."
  },
  {
    key: "protect-and-pursue",
    approachKey: "protection-first",
    tradeoffKey: "safety-before-pursuit",
    costKey: "lost-ground-or-limited-cover",
    firstObjective: (title) => `Identify who or what is most exposed by ${title}.`,
    secondObjective: (title) => `Protect the immediate target while preserving a route toward ${title}.`,
    firstOutcome: "Prioritize immediate protection and accept what escapes attention.",
    secondOutcome: "Prioritize pursuing the source while arranging limited protection."
  },
  {
    key: "negotiate-and-commit",
    approachKey: "negotiation-first",
    tradeoffKey: "obligation-for-cooperation",
    costKey: "independence-or-political-capital",
    firstObjective: (title) => `Learn what the involved sides want from ${title}.`,
    secondObjective: (title) => `Commit to an agreement, refusal, or third path that changes ${title}.`,
    firstOutcome: "Reach terms with one involved side and inherit its obligations.",
    secondOutcome: "Reject the offered terms and create independent leverage."
  },
  {
    key: "recover-and-contain",
    approachKey: "control-the-instability",
    tradeoffKey: "custody-versus-access",
    costKey: "control-or-public-trust",
    firstObjective: (title) => `Locate the unstable person, object, or information driving ${title}.`,
    secondObjective: (title) => `Recover, contain, or deliberately release it before ${title} worsens.`,
    firstOutcome: "Secure the unstable element under controlled custody.",
    secondOutcome: "Leave it outside official control for a specific immediate reason."
  }
];

function questTypeForThread(thread: StoryThread): QuestType {
  if (thread.kind === "main") return "main";
  if (thread.kind === "faction") return "faction";
  if (thread.kind === "personal") return "personal";
  if (thread.kind === "dynamic") return "dynamic";
  if (thread.kind === "mystery") return "fragment";
  return "side";
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
  const candidatePatterns = unresolved.length === 1
    ? QUEST_PATTERNS.filter((candidate) => isMeaningfullyDistinct(unresolved[0]!, candidate, locationIds, thread.npcIds))
    : QUEST_PATTERNS;
  if (candidatePatterns.length === 0) {
    throw new Error("No credible alternative route can be constructed from the established people, locations, costs, and approaches");
  }
  const pattern = seededChoice(`${campaign.seed}|quest|${threadId}|${sequence}`, candidatePatterns);
  const baseId = thread.threadId.replace(/^THREAD-/, "");
  const questId = `QUEST-${baseId}-${String(sequence).padStart(2, "0")}`;
  const recoveryPaths = thread.recoveryPaths.length > 0
    ? thread.recoveryPaths.slice(0, 4)
    : [`A changed condition tied to ${thread.title} must create another route forward.`];
  const questType = questTypeForThread(thread);
  if (questType === "faction" && thread.factionIds.length === 0) {
    throw new Error("A faction story thread requires a faction before quest composition");
  }
  const factionIds = thread.factionIds;

  return {
    questId,
    title: bounded(thread.title, 120),
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
      { objectiveId: `OBJ-${baseId}-${String(sequence).padStart(2, "0")}-A`, summary: bounded(pattern.firstObjective(thread.title), 240), state: "pending", required: true, dependsOnObjectiveIds: [], branchGroupId: null },
      { objectiveId: `OBJ-${baseId}-${String(sequence).padStart(2, "0")}-B`, summary: bounded(pattern.secondObjective(thread.title), 240), state: "pending", required: true, dependsOnObjectiveIds: [`OBJ-${baseId}-${String(sequence).padStart(2, "0")}-A`], branchGroupId: null }
    ],
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
