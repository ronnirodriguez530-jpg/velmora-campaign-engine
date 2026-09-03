import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CampaignDirector } from "../src/director/director.ts";
import type { ActionAssessment, ActionResolution } from "../src/domain/types.ts";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { assessPlayerAction, completePendingAction, listRollRecords, rollPendingAction } from "../src/application/dice-resolution.ts";
import { createPlayerCharacter } from "../src/application/player-character.ts";
import { submitPlayableAction } from "../src/application/gameplay-session.ts";
import { createCampaign, openDatabase } from "../src/persistence/database.ts";
import { MockDirector } from "../src/director/mock-director.ts";

const characterInput = {
  name: "Mara Vale",
  abilityScores: { strength: 10, dexterity: 15, constitution: 14, intelligence: 13, wisdom: 12, charisma: 8 },
  skillProficiencies: ["acrobatics", "investigation", "perception", "stealth"],
  saveProficiencies: ["dexterity", "wisdom"]
} as const;

async function setup(name: string) {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), "velmora-dice-test-")), "test.sqlite"));
  const campaignId = createCampaign(db, content, name, "fixed-dice-seed");
  createPlayerCharacter(db, campaignId, {
    ...characterInput,
    skillProficiencies: [...characterInput.skillProficiencies],
    saveProficiencies: [...characterInput.saveProficiencies]
  });
  return { content, db, campaignId };
}

function assessingDirector(assessment: ActionAssessment): CampaignDirector {
  return {
    source: "diagnostic",
    preview: (context) => new MockDirector().preview(context),
    presentScene: (context, scene) => new MockDirector().presentScene(context, scene),
    assessAction: async () => assessment,
    planTurn: async (_context, _input, _feedback, resolution?: ActionResolution) => ({
      summary: resolution?.kind === "rolled" ? `Resolved as ${resolution.roll.outcome}.` : "Resolved automatically.",
      majorActionProposal: true,
      toolRequests: [],
      suggestedActions: ["Continue", "Reconsider"],
      allowsFreeText: true
    })
  };
}

const stealthCheck = (mode: "normal" | "advantage" | "disadvantage" = "normal"): ActionAssessment => ({
  resolution: "check",
  category: "skill",
  ability: "dexterity",
  skill: "stealth",
  difficulty: "standard",
  mode,
  stakes: "Pass unseen or draw attention while retaining another route.",
  reason: "The attempt is uncertain and meaningful."
});

test("creates a hidden-DC skill check using character proficiency", async () => {
  const { content, db } = await setup("dice-assess");
  try {
    const result = await assessPlayerAction(db, content, assessingDirector(stealthCheck()), "dice-assess", "Slip past the watcher");
    assert.equal(result.automatic, false);
    if (result.automatic) return;
    assert.equal(result.check.modifier, 4);
    assert.equal(result.check.proficiencyApplied, true);
    assert.equal(result.check.skill, "stealth");
    assert.equal(Object.hasOwn(result.check, "dc"), false);
    assert.equal(Object.hasOwn(result.check, "difficulty"), false);
  } finally { db.close(); }
});

test("ability and saving-throw checks apply proficiency only where approved", async () => {
  const { content, db } = await setup("dice-check-types");
  try {
    const abilityCheck: ActionAssessment = { resolution: "check", category: "ability", ability: "dexterity", skill: null, difficulty: "easy", mode: "normal", stakes: "Clear the obstacle or lose time.", reason: "Uncertain obstacle." };
    const ability = await assessPlayerAction(db, content, assessingDirector(abilityCheck), "dice-check-types", "Balance across");
    if (ability.automatic) throw new Error("Expected ability check");
    assert.equal(ability.check.modifier, 2);
    assert.equal(ability.check.proficiencyApplied, false);
    completePendingAction(db, "dice-check-types", ability.check.checkId);

    const saveCheck: ActionAssessment = { resolution: "check", category: "saving_throw", ability: "wisdom", skill: null, difficulty: "standard", mode: "normal", stakes: "Resist the effect or suffer a temporary complication.", reason: "Reactive resistance." };
    const save = await assessPlayerAction(db, content, assessingDirector(saveCheck), "dice-check-types", "Resist the effect");
    if (save.automatic) throw new Error("Expected saving throw");
    assert.equal(save.check.modifier, 3);
    assert.equal(save.check.proficiencyApplied, true);
  } finally { db.close(); }
});

