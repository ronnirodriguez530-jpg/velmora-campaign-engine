import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StoryThread, VelmoraContent } from "../domain/types.ts";
import { appendEvent, createCampaign, listEvents, listQuestInstances, listStoryThreads, openDatabase, persistStoryThread } from "../persistence/database.ts";
import { buildPerspectiveContext } from "./context-builder.ts";
import { applyRecoveryQuest, generateQuestFromThread } from "./quest-generator.ts";
import { activateQuest, addAdaptiveQuestObjective, completeQuest, failQuestRecoverably, updateQuestObjective } from "./quest-system.ts";
import { buildJournalEvents } from "./journal-builder.ts";

export type QuestSimulationReport = {
  scope: { paths: number; threadsPerPath: number; canonChanged: false };
  validationFailures: string[];
  paths: Array<{
    id: number;
    totalQuests: number;
    completedQuests: number;
    failedQuests: number;
    recoveryQuests: number;
    adaptiveObjectives: number;
    unexpectedCompletions: number;
    maximumUnresolvedPerThread: number;
    hardCapRejected: boolean;
    activeJournalQuests: number;
    recentJournalEvents: number;
  }>;
};

function simulationThread(campaignId: string, basisId: string, suffix: string, kind: StoryThread["kind"], factionIds: string[], recoveryPaths: string[]): StoryThread {
  return {
    campaignId,
    threadId: `THREAD-SIM-${suffix}`,
    kind,
    title: `${suffix.replaceAll("-", " ")} pressure`,
    summary: `A simulation-only unresolved pressure exercises the ${kind} quest path without establishing campaign canon.`,
    status: "active",
    visibility: "player",
    origin: "existing_thread_branch",
    basisId,
    minimumStage: "opening",
    maximumStage: "resolution",
    urgency: 2,
    locationIds: ["LOC-COUNCIL-CROWN"],
    factionIds,
    npcIds: [],
    recoveryPaths,
    createdTurn: 0,
    updatedTurn: 0,
    lastUsedTurn: 0
  };
}

function completeActiveObjective(db: ReturnType<typeof openDatabase>, campaignId: string, questId: string): void {
  const quest = listQuestInstances(db, campaignId).find((candidate) => candidate.questId === questId)!;
  const objective = quest.objectives.find((candidate) => candidate.state === "active");
  if (!objective) throw new Error(`Quest ${questId} has no active objective`);
  updateQuestObjective(db, campaignId, questId, objective.objectiveId, "completed");
}

