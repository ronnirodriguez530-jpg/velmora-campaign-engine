import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { readLocalManifest } from "../src/application/update-manager.ts";

test("local updater manifest is valid and versioned", async () => {
  const manifest = await readLocalManifest(resolve(import.meta.dirname, ".."));
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/u);
  assert.equal(manifest.channel, "main");
  assert.ok(manifest.notes.length > 10);
});
