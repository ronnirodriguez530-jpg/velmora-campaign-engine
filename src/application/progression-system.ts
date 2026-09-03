import type { DatabaseSync } from "node:sqlite";
import type { AbilityKey, CharacterAdvancement, MilestoneBasisType, PlayerProgression, ProgressionMilestone, SkillKey } from "../domain/types.ts";
import { appendEvent, getPlayerCharacter, getPlayerProgression, listProgressionMilestones, persistCharacterAdvancement, persistPlayerCharacter, persistPlayerProgression, persistProgressionMilestone } from "../persistence/database.ts";
import { ABILITIES, SKILLS, calculateAbilityModifier } from "./player-character.ts";

export type CharacterAdvancementInput =
  | { kind: "ability_score"; target: AbilityKey; playerApproved: boolean }
  | { kind: "skill_proficiency"; target: SkillKey; playerApproved: boolean };

function campaignTurn(db: DatabaseSync, campaignId: string): number {
  const campaign = db.prepare("SELECT turn FROM campaigns WHERE id = ?").get(campaignId) as { turn: number } | undefined;
  if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
  return campaign.turn;
}

function validStableId(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9-]{0,79}$/.test(id);
}

export function awardProgressionMilestone(
  db: DatabaseSync,
  campaignId: string,
  input: { milestoneId: string; basisType: MilestoneBasisType; basisId: string; summary: string }
): { milestone: ProgressionMilestone; progression: PlayerProgression } {
  if (!getPlayerCharacter(db, campaignId)) throw new Error("Create the player character before awarding progression");
  if (!validStableId(input.milestoneId) || !validStableId(input.basisId)) throw new Error("Milestone and basis IDs must be stable identifiers");
  const summary = input.summary.trim();
  if (summary.length < 1 || summary.length > 240) throw new Error("Milestone summary must be 1-240 characters");
  if (listProgressionMilestones(db, campaignId).some((milestone) => milestone.milestoneId === input.milestoneId ||
      (milestone.basisType === input.basisType && milestone.basisId === input.basisId))) {
    throw new Error("This progression milestone or source has already been awarded");
  }
  const turn = campaignTurn(db, campaignId);
  const milestone: ProgressionMilestone = { campaignId, ...input, summary, awardedTurn: turn };
  const current = getPlayerProgression(db, campaignId);
  const progression: PlayerProgression = {
    campaignId,
    earnedAdvancements: current.earnedAdvancements + 1,
    spentAdvancements: current.spentAdvancements,
    availableAdvancements: current.availableAdvancements + 1,
    updatedTurn: turn
  };

  db.exec("BEGIN IMMEDIATE");
  try {
    persistProgressionMilestone(db, milestone);
    persistPlayerProgression(db, progression);
    appendEvent(db, campaignId, turn, "progression_milestone_awarded", {
      milestoneId: milestone.milestoneId,
      basisType: milestone.basisType,
      basisId: milestone.basisId
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { milestone, progression: getPlayerProgression(db, campaignId) };
}

export function applyCharacterAdvancement(
  db: DatabaseSync,
  campaignId: string,
  input: CharacterAdvancementInput
): { advancement: CharacterAdvancement; progression: PlayerProgression } {
  if (!input.playerApproved) throw new Error("Character advancement requires explicit player approval");
  const character = getPlayerCharacter(db, campaignId);
  if (!character) throw new Error("Create the player character before applying advancement");
  const progression = getPlayerProgression(db, campaignId);
  if (progression.availableAdvancements < 1) throw new Error("No advancement opportunity is available");
  const turn = campaignTurn(db, campaignId);
  const advancementId = `ADV-${String(progression.spentAdvancements + 1).padStart(3, "0")}`;
  let advancement: CharacterAdvancement;
  let updatedCharacter = character;

  if (input.kind === "ability_score") {
    if (!ABILITIES.includes(input.target)) throw new Error("Unknown ability advancement target");
    const previousValue = character.abilityScores[input.target];
    if (previousValue >= 18) throw new Error("First-release ability scores cannot exceed 18");
    const abilityScores = { ...character.abilityScores, [input.target]: previousValue + 1 };
    const abilityModifiers = Object.fromEntries(ABILITIES.map((ability) => [ability, calculateAbilityModifier(abilityScores[ability])])) as typeof character.abilityModifiers;
    const hpIncrease = abilityModifiers.constitution - character.abilityModifiers.constitution;
    const maxHp = character.maxHp + hpIncrease;
    updatedCharacter = {
      ...character,
      abilityScores,
      abilityModifiers,
      maxHp,
      currentHp: Math.min(maxHp, character.currentHp + Math.max(0, hpIncrease)),
      defense: 10 + abilityModifiers.dexterity + character.armorBonus,
      updatedTurn: turn
    };
    advancement = {
      campaignId,
      advancementId,
      kind: input.kind,
      target: input.target,
      previousValue,
      newValue: previousValue + 1,
      appliedTurn: turn
    };
  } else {
    const skillKeys = SKILLS.map((skill) => skill.key);
    if (!skillKeys.includes(input.target)) throw new Error("Unknown skill advancement target");
    if (character.skillProficiencies.includes(input.target)) throw new Error("The character already has that skill proficiency");
    updatedCharacter = {
      ...character,
      skillProficiencies: [...character.skillProficiencies, input.target].sort(),
      updatedTurn: turn
    };
    advancement = {
      campaignId,
      advancementId,
      kind: input.kind,
      target: input.target,
      previousValue: null,
      newValue: null,
      appliedTurn: turn
    };
  }

  const nextProgression: PlayerProgression = {
    ...progression,
    spentAdvancements: progression.spentAdvancements + 1,
    availableAdvancements: progression.availableAdvancements - 1,
    updatedTurn: turn
  };
  db.exec("BEGIN IMMEDIATE");
  try {
    persistPlayerCharacter(db, updatedCharacter);
    persistCharacterAdvancement(db, advancement);
    persistPlayerProgression(db, nextProgression);
    appendEvent(db, campaignId, turn, "character_advancement_applied", {
      advancementId,
      kind: advancement.kind,
      target: advancement.target
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { advancement, progression: getPlayerProgression(db, campaignId) };
}