test("automatic actions do not create pending checks", async () => {
  const { content, db, campaignId } = await setup("dice-automatic");
  try {
    const assessment: ActionAssessment = { resolution: "automatic", reason: "Ordinary movement has no uncertainty or meaningful risk." };
    const result = await assessPlayerAction(db, content, assessingDirector(assessment), "dice-automatic", "Walk across the empty room");
    assert.deepEqual(result, { automatic: true, reason: assessment.reason });
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM pending_action_checks WHERE campaign_id = ?").get(campaignId).count, 0);
  } finally { db.close(); }
});

test("records success-with-cost and reuses the same die instead of rerolling", async () => {
  const { content, db, campaignId } = await setup("dice-cost");
  try {
    const assessed = await assessPlayerAction(db, content, assessingDirector(stealthCheck()), "dice-cost", "Slip past the watcher");
    if (assessed.automatic) throw new Error("Expected a check");
    const first = rollPendingAction(db, "dice-cost", assessed.check.checkId, () => 7);
    const second = rollPendingAction(db, "dice-cost", assessed.check.checkId, () => 20);
    assert.equal(first.resolution.total, 11);
    assert.equal(first.resolution.outcome, "success_with_cost");
    assert.deepEqual(second.resolution.dice, [7]);
    assert.equal(listRollRecords(db, campaignId).length, 1);
  } finally { db.close(); }
});

test("advantage, disadvantage, and natural results follow the approved d20 rules", async () => {
  for (const [name, assessment, dice, kept, outcome] of [
    ["dice-advantage", stealthCheck("advantage"), [4, 18], 18, "success"],
    ["dice-disadvantage", stealthCheck("disadvantage"), [17, 3], 3, "failure"],
    ["dice-natural-20", stealthCheck(), [20], 20, "critical_success"],
    ["dice-natural-1", stealthCheck(), [1], 1, "critical_failure"]
  ] as const) {
    const { content, db } = await setup(name);
    try {
      const assessed = await assessPlayerAction(db, content, assessingDirector(assessment), name, "Attempt the check");
      if (assessed.automatic) throw new Error("Expected a check");
      let index = 0;
      const rolled = rollPendingAction(db, name, assessed.check.checkId, () => dice[index++]!);
      assert.equal(rolled.resolution.keptDie, kept);
      assert.equal(rolled.resolution.outcome, outcome);
    } finally { db.close(); }
  }
});

test("rejects mismatched skill abilities and prevents a second pending action", async () => {
  const { content, db } = await setup("dice-invalid");
  try {
    const bad = { ...stealthCheck(), ability: "wisdom" } as ActionAssessment;
    await assert.rejects(() => assessPlayerAction(db, content, assessingDirector(bad), "dice-invalid", "Sneak"), /must use dexterity/);
    const first = await assessPlayerAction(db, content, assessingDirector(stealthCheck()), "dice-invalid", "Sneak");
    assert.equal(first.automatic, false);
    await assert.rejects(() => assessPlayerAction(db, content, assessingDirector(stealthCheck()), "dice-invalid", "Try again"), /Resolve the pending/);
    if (!first.automatic) completePendingAction(db, "dice-invalid", first.check.checkId);
  } finally { db.close(); }
});

test("non-browser action paths cannot bypass a required player roll", async () => {
  const { content, db, campaignId } = await setup("dice-no-bypass");
  try {
    await assert.rejects(
      () => submitPlayableAction(db, content, assessingDirector(stealthCheck()), "dice-no-bypass", "Slip past the watcher"),
      /player-clicked roll interface/
    );
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM pending_action_checks WHERE campaign_id = ?").get(campaignId).count, 1);
  } finally { db.close(); }
});
