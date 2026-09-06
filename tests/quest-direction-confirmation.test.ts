import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { beginPlayableAction, respondToQuestDirectionConfirmation } from "../src/application/gameplay-session.ts";
import { generateQuestFromThread } from "../src/application/quest-generator.ts";
import { getPendingQuestDirectionConfirmation } from "../src/application/quest-direction-confirmation.ts";
import { createPlayerCharacter } from "../src/application/player-character.ts";
import { MockDirector } from "../src/director/mock-director.ts";
import { createCampaign, listQuestInstances, openDatabase } from "../src/persistence/database.ts";

async function setup(name: string) {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const db = openDatabase(join(mkdtempSync(join(tmpdir(), "velmora-direction-confirmation-")), "test.sqlite"));
  const campaignId = createCampaign(db, content, name, `${name}-seed`);
  createPlayerCharacter(db, campaignId, {
    name: "Mara Vale",
    identityNotes: "A patient observer.",
    abilityScores: { strength: 10, dexterity: 15, constitution: 14, intelligence: 13, wisdom: 12, charisma: 8 },
    skillProficiencies: ["acrobatics", "investigation", "perception", "stealth"],
    saveProficiencies: ["dexterity", "wisdom"]
  });
  const quest = generateQuestFromThread(db, content, campaignId, "THREAD-OPENING-PRESSURE");
  return { content, db, campaignId, quest };
}

test("a natural quest action pauses for a refresh-safe direction confirmation", async () => {
  const { content, db, campaignId, quest } = await setup("direction-pending");
  try {
    const direction = quest.possibleDirections[0]!;
    const action = `I commit to ${direction.summary}`;
    const begun = await beginPlayableAction(db, content, new MockDirector(), "direction-pending", action);
    assert.equal(begun.status, "direction_confirmation_required");
    if (begun.status !== "direction_confirmation_required") return;
    assert.equal(begun.pendingDirectionConfirmation.questId, quest.questId);
    assert.equal(begun.pendingDirectionConfirmation.directionId, direction.directionId);
    assert.equal(begun.pendingDirectionConfirmation.playerInput, action);
    assert.deepEqual(getPendingQuestDirectionConfirmation(db, campaignId), begun.pendingDirectionConfirmation);
    const repeated = await beginPlayableAction(db, content, new MockDirector(), "direction-pending", "Try something else");
    assert.equal(repeated.status, "direction_confirmation_required");
    assert.equal(listQuestInstances(db, campaignId)[0]?.selectedDirectionId, null);
  } finally { db.close(); }
});

test("rejecting an interpretation preserves the uncommitted quest", async () => {
  const { content, db, campaignId, quest } = await setup("direction-reject");
  try {
    const direction = quest.possibleDirections[0]!;
    const begun = await beginPlayableAction(db, content, new MockDirector(), "direction-reject", `I commit to ${direction.summary}`);
    assert.equal(begun.status, "direction_confirmation_required");
    if (begun.status !== "direction_confirmation_required") return;
    const rejected = await respondToQuestDirectionConfirmation(db, content, new MockDirector(), "direction-reject", begun.pendingDirectionConfirmation.confirmationId, false);
    assert.equal(rejected.status, "direction_rejected");
    assert.equal(getPendingQuestDirectionConfirmation(db, campaignId), null);
    const stored = listQuestInstances(db, campaignId)[0]!;
    assert.equal(stored.state, "available");
    assert.equal(stored.selectedDirectionId, null);
  } finally { db.close(); }
});

test("accepting an interpretation commits the route then resumes the original action", async () => {
  const { content, db, campaignId, quest } = await setup("direction-accept");
  try {
    const direction = quest.possibleDirections[0]!;
    const action = `I commit to ${direction.summary}`;
    const begun = await beginPlayableAction(db, content, new MockDirector(), "direction-accept", action);
    assert.equal(begun.status, "direction_confirmation_required");
    if (begun.status !== "direction_confirmation_required") return;
    const accepted = await respondToQuestDirectionConfirmation(db, content, new MockDirector(), "direction-accept", begun.pendingDirectionConfirmation.confirmationId, true);
    assert.equal(accepted.status, "resolved");
    if (accepted.status !== "resolved") return;
    assert.equal(accepted.result.advanced, true);
    assert.equal(getPendingQuestDirectionConfirmation(db, campaignId), null);
    const stored = listQuestInstances(db, campaignId)[0]!;
    assert.equal(stored.state, "active");
    assert.equal(stored.selectedDirectionId, direction.directionId);
    assert.equal(stored.objectives[0]?.state, "active");
  } finally { db.close(); }
});
