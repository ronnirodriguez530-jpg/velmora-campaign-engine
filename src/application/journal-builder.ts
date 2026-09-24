import type { QuestInstance } from "../domain/types.ts";

type JournalQuest = Pick<QuestInstance, "questId" | "title" | "resolutionSummary" | "failureReason" | "objectives">;

export function buildJournalEvents(events: Array<Record<string, unknown>>, quests: JournalQuest[]) {
  const questsById = new Map(quests.map((quest) => [quest.questId, quest]));
  const entries: Array<{ turn: number; summary: string }> = [];
  for (const event of events) {
    const eventType = String(event.eventType ?? "");
    const payload = JSON.parse(String(event.payloadJson ?? "{}")) as Record<string, unknown>;
    const quest = typeof payload.questId === "string" ? questsById.get(payload.questId) : undefined;
    let summary: string | null = null;
    if (quest) {
      if (eventType === "quest_direction_committed") summary = `${quest.title}: you committed to a direction.`;
      if (eventType === "quest_objective_added") summary = `${quest.title}: ${String(payload.summary ?? "the situation created a new objective")}.`;
      if (eventType === "quest_objective_updated") {
        const objective = quest.objectives.find((item) => item.objectiveId === payload.objectiveId);
        summary = `${quest.title}: ${objective?.summary ?? "an objective"} was ${payload.state === "completed" ? "completed" : "lost"}.`;
      }
      if (eventType === "quest_completed") summary = `${quest.title}: ${quest.resolutionSummary ?? String(payload.resolutionSummary ?? "completed")}.`;
      if (eventType === "quest_failed_recoverably" || eventType === "quest_failed_from_consequence") summary = `${quest.title}: ${quest.failureReason ?? String(payload.reason ?? "this route failed")}.`;
      if (eventType === "quest_warning_recorded") summary = `${quest.title}: warning—${String(payload.signal ?? "the situation may worsen")}.`;
      if (eventType === "quest_neglect_complication") summary = `${quest.title}: ${String(payload.reason ?? "a mild complication developed")}.`;
    }
    if (eventType === "stage_advanced") summary = `The campaign entered the ${String(payload.stage ?? payload.toStage ?? "next")} stage.`;
    if (eventType === "tear_arrival") summary = "A new Tear arrival changed the situation in Velmora.";
    if (summary) entries.push({ turn: Number(event.turn ?? 0), summary });
  }
  return entries.slice(-5);
}
