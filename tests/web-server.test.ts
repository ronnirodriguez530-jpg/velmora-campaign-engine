import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildJournalEvents } from "../src/application/journal-builder.ts";
import { createVelmoraWebServer } from "../src/web/server.ts";

test("journal keeps only the latest five meaningful player-known events", () => {
  const quest = { questId: "QUEST-KNOWN", title: "Hold the Crown", resolutionSummary: null, failureReason: null, objectives: [{ objectiveId: "OBJ-ONE", summary: "Reach the sealed gate" }] };
  const events = [
    { turn: 1, eventType: "quest_created", payloadJson: JSON.stringify({ questId: quest.questId }) },
    ...Array.from({ length: 6 }, (_, index) => ({ turn: index + 1, eventType: "quest_warning_recorded", payloadJson: JSON.stringify({ questId: quest.questId, signal: `warning ${index + 1}` }) })),
    { turn: 7, eventType: "quest_warning_recorded", payloadJson: JSON.stringify({ questId: "QUEST-HIDDEN", signal: "hidden warning" }) }
  ];
  const journal = buildJournalEvents(events, [quest]);
  assert.equal(journal.length, 5);
  assert.match(journal[0]!.summary, /warning 2/);
  assert.match(journal[4]!.summary, /warning 6/);
  assert.equal(journal.some((entry) => /hidden/.test(entry.summary)), false);
});

test("browser API creates, plays, persists, acts, and rolls back", async () => {
  const server = await createVelmoraWebServer({ dataDir: mkdtempSync(join(tmpdir(), "velmora-web-test-")) });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a port");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const page = await fetch(base);
    assert.equal(page.status, 200);
    const pageHtml = await page.text();
    assert.match(pageHtml, /<title>Velmora<\/title>/);
    assert.match(pageHtml, /id="quest-list"/);
    assert.match(pageHtml, /id="main-quest-list"/);
    assert.match(pageHtml, /id="journal-event-list"/);
    assert.match(pageHtml, /id="direction-overlay"/);
    assert.match(pageHtml, /id="accept-direction"/);
    assert.match(pageHtml, /id="reject-direction"/);
    assert.match(pageHtml, /href="\/quests\.css"/);
    assert.match(page.headers.get("cache-control") ?? "", /no-store/);

    const created = await fetch(`${base}/api/campaigns`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "browser-proof" })
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json() as {
      quests: Array<{ sourceThreadId: string; state: string }>;
      actionable: { quests: number };
      journal: { mainQuests: unknown[]; otherQuests: unknown[]; recentEvents: unknown[] };
      context: { playerQuests: Array<{ questId: string }> };
    };
    assert.equal(createdBody.quests.length, 0);
    assert.equal(createdBody.actionable.quests, 0);
    assert.deepEqual(createdBody.journal, { mainQuests: [], otherQuests: [], recentEvents: [] });
    assert.equal(createdBody.context.playerQuests.length, 0);

    const blockedAction = await fetch(`${base}/api/campaigns/browser-proof/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: "support league", director: "local" })
    });
    assert.equal(blockedAction.status, 400);
    assert.match(String((await blockedAction.json() as { error: string }).error), /Create your player character/);

    const characterCreated = await fetch(`${base}/api/campaigns/browser-proof/character`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Mara Vale",
        identityNotes: "A patient observer from the guarded avenues.",
        abilityScores: { strength: 10, dexterity: 15, constitution: 14, intelligence: 13, wisdom: 12, charisma: 8 },
        skillProficiencies: ["acrobatics", "investigation", "perception", "stealth"],
        saveProficiencies: ["dexterity", "wisdom"]
      })
    });
    assert.equal(characterCreated.status, 201);
    const characterBody = await characterCreated.json() as { playerCharacter: { name: string; maxHp: number; defense: number } };
    assert.equal(characterBody.playerCharacter.name, "Mara Vale");
    assert.equal(characterBody.playerCharacter.maxHp, 14);
    assert.equal(characterBody.playerCharacter.defense, 12);

    const beforeRoll = await fetch(`${base}/api/campaigns/browser-proof/play?director=local`);
    const beforeRollBody = await beforeRoll.json() as { moment: null; context: { opening: { phase: string } } };
    assert.equal(beforeRollBody.moment, null);
    assert.equal(beforeRollBody.context.opening.phase, "awaiting_roll");

    const openingRoll = await fetch(`${base}/api/campaigns/browser-proof/opening-roll`, { method: "POST" });
    const openingBody = await openingRoll.json() as { opening: { phase: string; spawnRoll: number; spawn: { spawnArea: string } }; context: unknown };
    assert.equal(openingBody.opening.phase, "exploration");
    assert.ok(openingBody.opening.spawnRoll >= 1 && openingBody.opening.spawnRoll <= 6);
    assert.ok(openingBody.opening.spawn.spawnArea.length > 0);
    assert.equal(JSON.stringify(openingBody).includes("convergenceHook"), false);
    assert.equal(JSON.stringify(openingBody).includes("convergenceRoll"), false);

    const played = await fetch(`${base}/api/campaigns/browser-proof/play?director=local`);
    const playBody = await played.json() as { moment: { scene: { locationId: string }; presentation: { source: string } } };
    assert.equal(playBody.moment.scene.locationId, "LOC-COUNCIL-CROWN");
    assert.equal(playBody.moment.presentation.source, "diagnostic");

    const checkRequested = await fetch(`${base}/api/campaigns/browser-proof/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: "attempt a diagnostic check", director: "local" })
    });
    const checkBody = await checkRequested.json() as { pendingCheck: { checkId: string; modifier: number }; result?: unknown };
    assert.equal(checkBody.pendingCheck.modifier, 4);
    assert.equal(checkBody.result, undefined);
    const rolled = await fetch(`${base}/api/campaigns/browser-proof/rolls`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkId: checkBody.pendingCheck.checkId, director: "local" })
    });
    const rolledBody = await rolled.json() as { roll: { keptDie: number; outcome: string }; campaign: { turn: number } };
    assert.ok(rolledBody.roll.keptDie >= 1 && rolledBody.roll.keptDie <= 20);
    assert.match(rolledBody.roll.outcome, /success|failure/);
    assert.equal(rolledBody.campaign.turn, 0);

    const acted = await fetch(`${base}/api/campaigns/browser-proof/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: "support league", director: "local" })
    });
    const actionBody = await acted.json() as { campaign: { turn: number } };
    assert.equal(actionBody.campaign.turn, 1);

    const reopened = await fetch(`${base}/api/campaigns/browser-proof`);
    const reopenedBody = await reopened.json() as { campaign: { turn: number }; playerCharacter: { name: string } };
    assert.equal(reopenedBody.campaign.turn, 1);
    assert.equal(reopenedBody.playerCharacter.name, "Mara Vale");

    const rollback = await fetch(`${base}/api/campaigns/browser-proof/rollback?director=local`, { method: "POST" });
    const rollbackBody = await rollback.json() as { campaign: { turn: number }; playerCharacter: { name: string } };
    assert.equal(rollbackBody.campaign.turn, 0);
    assert.equal(rollbackBody.playerCharacter.name, "Mara Vale");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
