import type { DatabaseSync } from "node:sqlite";
import type { CreateQuestInput } from "./quest-system.ts";
import type { QuestType, StoryThread, VelmoraContent } from "../domain/types.ts";
import { listQuestInstances, listStoryThreads } from "../persistence/database.ts";
import { seededChoice } from "./seeded-random.ts";
import { createQuestInstance } from "./quest-system.ts";

type QuestPattern = {
  key: string;
  firstObjective: (title: string) => string;
  secondObjective: (title: string) => string;
  firstOutcome: string;
  secondOutcome: string;
};

const QUEST_PATTERNS: QuestPattern[] = [
  {
    key: "investigate-and-act",
    firstObjective: (title) => `Establish what is actually happening behind ${title}.`,
    secondObjective: (title) => `Use the evidence to choose and carry out a response to ${title}.`,
    firstOutcome: "Intervene directly using the clearest available evidence.",
    secondOutcome: "Use the evidence as leverage for an indirect solution."
  },
  {
    key: "protect-and-pursue",
    firstObjective: (title) => `Identify who or what is most exposed by ${title}.`,
    secondObjective: (title) => `Protect the immediate target while preserving a route toward ${title}.`,
    firstOutcome: "Prioritize immediate protection and accept what escapes attention.",
    secondOutcome: "Prioritize pursuing the source while arranging limited protection."
  },
  {
    key: "negotiate-and-commit",
    firstObjective: (title) => `Learn what the involved sides want from ${title}.`,
    secondObjective: (title) => `Commit to an agreement, refusal, or third path that changes ${title}.`,
    firstOutcome: "Reach terms with one involved side and inherit its obligations.",
    secondOutcome: "Reject the offered terms and create independent leverage."
  },
  {
    key: "recover-and-contain",
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

export function composeQuestFromThread(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  threadId: string
): CreateQuestInput {
  const campaign = db.prepare("SELECT seed, stage, turn, current_location_id AS currentLocationId FROM campaigns WHERE id = ?")
    .get(campaignId) as { seed: string; stage: StoryThread["minimumStage"]; turn: number; currentLocationId: string } | undefined;
  if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
  const thread = listStoryThreads(db, campaignId).find((candidate) => candidate.threadId === threadId);
  if (!thread) throw new Error(`Unknown quest source thread ${threadId}`);
  if (thread.status !== "active") throw new Error("Quests may be composed only from active story threads");
  const existing = listQuestInstances(db, campaignId).filter((quest) => quest.sourceThreadId === threadId);
  if (existing.some((quest) => !["completed", "failed"].includes(quest.state))) {
    throw new Error("This story thread already has an unresolved quest");
  }
  const sequence = existing.length + 1;
  const pattern = seededChoice(`${campaign.seed}|quest|${threadId}|${sequence}`, QUEST_PATTERNS);
  const baseId = thread.threadId.replace(/^THREAD-/, "");
  const questId = `QUEST-${baseId}-${String(sequence).padStart(2, "0")}`;
  const previous = existing.at(-1);
  const locationIds = thread.locationIds.length > 0 ? thread.locationIds : [campaign.currentLocationId];
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
      { objectiveId: `OBJ-${baseId}-${String(sequence).padStart(2, "0")}-A`, summary: bounded(pattern.firstObjective(thread.title), 240), state: "pending" },
      { objectiveId: `OBJ-${baseId}-${String(sequence).padStart(2, "0")}-B`, summary: bounded(pattern.secondObjective(thread.title), 240), state: "pending" }
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
    warningSignals: [],
    neglectTriggers: [`A committed world event directly advances or worsens ${thread.title}.`],
    recoveryPaths,
    prerequisiteQuestIds: previous?.state === "completed" ? [previous.questId] : [],
    linkedQuestIds: previous ? [previous.questId] : [],
    truthEvidenceIds: [],
    isTurningPoint: false
  };
}

export function generateQuestFromThread(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  threadId: string
) {
  return createQuestInstance(db, content, campaignId, composeQuestFromThread(db, content, campaignId, threadId));
}
