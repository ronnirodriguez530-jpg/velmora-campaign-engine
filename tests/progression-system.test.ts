import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { buildPerspectiveContext } from "../src/application/context-builder.ts";
import { createPlayerCharacter, type PlayerCharacterInput } from "../src/application/player-character.ts";
import { applyCharacterAdvancement, awardProgressionMilestone } from "../src/application/progression-system.ts";
import { captureSnapshot, createCampaign, getPlayerCharacter, getPlayerProgression, insertCheckpoint, listCharacterAdvancements, listProgressionMilestones, openDatabase, restorePreviousTurn } from "../src/persistence/database.ts";

const characterInput: PlayerCharacterInput = {
  name: "Vale Reed",
  abilityScores: { strength: 12, dexterity: 15, constitution: 14, intelligence: 13, wisdom: 10, charisma: 8 },
  skillProficiencies: ["acrobatics", "investigation", "perception", "stealth"],
  saveProficiencies: ["dexterity", "wisdom"]
};

async function setup(name: string) {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), "velmora-progression-test-")), "test.sqlite"));
  const campaignId = createCampaign(db, content, name, "fixed-progression-seed");
  createPlayerCharacter(db, campaignId, characterInput);
  return { content, db, campaignId };
}

test("awards one advancement for each unique validated milestone source", async () => {
  const { content, db, campaignId } = await setup("progression-milestones");
  try {
    const result = awardProgressionMilestone(db, campaignId, {
      milestoneId: "MS-OPENING-SURVIVED",
      basisType: "story",
      basisId: "THREAD-OPENING-PRESSURE",
      summary: "Survived the first Council Plaza crisis."
    });
    assert.equal(result.progression.availableAdvancements, 1);
    assert.equal(listProgressionMilestones(db, campaignId).length, 1);
    assert.equal(buildPerspectiveContext(db, content, "progression-milestones").playerProgression.earnedAdvancements, 1);
    assert.throws(() => awardProgressionMilestone(db, campaignId, {
      milestoneId: "MS-DUPLICATE",
      basisType: "story",
      basisId: "THREAD-OPENING-PRESSURE",
      summary: "Attempted duplicate source."
    }), /already been awarded/);
  } finally { db.close(); }
});

test("player-approved advancement improves one ability or new skill and spends once", async () => {
  const { db, campaignId } = await setup("progression-spending");
  try {
    awardProgressionMilestone(db, campaignId, {
      milestoneId: "MS-ONE",
      basisType: "discovery",
      basisId: "DISCOVERY-ONE",
      summary: "Confirmed a meaningful discovery."
    });
    assert.throws(() => applyCharacterAdvancement(db, campaignId, {
      kind: "ability_score",
      target: "dexterity",
      playerApproved: false
    }), /explicit player approval/);
    const abilityResult = applyCharacterAdvancement(db, campaignId, {
      kind: "ability_score",
      target: "dexterity",
      playerApproved: true
    });
    assert.equal(abilityResult.progression.availableAdvancements, 0);
    assert.equal(getPlayerCharacter(db, campaignId)?.abilityScores.dexterity, 16);
    assert.equal(getPlayerCharacter(db, campaignId)?.defense, 13);
    assert.throws(() => applyCharacterAdvancement(db, campaignId, {
      kind: "skill_proficiency",
      target: "medicine",
      playerApproved: true
    }), /No advancement opportunity/);

    awardProgressionMilestone(db, campaignId, {
      milestoneId: "MS-TWO",
      basisType: "faction",
      basisId: "FAC-MILESTONE-ONE",
      summary: "Completed a meaningful faction milestone."
    });
    applyCharacterAdvancement(db, campaignId, {
      kind: "skill_proficiency",
      target: "medicine",
      playerApproved: true
    });
    assert.equal(getPlayerCharacter(db, campaignId)?.skillProficiencies.includes("medicine"), true);
    assert.equal(listCharacterAdvancements(db, campaignId).length, 2);
  } finally { db.close(); }
});

test("one-turn rollback restores progression ledger and character improvements", async () => {
  const { db, campaignId } = await setup("progression-rollback");
  try {
    insertCheckpoint(db, campaignId, 0, 1, "pre_turn", captureSnapshot(db, campaignId));
    db.prepare("UPDATE campaigns SET turn = 1 WHERE id = ?").run(campaignId);
    awardProgressionMilestone(db, campaignId, {
      milestoneId: "MS-ROLLBACK",
      basisType: "quest",
      basisId: "QUEST-ROLLBACK",
      summary: "A milestone that will be rolled back."
    });
    applyCharacterAdvancement(db, campaignId, {
      kind: "ability_score",
      target: "dexterity",
      playerApproved: true
    });
    restorePreviousTurn(db, "progression-rollback");
    assert.equal(getPlayerCharacter(db, campaignId)?.abilityScores.dexterity, 15);
    assert.equal(getPlayerProgression(db, campaignId).earnedAdvancements, 0);
    assert.equal(listProgressionMilestones(db, campaignId).length, 0);
    assert.equal(listCharacterAdvancements(db, campaignId).length, 0);
  } finally { db.close(); }
});
