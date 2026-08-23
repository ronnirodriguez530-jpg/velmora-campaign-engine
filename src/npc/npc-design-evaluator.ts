export type NpcDesignDraft = {
  name: string;
  role: string;
  desire: string;
  complication: string;
  changeLever: string;
  voiceCues: string[];
  sourceSpecificReferences?: string[];
};

export type NpcDesignFingerprint = Pick<NpcDesignDraft, "name" | "role" | "desire" | "complication">;

export type NpcDesignEvaluation = {
  accepted: boolean;
  problems: string[];
};

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

function similarity(left: string, right: string): number {
  const a = words(left);
  const b = words(right);
  if (a.size === 0 && b.size === 0) return 1;
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / new Set([...a, ...b]).size;
}

export function evaluateNpcDesign(
  draft: NpcDesignDraft,
  existing: NpcDesignFingerprint[]
): NpcDesignEvaluation {
  const problems: string[] = [];
  if (!draft.name.trim()) problems.push("NPC requires an original name");
  if (!draft.role.trim()) problems.push("NPC requires a current role");
  if (!draft.desire.trim()) problems.push("NPC requires a present desire");
  if (!draft.complication.trim()) problems.push("NPC requires a complication");
  if (!draft.changeLever.trim()) problems.push("NPC requires a player-facing change lever");
  if (draft.voiceCues.length === 0) problems.push("NPC requires at least one situational voice cue");
  if ((draft.sourceSpecificReferences ?? []).length > 0) {
    problems.push("NPC draft contains source-specific names, phrases, or identity elements");
  }

  for (const prior of existing) {
    if (draft.name.trim().toLowerCase() === prior.name.trim().toLowerCase()) {
      problems.push(`NPC name duplicates ${prior.name}`);
    }
    const conceptSimilarity = similarity(
      `${draft.role} ${draft.desire} ${draft.complication}`,
      `${prior.role} ${prior.desire} ${prior.complication}`
    );
    if (conceptSimilarity >= 0.72) {
      problems.push(`NPC concept is too similar to ${prior.name}`);
    }
  }
  return { accepted: problems.length === 0, problems };
}
