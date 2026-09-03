import type { DatabaseSync } from "node:sqlite";
import type { AbilityKey, PlayerCharacter, SkillKey } from "../domain/types.ts";
import { appendEvent, getPlayerCharacter, persistPlayerCharacter } from "../persistence/database.ts";

export const ABILITIES: AbilityKey[] = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
export const STARTING_ARRAY = [15, 14, 13, 12, 10, 8] as const;
export const SKILLS: Array<{ key: SkillKey; name: string; ability: AbilityKey }> = [
  { key: "acrobatics", name: "Acrobatics", ability: "dexterity" },
  { key: "animal_handling", name: "Animal Handling", ability: "wisdom" },
  { key: "arcana", name: "Arcana", ability: "intelligence" },
  { key: "athletics", name: "Athletics", ability: "strength" },
  { key: "deception", name: "Deception", ability: "charisma" },
  { key: "history", name: "History", ability: "intelligence" },
  { key: "insight", name: "Insight", ability: "wisdom" },
  { key: "intimidation", name: "Intimidation", ability: "charisma" },
  { key: "investigation", name: "Investigation", ability: "intelligence" },
  { key: "medicine", name: "Medicine", ability: "wisdom" },
  { key: "nature", name: "Nature", ability: "intelligence" },
  { key: "perception", name: "Perception", ability: "wisdom" },
  { key: "performance", name: "Performance", ability: "charisma" },
  { key: "persuasion", name: "Persuasion", ability: "charisma" },
  { key: "religion", name: "Religion", ability: "intelligence" },
  { key: "sleight_of_hand", name: "Sleight of Hand", ability: "dexterity" },
  { key: "stealth", name: "Stealth", ability: "dexterity" },
  { key: "survival", name: "Survival", ability: "wisdom" }
];

export type PlayerCharacterInput = {
  name: string;
  identityNotes?: string;
  abilityScores: Record<AbilityKey, number>;
  skillProficiencies: SkillKey[];
  saveProficiencies: AbilityKey[];
};

export function calculateAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function sameStartingArray(scores: number[]): boolean {
  return [...scores].sort((a, b) => b - a).every((score, index) => score === STARTING_ARRAY[index]);
}

export function createPlayerCharacter(
  db: DatabaseSync,
  campaignId: string,
  input: PlayerCharacterInput
): PlayerCharacter {
  const campaign = db.prepare("SELECT turn FROM campaigns WHERE id = ?").get(campaignId) as { turn: number } | undefined;
  if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
  if (getPlayerCharacter(db, campaignId)) throw new Error("This campaign already has a player character");

  const name = input.name.trim();
  const identityNotes = (input.identityNotes ?? "").trim();
  if (name.length < 1 || name.length > 60) throw new Error("Character name must be 1-60 characters");
  if (identityNotes.length > 500) throw new Error("Character identity notes must be at most 500 characters");
  if (!input.abilityScores || typeof input.abilityScores !== "object") throw new Error("All six ability scores are required");
  const abilityKeys = Object.keys(input.abilityScores);
  if (abilityKeys.length !== ABILITIES.length || !ABILITIES.every((ability) => Object.hasOwn(input.abilityScores, ability))) {
    throw new Error("Character requires exactly the six approved abilities");
  }
  const scores = ABILITIES.map((ability) => input.abilityScores[ability]);
  if (!scores.every(Number.isInteger) || !sameStartingArray(scores)) {
    throw new Error("Ability scores must use 15, 14, 13, 12, 10, and 8 exactly once");
  }

  const skillKeys = new Set(SKILLS.map((skill) => skill.key));
  if (!Array.isArray(input.skillProficiencies) || input.skillProficiencies.length !== 4 || new Set(input.skillProficiencies).size !== 4) {
    throw new Error("Choose exactly four unique skill proficiencies");
  }
  if (!input.skillProficiencies.every((skill) => skillKeys.has(skill))) throw new Error("Unknown skill proficiency");
  if (!Array.isArray(input.saveProficiencies) || input.saveProficiencies.length !== 2 || new Set(input.saveProficiencies).size !== 2) {
    throw new Error("Choose exactly two unique saving-throw proficiencies");
  }
  if (!input.saveProficiencies.every((ability) => ABILITIES.includes(ability))) throw new Error("Unknown saving-throw proficiency");

  const abilityScores = Object.fromEntries(ABILITIES.map((ability) => [ability, input.abilityScores[ability]])) as PlayerCharacter["abilityScores"];
  const abilityModifiers = Object.fromEntries(ABILITIES.map((ability) => [ability, calculateAbilityModifier(abilityScores[ability])])) as PlayerCharacter["abilityModifiers"];
  const maxHp = 12 + abilityModifiers.constitution;
  const character: PlayerCharacter = {
    campaignId,
    characterId: "PC-001",
    creationVersion: 1,
    name,
    identityNotes,
    abilityScores,
    abilityModifiers,
    skillProficiencies: [...input.skillProficiencies].sort(),
    saveProficiencies: [...input.saveProficiencies].sort(),
    proficiencyBonus: 2,
    maxHp,
    currentHp: maxHp,
    armorBonus: 0,
    defense: 10 + abilityModifiers.dexterity,
    createdTurn: campaign.turn,
    updatedTurn: campaign.turn
  };

  db.exec("BEGIN IMMEDIATE");
  try {
    persistPlayerCharacter(db, character);
    appendEvent(db, campaignId, campaign.turn, "player_character_created", {
      characterId: character.characterId,
      name: character.name,
      creationVersion: character.creationVersion
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getPlayerCharacter(db, campaignId)!;
}
