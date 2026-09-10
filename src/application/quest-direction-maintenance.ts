import type { DatabaseSync } from "node:sqlite";
import type { QuestInstance, ReviseQuestDirectionsRequest } from "../domain/types.ts";
import { appendEvent, listQuestInstances, persistQuestInstance } from "../persistence/database.ts";
import { composeReplacementQuestDirection } from "./quest-generator.ts";
import { validateConsequenceEvidence } from "./quest-system.ts";

function getQuest(db: DatabaseSync, campaignId: string, questId: string): QuestInstance {
  const quest = listQuestInstances(db, campaignId).find((candidate) => candidate.questId === questId);
  if (!quest) throw new Error(`Unknown quest ${questId}`);
  return quest;
}

export function validateQuestDirectionRevision(
  db: DatabaseSync,
  campaignId: string,
  request: ReviseQuestDirectionsRequest
): QuestInstance {
  const reason = request.reason.trim();
  if (reason.length < 3 || reason.length > 400) throw new Error("Direction invalidation reason must be 3-400 characters");
  const quest = getQuest(db, campaignId, request.questId);
  if (quest.visibility !== "player" || quest.state !== "available" || quest.selectedDirectionId !== null) {
    throw new Error("Only an available, uncommitted player quest may revise its offered directions");
  }
  if (!quest.possibleDirections.some((direction) => direction.directionId === request.invalidatedDirectionId)) {
    throw new Error(`Unknown quest direction ${request.invalidatedDirectionId}`);
  }
  if (quest.possibleDirections.length <= 1) {
    throw new Error("The last credible direction requires consequence-based quest failure, not direction removal");
  }
  validateConsequenceEvidence(db, campaignId, request.consequenceEventSequences, quest.createdTurn, "Direction invalidation", quest);
  const previous = db.prepare(`SELECT payload_json AS payloadJson FROM event_log
    WHERE campaign_id = ? AND event_type = 'quest_direction_invalidated' ORDER BY sequence`).all(campaignId) as Array<{ payloadJson: string }>;
  const usedEvidence = new Set(previous.flatMap((event) => {
    const payload = JSON.parse(event.payloadJson) as { questId?: string; consequenceEventSequences?: number[] };
    return payload.questId === request.questId ? payload.consequenceEventSequences ?? [] : [];
  }));
  if (request.consequenceEventSequences.some((sequence) => usedEvidence.has(sequence))) {
    throw new Error("A recorded consequence may justify only one direction revision on this quest");
  }
  return quest;
}

export function applyQuestDirectionRevision(
  db: DatabaseSync,
  campaignId: string,
  turn: number,
  request: ReviseQuestDirectionsRequest
): QuestInstance {
  const quest = validateQuestDirectionRevision(db, campaignId, request);
  const invalidatedDirection = quest.possibleDirections.find((direction) => direction.directionId === request.invalidatedDirectionId)!;
  const previousInvalidatedApproaches = (db.prepare(`SELECT payload_json AS payloadJson FROM event_log
    WHERE campaign_id = ? AND event_type = 'quest_direction_invalidated' ORDER BY sequence`).all(campaignId) as Array<{ payloadJson: string }>).flatMap((event) => {
      const payload = JSON.parse(event.payloadJson) as { questId?: string; invalidatedApproachKey?: string };
      return payload.questId === request.questId && payload.invalidatedApproachKey ? [payload.invalidatedApproachKey] : [];
    });
  const replacement = composeReplacementQuestDirection(db, campaignId, quest, request.consequenceEventSequences, previousInvalidatedApproaches);
  const remaining = quest.possibleDirections.filter((direction) => direction.directionId !== request.invalidatedDirectionId);
  const updated: QuestInstance = {
    ...quest,
    possibleDirections: replacement ? [...remaining, replacement] : remaining,
    updatedTurn: turn
  };
  persistQuestInstance(db, updated);
  appendEvent(db, campaignId, turn, "quest_direction_invalidated", {
    questId: quest.questId,
    invalidatedDirectionId: request.invalidatedDirectionId,
    invalidatedApproachKey: invalidatedDirection.approachKey,
    replacementDirectionId: replacement?.directionId ?? null,
    consequenceEventSequences: request.consequenceEventSequences,
    reason: request.reason.trim()
  });
  return getQuest(db, campaignId, quest.questId);
}
