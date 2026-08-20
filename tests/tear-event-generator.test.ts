import test from "node:test";
import assert from "node:assert/strict";
import { generateTearArrival } from "../src/application/tear-event-generator.ts";

test("provisional Tear generator is deterministic and bounded", () => {
  const first = Array.from({ length: 200 }, (_, index) => generateTearArrival("tear-proof-seed", index + 1));
  const second = Array.from({ length: 200 }, (_, index) => generateTearArrival("tear-proof-seed", index + 1));
  assert.deepEqual(first, second);
  const arrivals = first.filter((arrival) => arrival !== null);
  assert.ok(arrivals.length > 10 && arrivals.length < 50);
  assert.ok(arrivals.every((arrival) => arrival.payloads.length >= 1 && arrival.payloads.length <= 3));
  assert.ok(arrivals.every((arrival) => arrival.rarity >= 1 && arrival.rarity <= 3));
});
