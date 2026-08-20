import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVelmoraWebServer } from "../src/web/server.ts";

test("browser API creates, plays, persists, acts, and rolls back", async () => {
  const server = await createVelmoraWebServer({ dataDir: mkdtempSync(join(tmpdir(), "velmora-web-test-")) });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a port");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>Velmora<\/title>/);

    const created = await fetch(`${base}/api/campaigns`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "browser-proof" })
    });
    assert.equal(created.status, 201);

    const played = await fetch(`${base}/api/campaigns/browser-proof/play?director=local`);
    const playBody = await played.json() as { moment: { scene: { locationId: string }; presentation: { source: string } } };
    assert.equal(playBody.moment.scene.locationId, "LOC-COUNCIL-CROWN");
    assert.equal(playBody.moment.presentation.source, "diagnostic");

    const acted = await fetch(`${base}/api/campaigns/browser-proof/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: "support league", director: "local" })
    });
    const actionBody = await acted.json() as { campaign: { turn: number } };
    assert.equal(actionBody.campaign.turn, 1);

    const reopened = await fetch(`${base}/api/campaigns/browser-proof`);
    const reopenedBody = await reopened.json() as { campaign: { turn: number } };
    assert.equal(reopenedBody.campaign.turn, 1);

    const rollback = await fetch(`${base}/api/campaigns/browser-proof/rollback?director=local`, { method: "POST" });
    const rollbackBody = await rollback.json() as { campaign: { turn: number } };
    assert.equal(rollbackBody.campaign.turn, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