export async function runQuestSimulations(content: VelmoraContent, pathCount = 12): Promise<QuestSimulationReport> {
  const root = mkdtempSync(join(tmpdir(), "velmora-quest-simulation-"));
  const paths: QuestSimulationReport["paths"] = [];
  const validationFailures: string[] = [];
  try {
    for (let index = 0; index < pathCount; index += 1) {
      const db = openDatabase(join(root, `path-${index + 1}.sqlite`));
      const name = `quest-simulation-${index + 1}`;
      const campaignId = createCampaign(db, content, name, `quest-simulation-seed-${index + 1}`);
      try {
        const mainThread = listStoryThreads(db, campaignId).find((thread) => thread.threadId === "THREAD-OPENING-PRESSURE")!;
        const factionThread = simulationThread(campaignId, mainThread.threadId, `${index + 1}-FACTION`, "faction", ["FAC-006"], [
          "Seek a different Glass contact after the failed exchange.",
          "Use the changed plaza access to approach the evidence from another side."
        ]);
        const sideThread = simulationThread(campaignId, mainThread.threadId, `${index + 1}-SIDE`, "side", ["FAC-005"], ["Return through a different civic contact."]);
        const capThread = simulationThread(campaignId, mainThread.threadId, `${index + 1}-CAP`, "dynamic", ["FAC-001"], ["Rebuild the route from the recorded consequence."]);
        for (const thread of [factionThread, sideThread, capThread]) persistStoryThread(db, thread);

        const adaptive = generateQuestFromThread(db, content, campaignId, mainThread.threadId);
        activateQuest(db, campaignId, adaptive.questId);
        completeActiveObjective(db, campaignId, adaptive.questId);
        addAdaptiveQuestObjective(db, campaignId, adaptive.questId, "Secure the new lead revealed by the completed investigation.", "secure");
        completeActiveObjective(db, campaignId, adaptive.questId);
        completeQuest(db, campaignId, adaptive.questId, adaptive.outcomes[0]!.outcomeId, "The opening pressure was stabilized through evidence and a secured lead.", ["problem", "location_or_world"]);

        const unexpected = generateQuestFromThread(db, content, campaignId, sideThread.threadId);
        activateQuest(db, campaignId, unexpected.questId);
        completeQuest(db, campaignId, unexpected.questId, unexpected.outcomes[1]!.outcomeId, "An improvised agreement resolved the civic pressure without following the expected route.", ["problem", "people_or_factions"], true);

        const failed = generateQuestFromThread(db, content, campaignId, factionThread.threadId);
        activateQuest(db, campaignId, failed.questId);
        failQuestRecoverably(db, campaignId, failed.questId);
        appendEvent(db, campaignId, 0, "tool_applied", {
          type: "record_location_consequence",
          locationId: "LOC-COUNCIL-CROWN",
          consequence: "The failed exchange changes access to the evidence in the Council Crown.",
          reason: "This recorded consequence supports two meaningfully different recovery routes."
        });
        const evidenceSequence = Number(listEvents(db, campaignId).at(-1)!.sequence);
        const firstRecovery = applyRecoveryQuest(db, content, campaignId, failed.questId, failed.recoveryPaths[0]!, [evidenceSequence], 0);
        applyRecoveryQuest(db, content, campaignId, failed.questId, failed.recoveryPaths[1]!, [evidenceSequence], 0);
        activateQuest(db, campaignId, firstRecovery.questId);
        completeActiveObjective(db, campaignId, firstRecovery.questId);
        completeQuest(db, campaignId, firstRecovery.questId, firstRecovery.outcomes[0]!.outcomeId, "One altered route recovered access while preserving the original failure as history.", ["problem", "location_or_world"]);

        const primary = generateQuestFromThread(db, content, campaignId, capThread.threadId);
        generateQuestFromThread(db, content, campaignId, capThread.threadId, [{ questId: primary.questId, type: "parallel" }]);
        let hardCapRejected = false;
        try {
          generateQuestFromThread(db, content, campaignId, capThread.threadId, [{ questId: primary.questId, type: "parallel" }]);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          hardCapRejected = /two .*unresolved quests/.test(message);
          if (!hardCapRejected) throw error;
        }

        const quests = listQuestInstances(db, campaignId);
        const unresolvedByThread = new Map<string, number>();
        for (const quest of quests.filter((candidate) => candidate.state !== "completed" && candidate.state !== "failed")) {
          unresolvedByThread.set(quest.sourceThreadId, (unresolvedByThread.get(quest.sourceThreadId) ?? 0) + 1);
        }
        const perspective = buildPerspectiveContext(db, content, name);
        const activeJournalQuests = perspective.playerQuests.filter((quest) => quest.state === "active" || quest.state === "changed").length;
        const journalEvents = buildJournalEvents(listEvents(db, campaignId), perspective.playerQuests);
        const events = listEvents(db, campaignId);
        paths.push({
          id: index + 1,
          totalQuests: quests.length,
          completedQuests: quests.filter((quest) => quest.state === "completed").length,
          failedQuests: quests.filter((quest) => quest.state === "failed").length,
          recoveryQuests: quests.filter((quest) => quest.recoveryOfQuestId !== null).length,
          adaptiveObjectives: events.filter((event) => event.eventType === "quest_objective_added").length,
          unexpectedCompletions: events.filter((event) => event.eventType === "quest_completed" && JSON.parse(String(event.payloadJson)).unexpected === true).length,
          maximumUnresolvedPerThread: Math.max(0, ...unresolvedByThread.values()),
          hardCapRejected,
          activeJournalQuests,
          recentJournalEvents: journalEvents.length
        });
      } catch (error) {
        validationFailures.push(`Path ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        db.close();
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  return { scope: { paths: pathCount, threadsPerPath: 4, canonChanged: false }, validationFailures, paths };
}
