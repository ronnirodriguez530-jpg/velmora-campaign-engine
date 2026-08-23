import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { evaluateNpcDesign } from "../src/npc/npc-design-evaluator.ts";
import { loadNpcReferenceLibrary, retrieveNpcDesignLessons } from "../src/npc/npc-reference-library.ts";

test("loads only approved, attributed NPC teaching sources", async () => {
  const library = await loadNpcReferenceLibrary(resolve(import.meta.dirname, ".."));
  assert.ok(library.sources.length >= 5);
  assert.ok(library.lessons.length >= 8);
  assert.ok(library.sources.every((source) => source.use === "distilled_principles" || source.use === "rules_reference"));
  assert.ok(library.sources.filter((source) => source.license === "CC-BY-4.0").every((source) => Boolean(source.attribution)));
});

test("retrieves relevant teaching principles instead of complete source text", async () => {
  const library = await loadNpcReferenceLibrary(resolve(import.meta.dirname, ".."));
  const lessons = retrieveNpcDesignLessons(library, ["knowledge", "dialogue"], 3);
  assert.ok(lessons.length > 0);
  assert.ok(lessons.some((lesson) => lesson.id === "LESSON-POINT-OF-VIEW"));
  assert.ok(lessons.every((lesson) => !("sourceText" in lesson)));
});

test("rejects copied identity elements and highly repetitive NPC concepts", () => {
  const existing = [{
    name: "Mara Venn",
    role: "dock worker",
    desire: "protect her family from the next surge",
    complication: "owes a dangerous faction a favor"
  }];
  const copied = evaluateNpcDesign({
    name: "Mara Venn",
    role: "dock worker",
    desire: "protect her family from the next surge",
    complication: "owes a dangerous faction a favor",
    changeLever: "the player can settle the debt",
    voiceCues: ["speaks cautiously around faction officials"],
    sourceSpecificReferences: ["copied character identity"]
  }, existing);
  assert.equal(copied.accepted, false);
  assert.ok(copied.problems.length >= 2);

  const original = evaluateNpcDesign({
    name: "Orin Sable",
    role: "glass conservator",
    desire: "restore a window that records a missing district",
    complication: "the images change whenever he sleeps",
    changeLever: "the player can reveal where the glass originated",
    voiceCues: ["describes danger through flaws in glass"]
  }, existing);
  assert.equal(original.accepted, true);
});
