import type { NpcCategory } from "../domain/types.ts";

export type NpcRelevanceSignals = {
  presentInCurrentScene?: boolean;
  tiedToCurrentQuest?: boolean;
  tiedToCurrentConflict?: boolean;
  tiedToFactionDecision?: boolean;
  immediateThreatOrAlly?: boolean;
  namedOrMeaningfullyEncountered?: boolean;
  affectedByPlayer?: boolean;
  witnessedImportantEvent?: boolean;
  hasPersistentTie?: boolean;
  involvementEnded?: boolean;
  extendedInactivity?: boolean;
};

export type NpcCategoryDecision = {
  category: NpcCategory;
  reason: string;
};

export function decideNpcCategory(current: NpcCategory, signals: NpcRelevanceSignals): NpcCategoryDecision {
  if (
    signals.presentInCurrentScene ||
    signals.tiedToCurrentQuest ||
    signals.tiedToCurrentConflict ||
    signals.tiedToFactionDecision ||
    signals.immediateThreatOrAlly
  ) {
    return { category: "active", reason: "NPC has immediate campaign relevance" };
  }

  if (signals.hasPersistentTie) {
    return { category: "known", reason: "NPC has an unresolved persistent tie" };
  }

  if (
    signals.namedOrMeaningfullyEncountered ||
    signals.affectedByPlayer ||
    signals.witnessedImportantEvent ||
    signals.involvementEnded
  ) {
    return { category: "known", reason: "NPC must retain meaningful campaign continuity" };
  }

  if (signals.extendedInactivity) {
    return { category: "background", reason: "NPC is inactive and has no persistent tie" };
  }

  return { category: current, reason: "No category-changing event occurred" };
}
