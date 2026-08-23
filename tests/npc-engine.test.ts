import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadVelmoraContent } from "../src/application/campaign-loader.ts";
import { decideNpcCategory } from "../src/npc/npc-category.ts";
import { buildNpcContext } from "../src/npc/npc-context-gate.ts";
import {
  createCampaign,
  captureSnapshot,
  changeNpcLifecycle,
  getNpcKnowledge,
  getNpc,
  getNpcRelationship,
  getWorldFact,
  listEvents,
  listNpcsByCategory,
  listRelevantNpcMemories,
  openDatabase,
  persistNpc,
  persistWorldFact,
  recordNpcMemory,
  reclassifyNpc,
  restorePreviousTurn,
  insertCheckpoint,
  teachNpcFact,
  updateNpcRelationship
} from "../src/persistence/database.ts";

test("stores and reclassifies an NPC without deleting its identity", async () => {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const dir = mkdtempSync(join(tmpdir(), "velmora-npc-test-"));
  const db = openDatabase(join(dir, "test.sqlite"));
  try {
    const campaignId = createCampaign(db, content, "npc-storage", "fixed-seed");
    persistNpc(db, {
      campaignId,
      npcId: "NPC-DOCK-001",
      name: "Mara Venn",
      category: "background",
      origin: "generated",
      factionId: "FAC-HANDS",
      locationId: "LOC-HANDS",
      role: "dockworker",
      createdTurn: 1
    });

    const promotion = decideNpcCategory("background", { namedOrMeaningfullyEncountered: true });
    reclassifyNpc(db, campaignId, "NPC-DOCK-001", promotion.category, 2, promotion.reason);

    const stored = getNpc(db, campaignId, "NPC-DOCK-001");
    assert.equal(stored?.name, "Mara Venn");
    assert.equal(stored?.category, "known");
    assert.equal(stored?.createdTurn, 1);
    assert.equal(stored?.lastRelevantTurn, 2);
    assert.equal(listNpcsByCategory(db, campaignId, "known").length, 1);
    assert.ok(listEvents(db, campaignId).some((event) => event.eventType === "npc_reclassified"));
  } finally {
    db.close();
  }
});

test("persistent ties prevent demotion while immediate relevance activates an NPC", () => {
  assert.equal(
    decideNpcCategory("known", { extendedInactivity: true, hasPersistentTie: true }).category,
    "known"
  );
  assert.equal(
    decideNpcCategory("known", { presentInCurrentScene: true }).category,
    "active"
  );
  assert.equal(
    decideNpcCategory("known", { extendedInactivity: true }).category,
    "background"
  );
});

test("keeps world truth separate from an NPC's possibly false belief", async () => {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const dir = mkdtempSync(join(tmpdir(), "velmora-knowledge-test-"));
  const db = openDatabase(join(dir, "test.sqlite"));
  try {
    const campaignId = createCampaign(db, content, "npc-knowledge", "fixed-seed");
    persistNpc(db, {
      campaignId,
      npcId: "NPC-WITNESS-001",
      name: "Corin Vale",
      category: "known",
      origin: "authored",
      role: "council witness",
      createdTurn: 0
    });
    persistWorldFact(db, {
      campaignId,
      factId: "FACT-SPEAKER-WOUND",
      statement: "Raw Tear-magic erupted through the First Speaker.",
      truthStatus: "established",
      visibility: "secret",
      establishedTurn: 0
    });

    assert.equal(getNpcKnowledge(db, campaignId, "NPC-WITNESS-001", "FACT-SPEAKER-WOUND"), undefined);
    teachNpcFact(db, {
      campaignId,
      npcId: "NPC-WITNESS-001",
      factId: "FACT-SPEAKER-WOUND",
      method: "told",
      confidence: 70,
      believedState: "false",
      learnedTurn: 2
    });

    assert.equal(getWorldFact(db, campaignId, "FACT-SPEAKER-WOUND")?.truthStatus, "established");
    assert.equal(getNpcKnowledge(db, campaignId, "NPC-WITNESS-001", "FACT-SPEAKER-WOUND")?.believedState, "false");
  } finally {
    db.close();
  }
});

test("meaningful memory persists and promotes a background NPC to known", async () => {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const dir = mkdtempSync(join(tmpdir(), "velmora-memory-test-"));
  const db = openDatabase(join(dir, "test.sqlite"));
  try {
    const campaignId = createCampaign(db, content, "npc-memory", "fixed-seed");
    persistNpc(db, {
      campaignId,
      npcId: "NPC-MERCHANT-001",
      name: "Sera Dain",
      category: "background",
      origin: "generated",
      role: "street merchant",
      createdTurn: 1
    });
    recordNpcMemory(db, {
      campaignId,
      npcId: "NPC-MERCHANT-001",
      memoryId: "MEM-RESCUED",
      summary: "The player pulled Sera away from a Tear-beast.",
      emotionalImpact: "grateful but shaken",
      importance: 3,
      unresolved: false,
      createdTurn: 3
    });

    assert.equal(getNpc(db, campaignId, "NPC-MERCHANT-001")?.category, "known");
    assert.equal(listRelevantNpcMemories(db, campaignId, "NPC-MERCHANT-001")[0]?.memoryId, "MEM-RESCUED");
  } finally {
    db.close();
  }
});

