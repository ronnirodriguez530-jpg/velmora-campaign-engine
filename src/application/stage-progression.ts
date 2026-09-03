import type { DatabaseSync } from "node:sqlite";
import type { CampaignStage, VelmoraContent } from "../domain/types.ts";
import { appendEvent, getCampaign, listFactionPathProgress } from "../persistence/database.ts";

// Mechanical scaffolding. These thresholds are testable defaults, not authored canon.
const nextStage: Partial<Record<CampaignStage, CampaignStage>> = {
  opening: "stabilization",
  stabilization: "escalation",
  escalation: "resolution"
};

const requiredProgress: Record<Exclude<CampaignStage, "resolution">, number> = {
  opening: 1,
  stabilization: 2,
  escalation: 3
};

// A durable turn is a meaningful player action, not a whole session. These floors
// preserve room for faction stories and consequences even if path milestones are
// completed unusually quickly.
const minimumStageDwellTurns: Record<Exclude<CampaignStage, "resolution">, number> = {
  opening: 6,
  stabilization: 18,
  escalation: 24
};

export function evaluateStageProgression(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignName: string,
  committedTurn: number
): CampaignStage | null {
  const campaign = getCampaign(db, campaignName);
  if (!campaign || campaign.stage === "resolution") return null;
  const turnsInStage = committedTurn - campaign.stageEnteredTurn;
  if (turnsInStage < minimumStageDwellTurns[campaign.stage]) return null;
  const threshold = requiredProgress[campaign.stage];
  const qualified = listFactionPathProgress(db, campaign.id).filter((path) => path.progress >= threshold);
  if (qualified.length < content.campaign.factionPathRequirement) return null;
  const target = nextStage[campaign.stage];
  if (!target) return null;
  db.prepare("UPDATE campaigns SET stage = ?, stage_entered_turn = ?, updated_at = ? WHERE id = ?")
    .run(target, committedTurn, new Date().toISOString(), campaign.id);
  appendEvent(db, campaign.id, committedTurn, "stage_advanced", {
    from: campaign.stage,
    to: target,
    turnsInStage,
    qualifyingFactionIds: qualified.map((path) => path.factionId)
  });
  return target;
}
