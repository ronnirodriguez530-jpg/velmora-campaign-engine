import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { VelmoraContent } from "../domain/types.ts";
import { validateContent } from "../domain/invariants.ts";

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function loadVelmoraContent(root: string): Promise<VelmoraContent> {
  const base = join(root, "content", "velmora");
  const content: VelmoraContent = {
    campaign: await readJson(join(base, "campaign.json")),
    stages: await readJson(join(base, "stages.json")),
    factions: await readJson(join(base, "factions.json")),
    locations: await readJson(join(base, "locations.json")),
    characters: await readJson(join(base, "characters.json")),
    truths: await readJson(join(base, "truths.json")),
    openingSpawns: await readJson(join(base, "opening-spawns.json")),
    storyBlueprintPools: await readJson(join(base, "story-blueprint-pools.json")),
    powers: await readJson(join(base, "powers.json")),
    sceneTemplates: await readJson(join(base, "templates", "scene-templates.json"))
  };
  validateContent(content);
  return content;
}
