import { randomInt, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { CampaignDirector } from "../director/director.ts";
import type { AbilityKey, ActionAssessment, ActionRollResolution, CheckDifficulty, PendingActionCheckView, PlayerCharacter, RollMode, RollOutcome, SkillKey, VelmoraContent } from "../domain/types.ts";
import { getCampaign, getPlayerCharacter } from "../persistence/database.ts";
import { ABILITIES, SKILLS } from "./player-character.ts";
import { buildDirectorPlanningContext } from "./context-builder.ts";

const DIFFICULTY_DC: Record<CheckDifficulty, number> = { easy: 8, standard: 12, hard: 16, extreme: 20 };
const MODES: RollMode[] = ["normal", "advantage", "disadvantage"];

type PendingRow = {
  campaignId: string;
  checkId: string;
  playerInput: string;
  category: "ability" | "skill" | "saving_throw";
  ability: AbilityKey;
  skill: SkillKey | null;
  difficulty: CheckDifficulty;
  dc: number;
  mode: RollMode;
  stakes: string;
  modifier: number;
  proficiencyApplied: number;
  createdTurn: number;
};

function pendingRow(db: DatabaseSync, campaignId: string): PendingRow | undefined {
  return db.prepare(`SELECT campaign_id AS campaignId, check_id AS checkId, player_input AS playerInput,
      category, ability, skill, difficulty, dc, mode, stakes, modifier,
      proficiency_applied AS proficiencyApplied, created_turn AS createdTurn
    FROM pending_action_checks WHERE campaign_id = ?`).get(campaignId) as PendingRow | undefined;
}

function publicView(row: PendingRow): PendingActionCheckView {
  return {
    checkId: row.checkId,
    category: row.category,
    ability: row.ability,
    skill: row.skill,
    mode: row.mode,
    modifier: row.modifier,
    proficiencyApplied: row.proficiencyApplied === 1,
    stakes: row.stakes
  };
}

function validateAssessment(assessment: ActionAssessment): void {
  if (assessment.resolution === "automatic") {
    if (!assessment.reason.trim()) throw new Error("Automatic action assessment requires a reason");
    return;
  }
  if (!ABILITIES.includes(assessment.ability)) throw new Error("Action check uses an unknown ability");
  if (!Object.hasOwn(DIFFICULTY_DC, assessment.difficulty)) throw new Error("Action check uses an unknown difficulty");
  if (!MODES.includes(assessment.mode)) throw new Error("Action check uses an unknown roll mode");
  if (assessment.stakes.trim().length < 1 || assessment.stakes.length > 300) throw new Error("Action check stakes must be 1-300 characters");
  if (assessment.category === "skill") {
    const skill = SKILLS.find((entry) => entry.key === assessment.skill);
    if (!skill) throw new Error("Skill check requires a known skill");
    if (skill.ability !== assessment.ability) throw new Error(`${skill.name} must use ${skill.ability}`);
  } else if (assessment.skill !== null) {
    throw new Error("Ability and saving-throw checks cannot include a skill");
  }
}

function modifierFor(character: PlayerCharacter, assessment: Extract<ActionAssessment, { resolution: "check" }>): { modifier: number; proficient: boolean } {
  const proficient = assessment.category === "skill"
    ? character.skillProficiencies.includes(assessment.skill!)
    : assessment.category === "saving_throw" && character.saveProficiencies.includes(assessment.ability);
  return { modifier: character.abilityModifiers[assessment.ability] + (proficient ? character.proficiencyBonus : 0), proficient };
}

export async function assessPlayerAction(
  db: DatabaseSync,
  content: VelmoraContent,
  director: CampaignDirector,
  campaignName: string,
  playerInput: string
): Promise<{ automatic: true; reason: string } | { automatic: false; check: PendingActionCheckView }> {
  const campaign = getCampaign(db, campaignName);
  if (!campaign) throw new Error(`Campaign '${campaignName}' does not exist`);
  const character = getPlayerCharacter(db, campaign.id);
  if (!character) throw new Error("Create your player character before beginning story play");
  const existing = pendingRow(db, campaign.id);
  if (existing) throw new Error("Resolve the pending action check before attempting another action");
  const assessment = director.assessAction
    ? await director.assessAction(buildDirectorPlanningContext(db, content, campaignName), playerInput)
    : { resolution: "automatic" as const, reason: "This Director does not request action checks." };
  validateAssessment(assessment);
  if (assessment.resolution === "automatic") return { automatic: true, reason: assessment.reason.trim() };
  const { modifier, proficient } = modifierFor(character, assessment);
  const row: PendingRow = {
    campaignId: campaign.id,
    checkId: `CHECK-${randomUUID()}`,
    playerInput,
    category: assessment.category,
    ability: assessment.ability,
    skill: assessment.skill,
    difficulty: assessment.difficulty,
    dc: DIFFICULTY_DC[assessment.difficulty],
    mode: assessment.mode,
    stakes: assessment.stakes.trim(),
    modifier,
    proficiencyApplied: proficient ? 1 : 0,
    createdTurn: campaign.turn
  };
  db.prepare(`INSERT INTO pending_action_checks(campaign_id, check_id, player_input, category, ability, skill,
      difficulty, dc, mode, stakes, modifier, proficiency_applied, created_turn)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(row.campaignId, row.checkId, row.playerInput, row.category, row.ability, row.skill, row.difficulty, row.dc, row.mode, row.stakes, row.modifier, row.proficiencyApplied, row.createdTurn);
  return { automatic: false, check: publicView(row) };
}

function outcomeFor(keptDie: number, total: number, dc: number): RollOutcome {
  if (keptDie === 20) return "critical_success";
  if (keptDie === 1) return "critical_failure";
  if (total >= dc) return "success";
  if (dc - total <= 3) return "success_with_cost";
  return "failure";
}

export function rollPendingAction(
  db: DatabaseSync,
  campaignName: string,
  checkId: string,
  dieRoll: () => number = () => randomInt(1, 21)
): { playerInput: string; resolution: ActionRollResolution } {
  const campaign = getCampaign(db, campaignName);
  if (!campaign) throw new Error(`Campaign '${campaignName}' does not exist`);
  const pending = pendingRow(db, campaign.id);
  if (!pending || pending.checkId !== checkId) throw new Error("That action check is not pending");
  const existing = db.prepare(`SELECT dice_json AS diceJson, kept_die AS keptDie, modifier, total, outcome
    FROM roll_records WHERE campaign_id = ? AND check_id = ?`).get(campaign.id, checkId) as { diceJson: string; keptDie: number; modifier: number; total: number; outcome: RollOutcome } | undefined;
  let dice: number[], keptDie: number, total: number, outcome: RollOutcome;
  if (existing) {
    dice = JSON.parse(existing.diceJson) as number[];
    keptDie = existing.keptDie;
    total = existing.total;
    outcome = existing.outcome;
  } else {
    const count = pending.mode === "normal" ? 1 : 2;
    dice = Array.from({ length: count }, dieRoll);
    if (!dice.every((die) => Number.isInteger(die) && die >= 1 && die <= 20)) throw new Error("Dice source returned an invalid d20 result");
    keptDie = pending.mode === "advantage" ? Math.max(...dice) : pending.mode === "disadvantage" ? Math.min(...dice) : dice[0]!;
    total = keptDie + pending.modifier;
    outcome = outcomeFor(keptDie, total, pending.dc);
    db.prepare(`INSERT INTO roll_records(campaign_id, roll_id, check_id, turn, category, ability, skill, mode,
        dice_json, kept_die, modifier, total, difficulty, dc, outcome, stakes, created_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(campaign.id, `ROLL-${randomUUID()}`, checkId, campaign.turn, pending.category, pending.ability, pending.skill,
        pending.mode, JSON.stringify(dice), keptDie, pending.modifier, total, pending.difficulty, pending.dc, outcome, pending.stakes, new Date().toISOString());
  }
  return {
    playerInput: pending.playerInput,
    resolution: {
      checkId,
      category: pending.category,
      ability: pending.ability,
      skill: pending.skill,
      mode: pending.mode,
      dice,
      keptDie,
      modifier: pending.modifier,
      total,
      outcome,
      stakes: pending.stakes
    }
  };
}

export function completePendingAction(db: DatabaseSync, campaignName: string, checkId: string): void {
  const campaign = getCampaign(db, campaignName);
  if (!campaign) throw new Error(`Campaign '${campaignName}' does not exist`);
  db.prepare("DELETE FROM pending_action_checks WHERE campaign_id = ? AND check_id = ?").run(campaign.id, checkId);
}

export function getPendingActionCheck(db: DatabaseSync, campaignId: string): PendingActionCheckView | null {
  const row = pendingRow(db, campaignId);
  return row ? publicView(row) : null;
}

export function listRollRecords(db: DatabaseSync, campaignId: string): Array<{ checkId: string; dice: number[]; keptDie: number; modifier: number; total: number; outcome: RollOutcome }> {
  return (db.prepare(`SELECT check_id AS checkId, dice_json AS diceJson, kept_die AS keptDie, modifier, total, outcome
    FROM roll_records WHERE campaign_id = ? ORDER BY rowid`).all(campaignId) as Array<{ checkId: string; diceJson: string; keptDie: number; modifier: number; total: number; outcome: RollOutcome }>).map((row) => ({
      checkId: row.checkId, dice: JSON.parse(row.diceJson) as number[], keptDie: row.keptDie, modifier: row.modifier, total: row.total, outcome: row.outcome
    }));
}
