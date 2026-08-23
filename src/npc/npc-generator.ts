import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { seededChoice } from "../application/seeded-random.ts";
import type { NpcCategory, NpcRecord, VelmoraContent } from "../domain/types.ts";
import { listNpcDesignProfiles, listNpcsByCategory, persistGeneratedNpc } from "../persistence/database.ts";
import { evaluateNpcDesign } from "./npc-design-evaluator.ts";
import type { NpcReferenceLibrary } from "./npc-reference-library.ts";
import { retrieveNpcDesignLessons } from "./npc-reference-library.ts";

type NpcGenerationPool = {
  givenNames: string[];
  familyNames: string[];
  desires: string[];
  complications: string[];
  changeLevers: string[];
  voiceCues: string[];
};

export type GenerateNpcRequest = {
  campaignId: string;
  campaignSeed: string;
  reason: string;
  role: string;
  factionId: string | null;
  locationId: string;
  category: NpcCategory;
  turn: number;
};

function fingerprint(values: string[]): string {
  return createHash("sha256").update(values.map((value) => value.trim().toLowerCase()).join("|")).digest("hex");
}

export async function generateNpcOnDemand(
  db: DatabaseSync,
  projectRoot: string,
  content: VelmoraContent,
  library: NpcReferenceLibrary,
  request: GenerateNpcRequest
): Promise<NpcRecord> {
  if (!request.reason.trim()) throw new Error("On-demand NPC generation requires a scene reason");
  if (!request.role.trim()) throw new Error("On-demand NPC generation requires a role");
  if (!content.locations.some((location) => location.id === request.locationId)) {
    throw new Error(`Unknown NPC location ${request.locationId}`);
  }
  if (request.factionId && !content.factions.some((faction) => faction.id === request.factionId)) {
    throw new Error(`Unknown NPC faction ${request.factionId}`);
  }

  const pool = JSON.parse(
    await readFile(resolve(projectRoot, "content", "velmora", "npc-generation.json"), "utf8")
  ) as NpcGenerationPool;
  const existingProfiles = listNpcDesignProfiles(db, request.campaignId);
  const existingNpcs = (["active", "known", "background"] as const)
    .flatMap((category) => listNpcsByCategory(db, request.campaignId, category));
  const priorFingerprints = existingProfiles.map((profile) => {
    const npc = existingNpcs.find((entry) => entry.npcId === profile.npcId)!;
    return {
      name: npc.name,
      role: npc.role,
      desire: profile.desire,
      complication: profile.complication
    };
  });
  const lessons = retrieveNpcDesignLessons(library, ["creation", "motivation", "agency", "originality"], 5);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const attemptSeed = `${request.campaignSeed}|${request.turn}|${request.reason}|${request.role}|${attempt}`;
    const givenName = seededChoice(`${attemptSeed}|given`, pool.givenNames);
    const familyName = seededChoice(`${attemptSeed}|family`, pool.familyNames);
    const draft = {
      name: `${givenName} ${familyName}`,
      role: request.role.trim(),
      desire: seededChoice(`${attemptSeed}|desire`, pool.desires),
      complication: seededChoice(`${attemptSeed}|complication`, pool.complications),
      changeLever: seededChoice(`${attemptSeed}|lever`, pool.changeLevers),
      voiceCues: [seededChoice(`${attemptSeed}|voice`, pool.voiceCues)],
      sourceSpecificReferences: []
    };
    const evaluation = evaluateNpcDesign(draft, priorFingerprints);
    if (!evaluation.accepted) continue;
    const designFingerprint = fingerprint([
      draft.role,
      draft.desire,
      draft.complication,
      draft.changeLever,
      ...draft.voiceCues
    ]);
    if (existingProfiles.some((profile) => profile.fingerprint === designFingerprint)) continue;

    const npcId = `NPC-GEN-${createHash("sha256").update(`${attemptSeed}|${draft.name}`).digest("hex").slice(0, 12).toUpperCase()}`;
    persistGeneratedNpc(db, {
      campaignId: request.campaignId,
      npcId,
      name: draft.name,
      category: request.category,
      origin: "generated",
      factionId: request.factionId,
      locationId: request.locationId,
      role: draft.role,
      createdTurn: request.turn
    }, {
      desire: draft.desire,
      complication: draft.complication,
      changeLever: draft.changeLever,
      voiceCues: draft.voiceCues,
      appliedLessonIds: lessons.map((lesson) => lesson.id),
      fingerprint: designFingerprint,
      generatedTurn: request.turn
    });
    return listNpcsByCategory(db, request.campaignId, request.category)
      .find((npc) => npc.npcId === npcId)!;
  }
  throw new Error("NPC generator exhausted its originality attempts; expand the approved generation pool");
}
