import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type NpcReferenceLicense = "PUBLIC_DOMAIN_US" | "CC-BY-4.0" | "USER_OWNED" | "ORIGINAL";

export type NpcReferenceSource = {
  id: string;
  title: string;
  creator: string;
  url?: string;
  license: NpcReferenceLicense;
  attribution?: string;
  use: "distilled_principles" | "rules_reference";
};

export type NpcDesignLesson = {
  id: string;
  sourceIds: string[];
  tags: string[];
  principle: string;
  checks: string[];
  avoid: string[];
};

export type NpcReferenceLibrary = {
  sources: NpcReferenceSource[];
  lessons: NpcDesignLesson[];
};

const ALLOWED_LICENSES = new Set<NpcReferenceLicense>([
  "PUBLIC_DOMAIN_US",
  "CC-BY-4.0",
  "USER_OWNED",
  "ORIGINAL"
]);

export async function loadNpcReferenceLibrary(projectRoot: string): Promise<NpcReferenceLibrary> {
  const referenceRoot = resolve(projectRoot, "content", "npc-reference");
  const [sourcesText, curriculumText] = await Promise.all([
    readFile(resolve(referenceRoot, "sources.json"), "utf8"),
    readFile(resolve(referenceRoot, "curriculum.json"), "utf8")
  ]);
  const library = {
    sources: JSON.parse(sourcesText) as NpcReferenceSource[],
    lessons: JSON.parse(curriculumText) as NpcDesignLesson[]
  };
  validateNpcReferenceLibrary(library);
  return library;
}

export function validateNpcReferenceLibrary(library: NpcReferenceLibrary): void {
  const sourceIds = new Set<string>();
  for (const source of library.sources) {
    if (sourceIds.has(source.id)) throw new Error(`Duplicate NPC reference source ${source.id}`);
    sourceIds.add(source.id);
    if (!ALLOWED_LICENSES.has(source.license)) throw new Error(`Unapproved source license ${source.license}`);
    if (source.license === "CC-BY-4.0" && !source.attribution?.trim()) {
      throw new Error(`CC BY source ${source.id} requires attribution`);
    }
  }

  const lessonIds = new Set<string>();
  for (const lesson of library.lessons) {
    if (lessonIds.has(lesson.id)) throw new Error(`Duplicate NPC design lesson ${lesson.id}`);
    lessonIds.add(lesson.id);
    if (!lesson.principle.trim() || lesson.checks.length === 0 || lesson.avoid.length === 0) {
      throw new Error(`NPC design lesson ${lesson.id} is incomplete`);
    }
    for (const sourceId of lesson.sourceIds) {
      if (!sourceIds.has(sourceId)) throw new Error(`Lesson ${lesson.id} references missing source ${sourceId}`);
    }
  }
}

export function retrieveNpcDesignLessons(
  library: NpcReferenceLibrary,
  requestedTags: string[],
  limit = 5
): NpcDesignLesson[] {
  const tags = new Set(requestedTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  return library.lessons
    .map((lesson) => ({
      lesson,
      score: lesson.tags.reduce((total, tag) => total + (tags.has(tag.toLowerCase()) ? 1 : 0), 0)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.lesson.id.localeCompare(right.lesson.id))
    .slice(0, limit)
    .map((entry) => entry.lesson);
}
