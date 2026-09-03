import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignDirector } from "../director/director.ts";
import type { DirectorPlanningContext, DirectorTurnPlan, VelmoraContent } from "../domain/types.ts";
import { createCampaign, getCampaign, listEvents, listFactionPathProgress, openDatabase } from "../persistence/database.ts";
import { openPlayableMoment, submitPlayableAction } from "./gameplay-session.ts";

const PROFILES = [
  { name: "defense-magic", factions: ["FAC-001", "FAC-002"] },
  { name: "expedition-alteration", factions: ["FAC-003", "FAC-004"] },
  { name: "civic-secrets", factions: ["FAC-005", "FAC-006"] },
  { name: "cross-faction", factions: ["FAC-001", "FAC-005"] }
] as const;

class SimulationDirector implements CampaignDirector {
  readonly source = "diagnostic" as const;
  readonly #factions: readonly [string, string];

  constructor(factions: readonly [string, string]) { this.#factions = factions; }

  async preview() {
    return { intent: "inspect" as const, summary: "Simulation preview", suggestedActions: ["Continue", "Reconsider"] as [string, string], allowsFreeText: true as const };
  }

  async planTurn(context: DirectorPlanningContext): Promise<DirectorTurnPlan> {
    const target = this.#factions[context.turn % this.#factions.length];
    const progress = context.factionPathProgress.find((path) => path.factionId === target)?.progress ?? 0;
    return {
      summary: `Mechanical simulation turn ${context.turn + 1}`,
      majorActionProposal: true,
      toolRequests: progress < 3 ? [{
        type: "advance_faction_path",
        factionId: target,
        reason: "Simulation completed one abstract milestone without authoring its story content"
      }] : [],
      suggestedActions: ["Continue", "Reconsider"],
      allowsFreeText: true
    };
  }
}

export type SimulationReport = {
  scope: { paths: number; turnsPerPath: number; canonChanged: false };
  stageDistribution: Record<string, number>;
  pathsReachingResolution: number;
  validationFailures: string[];
  repeatedFinalPatterns: Array<{ signature: string; count: number }>;
  paths: Array<{
    id: number;
    profile: string;
    finalStage: string;
    committedTurns: number;
    tearArrivals: number;
    factionProgress: Array<{ factionId: string; progress: number }>;
  }>;
};

export async function runSimulations(content: VelmoraContent, pathCount = 12, turnsPerPath = 12): Promise<SimulationReport> {
  const root = mkdtempSync(join(tmpdir(), "velmora-simulation-"));
  const paths: SimulationReport["paths"] = [];
  const validationFailures: string[] = [];

  for (let index = 0; index < pathCount; index += 1) {
    const profile = PROFILES[index % PROFILES.length];
    const db = openDatabase(join(root, `path-${index + 1}.sqlite`));
    const name = `simulation-${index + 1}`;
    const campaignId = createCampaign(db, content, name, `simulation-seed-${index + 1}`);
    const director = new SimulationDirector(profile.factions);
    try {
      for (let turn = 0; turn < turnsPerPath; turn += 1) {
        openPlayableMoment(db, content, name);
        await submitPlayableAction(db, content, director, name, "commit simulation step");
      }
      const campaign = getCampaign(db, name)!;
      const events = listEvents(db, campaignId);
      paths.push({
        id: index + 1,
        profile: profile.name,
        finalStage: campaign.stage,
        committedTurns: campaign.turn,
        tearArrivals: events.filter((event) => event.eventType === "tear_arrival").length,
        factionProgress: listFactionPathProgress(db, campaignId)
      });
    } catch (error) {
      validationFailures.push(`Path ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      db.close();
    }
  }

  const stageDistribution: Record<string, number> = {};
  const signatures = new Map<string, number>();
  for (const path of paths) {
    stageDistribution[path.finalStage] = (stageDistribution[path.finalStage] ?? 0) + 1;
    const signature = `${path.finalStage}|${path.factionProgress.map((item) => `${item.factionId}:${item.progress}`).join(",")}`;
    signatures.set(signature, (signatures.get(signature) ?? 0) + 1);
  }

  return {
    scope: { paths: pathCount, turnsPerPath, canonChanged: false },
    stageDistribution,
    pathsReachingResolution: paths.filter((path) => path.finalStage === "resolution").length,
    validationFailures,
    repeatedFinalPatterns: [...signatures.entries()].map(([signature, count]) => ({ signature, count })).sort((a, b) => b.count - a.count),
    paths
  };
}
