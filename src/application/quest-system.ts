import type { DatabaseSync } from "node:sqlite";
import type { CampaignStage, QuestInstance, QuestObjectiveState, StoryThread, VelmoraContent } from "../domain/types.ts";
import { appendEvent, listQuestInstances, listStoryThreads, persistQuestInstance } from "../persistence/database.ts";

const STAGE_ORDER: Record<CampaignStage, number> = { opening: 0, stabilization: 1, escalation: 2, resolution: 3 };

export type CreateQuestInput = Omit<QuestInstance, "campaignId" | "createdTurn" | "updatedTurn" | "selectedOutcomeId">;

function requireText(value: string, label: string, minimum: number, maximum: number): string {
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new Error(`${label} must be ${minimum}-${maximum} characters`);
  }
  return normalized;
}

function stableId(value: string, prefix: string): boolean {
  return new RegExp(`^${prefix}-[A-Z0-9][A-Z0-9-]{2,95}$`).test(value);
}

function getCampaignState(db: DatabaseSync, campaignId: string): { stage: CampaignStage; turn: number } {
  const campaign = db.prepare("SELECT stage, turn FROM campaigns WHERE id = ?").get(campaignId) as { stage: CampaignStage; turn: number } | undefined;
  if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
  return campaign;
}

function getQuest(db: DatabaseSync, campaignId: string, questId: string): QuestInstance {
  const quest = listQuestInstances(db, campaignId).find((candidate) => candidate.questId === questId);
  if (!quest) throw new Error(`Unknown quest ${questId}`);
  return quest;
}

