import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { generateNpcOnDemand } from "../src/npc/npc-generator.ts";
import { loadNpcReferenceLibrary } from "../src/npc/npc-reference-library.ts";
import {
  captureSnapshot,
  changeNpcLifecycle,
  createCampaign,
  getNpc,
  getNpcKnowledge,
  getNpcRelationship,
  insertCheckpoint,
  listEvents,
  listNpcDesignProfiles,
  listRelevantNpcMemories,
  openDatabase,
  persistWorldFact,
  recordNpcMemory,
  restorePreviousTurn,
  teachNpcFact,
  updateNpcRelationship
} from "../src/persistence/database.ts";

test("generates minor NPCs only on demand and preserves novelty history", async () => {
  const root = resolve(import.meta.dirname, "..");
  const content = await loadVelmoraContent(root);
  const library = await loadNpcReferenceLibrary(root);
  const dir = mkdtempSync(join(tmpdir(), "velmora-generator-test-"));
  const db = openDatabase(join(dir, "test.sqlite"));
  try {
    const campaignId = createCampaign(db, content, "npc-generator", "fixed-seed");
    assert.equal(listNpcDesignProfiles(db, campaignId).length, 0);

    const request = {
      campaignId,
      campaignSeed: "fixed-seed",
      reason: "The player asks who repairs the avenue lamps.",
      role: "lamp repairer",
      factionId: "FAC-005",
      locationId: "LOC-DIST-HANDS",
      category: "known" as const,
      turn: 2
    };
    const first = await generateNpcOnDemand(db, root, content, library, request);
    const second = await generateNpcOnDemand(db, root, content, library, request);

    assert.notEqual(first.npcId, second.npcId);
    assert.notEqual(first.name, second.name);
    assert.equal(first.factionId, "FAC-005");
    const profiles = listNpcDesignProfiles(db, campaignId);
    assert.equal(profiles.length, 2);
    assert.notEqual(profiles[0]?.fingerprint, profiles[1]?.fingerprint);
    assert.ok(profiles.every((profile) => profile.appliedLessonIds.length > 0));
    assert.equal(listEvents(db, campaignId).filter((event) => event.eventType === "npc_generated").length, 2);
  } finally {
    db.close();
  }
});

test("rejects generation outside approved faction and location canon", async () => {
  const root = resolve(import.meta.dirname, "..");
  const content = await loadVelmoraContent(root);
  const library = await loadNpcReferenceLibrary(root);
  const dir = mkdtempSync(join(tmpdir(), "velmora-generator-canon-test-"));
  const db = openDatabase(join(dir, "test.sqlite"));
  try {
    const campaignId = createCampaign(db, content, "npc-generator-canon", "fixed-seed");
    await assert.rejects(() => generateNpcOnDemand(db, root, content, library, {
      campaignId,
      campaignSeed: "fixed-seed",
      reason: "test invalid canon",
      role: "visitor",
      factionId: "FAC-NOT-REAL",
      locationId: "LOC-NOT-REAL",
      category: "background",
      turn: 1
    }), /Unknown NPC location/);
    assert.equal(listNpcDesignProfiles(db, campaignId).length, 0);
  } finally {
    db.close();
  }
});

test("rollback restores the complete NPC state and removes uncommitted generated identity", async () => {
  const root = resolve(import.meta.dirname, "..");
  const content = await loadVelmoraContent(root);
  const library = await loadNpcReferenceLibrary(root);
  const dir = mkdtempSync(join(tmpdir(), "velmora-npc-rollback-test-"));
  const db = openDatabase(join(dir, "test.sqlite"));
  try {
    const campaignId = createCampaign(db, content, "npc-complete-rollback", "fixed-seed");
    const first = await generateNpcOnDemand(db, root, content, library, {
      campaignId,
      campaignSeed: "fixed-seed",
      reason: "A resident maintains a damaged ward marker.",
      role: "ward marker keeper",
      factionId: "FAC-005",
      locationId: "LOC-DIST-HANDS",
      category: "known",
      turn: 0
    });
    persistWorldFact(db, {
      campaignId,
      factId: "FACT-WARD-TEST",
      statement: "The ward marker failed before the attack.",
      truthStatus: "established",
      visibility: "restricted",
      establishedTurn: 0
    });
    teachNpcFact(db, {
      campaignId,
      npcId: first.npcId,
      factId: "FACT-WARD-TEST",
      method: "witnessed",
      confidence: 90,
      believedState: "true",
      learnedTurn: 0
    });
    recordNpcMemory(db, {
      campaignId,
      npcId: first.npcId,
      memoryId: "MEM-BEFORE-ROLLBACK",
      summary: "The player helped stabilize the marker.",
      emotionalImpact: "relieved",
      importance: 2,
      unresolved: false,
      createdTurn: 0
    });
    updateNpcRelationship(db, {
      campaignId,
      sourceNpcId: first.npcId,
      targetType: "player",
      targetId: "player",
      standing: "friendly",
      addQualities: ["trusted"],
      reason: "The player helped stabilize the marker.",
      turn: 0
    });

    insertCheckpoint(db, campaignId, 0, 1, "pre_turn", captureSnapshot(db, campaignId));
    db.prepare("UPDATE campaigns SET turn = 1 WHERE id = ?").run(campaignId);
    const second = await generateNpcOnDemand(db, root, content, library, {
      campaignId,
      campaignSeed: "fixed-seed",
      reason: "A second resident arrives after the marker breaks.",
      role: "courier",
      factionId: null,
      locationId: "LOC-DIST-HANDS",
      category: "background",
      turn: 1
    });
    changeNpcLifecycle(db, {
      campaignId,
      npcId: first.npcId,
      status: "injured",
      reason: "Hit by debris.",
      turn: 1
    });
    teachNpcFact(db, {
      campaignId,
      npcId: first.npcId,
      factId: "FACT-WARD-TEST",
      method: "inferred",
      confidence: 30,
      believedState: "false",
      learnedTurn: 1
    });
    updateNpcRelationship(db, {
      campaignId,
      sourceNpcId: first.npcId,
      targetType: "player",
      targetId: "player",
      standing: "hostile",
      addQualities: ["wary"],
      removeQualities: ["trusted"],
      reason: "The resident blames the player for the new damage.",
      turn: 1
    });

    restorePreviousTurn(db, "npc-complete-rollback");
    assert.equal(getNpc(db, campaignId, second.npcId), undefined);
    assert.equal(listNpcDesignProfiles(db, campaignId).length, 1);
    assert.equal(getNpc(db, campaignId, first.npcId)?.status, "available");
    assert.equal(getNpcKnowledge(db, campaignId, first.npcId, "FACT-WARD-TEST")?.believedState, "true");
    assert.equal(listRelevantNpcMemories(db, campaignId, first.npcId).length, 1);
    assert.equal(getNpcRelationship(db, campaignId, first.npcId, "player", "player")?.standing, "friendly");
    assert.deepEqual(getNpcRelationship(db, campaignId, first.npcId, "player", "player")?.qualities, ["trusted"]);
    const noveltyCount = db.prepare("SELECT COUNT(*) AS count FROM npc_novelty_ledger WHERE campaign_id = ?")
      .get(campaignId) as { count: number };
    assert.equal(noveltyCount.count, 1);
  } finally {
    db.close();
  }
});