test("merges standing, qualities, and history into a directional relationship", async () => {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const dir = mkdtempSync(join(tmpdir(), "velmora-relationship-test-"));
  const db = openDatabase(join(dir, "test.sqlite"));
  try {
    const campaignId = createCampaign(db, content, "npc-relationships", "fixed-seed");
    for (const [npcId, name] of [["NPC-MARA", "Mara Venn"], ["NPC-CORIN", "Corin Vale"]]) {
      persistNpc(db, {
        campaignId,
        npcId,
        name,
        category: "known",
        origin: "authored",
        role: "citizen",
        createdTurn: 0
      });
    }

    const towardPlayer = updateNpcRelationship(db, {
      campaignId,
      sourceNpcId: "NPC-MARA",
      targetType: "player",
      targetId: "player",
      standing: "friendly",
      addQualities: ["indebted", "wary"],
      reason: "The player rescued Mara, but she suspects they caused the attack.",
      turn: 3
    });
    assert.equal(towardPlayer.standing, "friendly");
    assert.deepEqual(towardPlayer.qualities, ["indebted", "wary"]);

    updateNpcRelationship(db, {
      campaignId,
      sourceNpcId: "NPC-MARA",
      targetType: "npc",
      targetId: "NPC-CORIN",
      standing: "friendly",
      addQualities: ["trusted"],
      reason: "Corin kept Mara's confidence.",
      turn: 4
    });
    assert.equal(getNpcRelationship(db, campaignId, "NPC-CORIN", "npc", "NPC-MARA"), undefined);
    assert.equal(getNpcRelationship(db, campaignId, "NPC-MARA", "npc", "NPC-CORIN")?.standing, "friendly");

    const historyCount = db.prepare("SELECT COUNT(*) AS count FROM npc_relationship_history WHERE campaign_id = ?")
      .get(campaignId) as { count: number };
    assert.equal(historyCount.count, 2);
  } finally {
    db.close();
  }
});

test("adapts NPC context detail to relevance and a configurable budget", async () => {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const dir = mkdtempSync(join(tmpdir(), "velmora-context-test-"));
  const db = openDatabase(join(dir, "test.sqlite"));
  try {
    const campaignId = createCampaign(db, content, "npc-context", "fixed-seed");
    for (let index = 1; index <= 11; index += 1) {
      persistNpc(db, {
        campaignId,
        npcId: `NPC-CONTEXT-${index}`,
        name: `Citizen ${index}`,
        category: index <= 3 ? "active" : "known",
        origin: "generated",
        locationId: "LOC-COUNCIL-CROWN",
        role: index <= 3 ? "speaker" : "observer",
        createdTurn: index
      });
    }

    persistWorldFact(db, {
      campaignId,
      factId: "FACT-PRIVATE-TEST",
      statement: "A private fact known only to one NPC.",
      truthStatus: "established",
      visibility: "secret",
      establishedTurn: 0
    });
    teachNpcFact(db, {
      campaignId,
      npcId: "NPC-CONTEXT-1",
      factId: "FACT-PRIVATE-TEST",
      method: "witnessed",
      confidence: 100,
      believedState: "true",
      learnedTurn: 2
    });

    const context = buildNpcContext(db, {
      campaignId,
      locationId: "LOC-COUNCIL-CROWN",
      focusNpcIds: ["NPC-CONTEXT-1"],
      detailBudget: 20
    });
    assert.equal(context.full.length, 3);
    assert.equal(context.supporting.length, 8);
    assert.equal(context.omittedCount, 0);
    assert.equal(context.full[0]?.npc.npcId, "NPC-CONTEXT-1");
    assert.equal(context.full[0]?.knowledge[0]?.factId, "FACT-PRIVATE-TEST");
    assert.ok(context.full.slice(1).every((entry) => entry.knowledge.length === 0));

    const tighterContext = buildNpcContext(db, {
      campaignId,
      locationId: "LOC-COUNCIL-CROWN",
      focusNpcIds: ["NPC-CONTEXT-1"],
      detailBudget: 8
    });
    assert.equal(tighterContext.full.length, 2);
    assert.equal(tighterContext.supporting.length, 0);
    assert.equal(tighterContext.omittedCount, 9);
  } finally {
    db.close();
  }
});

test("archives death, blocks unapproved resurrection, and restores lifecycle through rollback", async () => {
  const content = await loadVelmoraContent(resolve(import.meta.dirname, ".."));
  const dir = mkdtempSync(join(tmpdir(), "velmora-lifecycle-test-"));
  const db = openDatabase(join(dir, "test.sqlite"));
  try {
    const campaignId = createCampaign(db, content, "npc-lifecycle", "fixed-seed");
    persistNpc(db, {
      campaignId,
      npcId: "NPC-LIFECYCLE-001",
      name: "Veyra Ashen",
      category: "active",
      origin: "authored",
      locationId: "LOC-DIST-HANDS",
      role: "peacekeeper",
      createdTurn: 0
    });
    const before = captureSnapshot(db, campaignId);
    insertCheckpoint(db, campaignId, 0, 1, "pre_turn", before);
    db.prepare("UPDATE campaigns SET turn = 1 WHERE id = ?").run(campaignId);

    const dead = changeNpcLifecycle(db, {
      campaignId,
      npcId: "NPC-LIFECYCLE-001",
      status: "dead",
      reason: "Killed during a committed Tear-beast attack.",
      turn: 1
    });
    assert.equal(dead.lifecycleState, "archived");
    assert.equal(dead.category, "background");
    assert.equal(dead.locationId, null);
    await assert.rejects(async () => changeNpcLifecycle(db, {
      campaignId,
      npcId: "NPC-LIFECYCLE-001",
      status: "available",
      reason: "Unapproved return",
      turn: 1
    }), /explicitly approved resurrection rule/);

    restorePreviousTurn(db, "npc-lifecycle");
    const restored = getNpc(db, campaignId, "NPC-LIFECYCLE-001");
    assert.equal(restored?.status, "available");
    assert.equal(restored?.lifecycleState, "current");
    assert.equal(restored?.category, "active");
    assert.equal(restored?.locationId, "LOC-DIST-HANDS");
  } finally {
    db.close();
  }
});