function commitQuestUpdate(db: DatabaseSync, quest: QuestInstance, eventType: string, payload: unknown): QuestInstance {
  db.exec("BEGIN IMMEDIATE");
  try {
    persistQuestInstance(db, quest);
    appendEvent(db, quest.campaignId, quest.updatedTurn, eventType, payload);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getQuest(db, quest.campaignId, quest.questId);
}

function characterExists(db: DatabaseSync, content: VelmoraContent, campaignId: string, characterId: string): boolean {
  if (content.characters.some((character) => character.id === characterId)) return true;
  return Boolean(db.prepare("SELECT 1 FROM npc_records WHERE campaign_id = ? AND npc_id = ?").get(campaignId, characterId));
}

function validateQuestLinks(db: DatabaseSync, content: VelmoraContent, campaignId: string, input: CreateQuestInput): void {
  if (input.locationIds.length > 8 || input.factionIds.length > 6 || input.npcIds.length > 8 || input.prerequisiteQuestIds.length > 6 || input.linkedQuestIds.length > 6 || input.truthEvidenceIds.length > 8) {
    throw new Error("Quest link limit exceeded");
  }
  for (const locationId of input.locationIds) {
    if (!content.locations.some((location) => location.id === locationId)) throw new Error(`Unknown quest location ${locationId}`);
  }
  for (const factionId of input.factionIds) {
    if (!content.factions.some((faction) => faction.id === factionId)) throw new Error(`Unknown quest faction ${factionId}`);
  }
  for (const npcId of input.npcIds) {
    if (!characterExists(db, content, campaignId, npcId)) throw new Error(`Unknown quest NPC ${npcId}`);
  }
  if (input.issuerId && !characterExists(db, content, campaignId, input.issuerId)) throw new Error(`Unknown quest issuer ${input.issuerId}`);
  const existingQuestIds = new Set(listQuestInstances(db, campaignId).map((quest) => quest.questId));
  for (const prerequisiteQuestId of input.prerequisiteQuestIds) {
    if (!existingQuestIds.has(prerequisiteQuestId)) throw new Error(`Unknown prerequisite quest ${prerequisiteQuestId}`);
  }
  for (const linkedQuestId of input.linkedQuestIds) {
    if (!existingQuestIds.has(linkedQuestId)) throw new Error(`Unknown linked quest ${linkedQuestId}`);
  }
  for (const factId of input.truthEvidenceIds) {
    if (!db.prepare("SELECT 1 FROM world_facts WHERE campaign_id = ? AND fact_id = ?").get(campaignId, factId)) {
      throw new Error(`Unknown quest evidence ${factId}`);
    }
  }
}

export function validateQuestCreation(db: DatabaseSync, content: VelmoraContent, campaignId: string, input: CreateQuestInput): StoryThread {
  const campaign = getCampaignState(db, campaignId);
  if (!stableId(input.questId, "QUEST")) throw new Error("Quest ID must be a stable QUEST identifier");
  if (listQuestInstances(db, campaignId).some((quest) => quest.questId === input.questId)) throw new Error(`Quest ${input.questId} already exists`);
  requireText(input.title, "Quest title", 3, 120);
  requireText(input.summary, "Quest summary", 3, 600);
  requireText(input.stakes, "Quest stakes", 3, 300);
  if (!["main", "faction", "side", "personal", "dynamic", "fragment"].includes(input.questType)) throw new Error("Unknown quest type");
  if (input.visibility !== "player" && input.visibility !== "director") throw new Error("Unknown quest visibility");
  if (!Object.hasOwn(STAGE_ORDER, input.minimumStage) || !Object.hasOwn(STAGE_ORDER, input.maximumStage)) throw new Error("Unknown quest campaign stage");
  if (!["recoverable", "warned_deadline", "irreversible_choice", "major_world_event"].includes(input.failureMode)) throw new Error("Unknown quest failure mode");
  if (input.state !== "locked" && input.state !== "available") throw new Error("A new quest must begin locked or available");
  const sourceThread = listStoryThreads(db, campaignId).find((thread) => thread.threadId === input.sourceThreadId);
  if (!sourceThread) throw new Error(`Unknown quest source thread ${input.sourceThreadId}`);
  if (input.visibility !== sourceThread.visibility) throw new Error("A quest must inherit its source thread visibility");
  if (input.questType === "main" && sourceThread.kind !== "main") throw new Error("A main quest must originate from an existing main story thread");
  if (input.questType === "faction" && input.factionIds.length === 0) throw new Error("A faction quest requires at least one faction");
  if (input.isTurningPoint && sourceThread.urgency !== 3) throw new Error("A three-outcome turning point requires an urgency-three source thread");
  if (STAGE_ORDER[input.minimumStage] > STAGE_ORDER[input.maximumStage]) throw new Error("Quest stage range is inverted");
  if (STAGE_ORDER[input.minimumStage] < STAGE_ORDER[sourceThread.minimumStage] || STAGE_ORDER[input.maximumStage] > STAGE_ORDER[sourceThread.maximumStage]) {
    throw new Error("A quest cannot exceed its source thread stage range");
  }
  if (STAGE_ORDER[campaign.stage] < STAGE_ORDER[input.minimumStage] || STAGE_ORDER[campaign.stage] > STAGE_ORDER[input.maximumStage]) {
    throw new Error("A generated quest must be valid for the current campaign stage");
  }
  if (input.objectives.length < 1 || input.objectives.length > 5) throw new Error("A quest requires 1-5 objectives");
  if (new Set(input.objectives.map((objective) => objective.objectiveId)).size !== input.objectives.length) throw new Error("Quest objective IDs must be unique");
  for (const objective of input.objectives) {
    if (!stableId(objective.objectiveId, "OBJ")) throw new Error("Quest objective IDs must be stable OBJ identifiers");
    requireText(objective.summary, "Quest objective", 3, 240);
    if (objective.state !== "pending") throw new Error("New quest objectives must begin pending");
  }
  const requiredOutcomeCount = input.isTurningPoint ? 3 : 2;
  if (input.outcomes.length !== requiredOutcomeCount) throw new Error(`This quest requires exactly ${requiredOutcomeCount} major outcomes`);
  if (new Set(input.outcomes.map((outcome) => outcome.outcomeId)).size !== input.outcomes.length) throw new Error("Quest outcome IDs must be unique");
  for (const outcome of input.outcomes) {
    if (!stableId(outcome.outcomeId, "OUT")) throw new Error("Quest outcome IDs must be stable OUT identifiers");
    requireText(outcome.summary, "Quest outcome", 3, 300);
    if (outcome.consequenceSeeds.length < 1 || outcome.consequenceSeeds.length > 4) throw new Error("Each quest outcome requires 1-4 consequence seeds");
    for (const consequence of outcome.consequenceSeeds) requireText(consequence, "Quest consequence seed", 3, 240);
  }
  if (input.warningSignals.length > 3 || input.neglectTriggers.length > 3 || input.recoveryPaths.length > 4) throw new Error("Quest warning, neglect-trigger, or recovery-path limit exceeded");
  for (const warning of input.warningSignals) requireText(warning, "Quest warning signal", 3, 240);
  for (const trigger of input.neglectTriggers) requireText(trigger, "Quest neglect trigger", 3, 240);
  for (const path of input.recoveryPaths) requireText(path, "Quest recovery path", 3, 240);
  if (input.failureMode === "recoverable" && input.recoveryPaths.length === 0) throw new Error("A recoverable quest requires at least one recovery path");
  if (input.failureMode === "warned_deadline" && input.warningSignals.length === 0) throw new Error("A warned-deadline quest requires at least one warning signal");
  validateQuestLinks(db, content, campaignId, input);
  if (input.state === "available") {
    const prerequisites = new Map(listQuestInstances(db, campaignId).map((quest) => [quest.questId, quest]));
    if (input.prerequisiteQuestIds.some((questId) => prerequisites.get(questId)?.state !== "completed")) {
      throw new Error("An available quest requires every prerequisite quest to be completed");
    }
  }
  return sourceThread;
}

export function createQuestInstance(db: DatabaseSync, content: VelmoraContent, campaignId: string, input: CreateQuestInput): QuestInstance {
  validateQuestCreation(db, content, campaignId, input);
  const { turn } = getCampaignState(db, campaignId);
  const quest: QuestInstance = {
    ...input,
    title: input.title.trim(),
    summary: input.summary.trim(),
    stakes: input.stakes.trim(),
    locationIds: [...new Set(input.locationIds)],
    factionIds: [...new Set(input.factionIds)],
    npcIds: [...new Set(input.npcIds)],
    warningSignals: [...new Set(input.warningSignals.map((entry) => entry.trim()))],
    neglectTriggers: [...new Set(input.neglectTriggers.map((entry) => entry.trim()))],
    recoveryPaths: [...new Set(input.recoveryPaths.map((entry) => entry.trim()))],
    prerequisiteQuestIds: [...new Set(input.prerequisiteQuestIds)],
    linkedQuestIds: [...new Set(input.linkedQuestIds)],
    truthEvidenceIds: [...new Set(input.truthEvidenceIds)],
    selectedOutcomeId: null,
    campaignId,
    createdTurn: turn,
    updatedTurn: turn
  };
  db.exec("BEGIN IMMEDIATE");
  try {
    persistQuestInstance(db, quest);
    appendEvent(db, campaignId, turn, "quest_created", {
      questId: quest.questId,
      questType: quest.questType,
      sourceThreadId: quest.sourceThreadId,
      visibility: quest.visibility
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getQuest(db, campaignId, quest.questId);
}

export function makeQuestAvailable(db: DatabaseSync, campaignId: string, questId: string): QuestInstance {
  const quest = getQuest(db, campaignId, questId);
  if (quest.state !== "locked") throw new Error("Only a locked quest can become available");
  const campaign = getCampaignState(db, campaignId);
  if (STAGE_ORDER[campaign.stage] < STAGE_ORDER[quest.minimumStage] || STAGE_ORDER[campaign.stage] > STAGE_ORDER[quest.maximumStage]) {
    throw new Error("Quest is outside its permitted campaign stage");
  }
  const quests = new Map(listQuestInstances(db, campaignId).map((candidate) => [candidate.questId, candidate]));
  if (quest.prerequisiteQuestIds.some((requiredId) => quests.get(requiredId)?.state !== "completed")) {
    throw new Error("Quest prerequisites are not complete");
  }
  const updated: QuestInstance = { ...quest, state: "available", updatedTurn: campaign.turn };
  return commitQuestUpdate(db, updated, "quest_available", { questId, prerequisiteQuestIds: quest.prerequisiteQuestIds });
}

export function activateQuest(db: DatabaseSync, campaignId: string, questId: string): QuestInstance {
  const quest = getQuest(db, campaignId, questId);
  if (quest.state !== "available") throw new Error("Only an available quest can be activated");
  const turn = getCampaignState(db, campaignId).turn;
  const objectives = quest.objectives.map((objective, index) => index === 0 ? { ...objective, state: "active" as const } : objective);
  const updated = { ...quest, state: "active" as const, objectives, updatedTurn: turn };
  return commitQuestUpdate(db, updated, "quest_activated", { questId });
}

export function updateQuestObjective(
  db: DatabaseSync,
  campaignId: string,
  questId: string,
  objectiveId: string,
  state: Extract<QuestObjectiveState, "completed" | "failed">
): QuestInstance {
  const quest = getQuest(db, campaignId, questId);
  if (quest.state !== "active" && quest.state !== "changed") throw new Error("Only an active or changed quest can update objectives");
  const objective = quest.objectives.find((candidate) => candidate.objectiveId === objectiveId);
  if (!objective) throw new Error(`Unknown quest objective ${objectiveId}`);
  if (objective.state !== "active") throw new Error("Only the active quest objective can be resolved");
  const turn = getCampaignState(db, campaignId).turn;
  const objectives = quest.objectives.map((candidate) => candidate.objectiveId === objectiveId ? { ...candidate, state } : candidate);
  if (state === "completed") {
    const nextPendingIndex = objectives.findIndex((candidate) => candidate.state === "pending");
    if (nextPendingIndex >= 0) objectives[nextPendingIndex] = { ...objectives[nextPendingIndex]!, state: "active" };
  }
  const updated: QuestInstance = { ...quest, objectives, state: state === "failed" ? "changed" : quest.state, updatedTurn: turn };
  return commitQuestUpdate(db, updated, "quest_objective_updated", { questId, objectiveId, state });
}

export function completeQuest(db: DatabaseSync, campaignId: string, questId: string, outcomeId: string): QuestInstance {
  const quest = getQuest(db, campaignId, questId);
  if (quest.state !== "active" && quest.state !== "changed") throw new Error("Only an active or changed quest can be completed");
  if (quest.objectives.some((objective) => objective.state !== "completed")) throw new Error("Every quest objective must be completed first");
  if (!quest.outcomes.some((outcome) => outcome.outcomeId === outcomeId)) throw new Error(`Unknown quest outcome ${outcomeId}`);
  const turn = getCampaignState(db, campaignId).turn;
  const updated: QuestInstance = { ...quest, state: "completed", selectedOutcomeId: outcomeId, updatedTurn: turn };
  return commitQuestUpdate(db, updated, "quest_completed", { questId, outcomeId });
}

export function failQuestRecoverably(db: DatabaseSync, campaignId: string, questId: string): QuestInstance {
  const quest = getQuest(db, campaignId, questId);
  if (quest.state !== "active" && quest.state !== "changed") throw new Error("Only an active or changed quest can fail");
  if (quest.failureMode !== "recoverable" || quest.recoveryPaths.length === 0) {
    throw new Error("Permanent quest failure requires future verified deadline, choice, or world-event authority");
  }
  const turn = getCampaignState(db, campaignId).turn;
  const updated: QuestInstance = { ...quest, state: "failed", updatedTurn: turn };
  return commitQuestUpdate(db, updated, "quest_failed_recoverably", { questId, recoveryPaths: quest.recoveryPaths });
}
