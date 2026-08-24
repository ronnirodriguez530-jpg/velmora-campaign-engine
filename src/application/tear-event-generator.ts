import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { TearArrival } from "../domain/types.ts";
import { persistTearArrival } from "../persistence/database.ts";

const payloadCatalog: TearArrival["payloads"] = ["creature", "raw_magic", "world_fragment"];

function roll(seed: string, modulus: number): number {
  return createHash("sha256").update(seed).digest().readUInt32BE(0) % modulus;
}

// Mechanical scaffolding for arrivals and void-rift events caused by Velmora's single central Tear.
// A void-rift is a temporary wormhole, not a second true Tear or a general exploration route.
// Frequency and weights remain provisional configuration.
export function generateTearArrival(seed: string, turn: number): TearArrival | null {
  if (roll(`${seed}|tear|${turn}|occurrence`, 100) >= 15) return null;
  const rarityRoll = roll(`${seed}|tear|${turn}|rarity`, 100);
  const rarity: 1 | 2 | 3 = rarityRoll < 70 ? 1 : rarityRoll < 93 ? 2 : 3;
  const payloadCount = 1 + roll(`${seed}|tear|${turn}|count`, 3);
  const offset = roll(`${seed}|tear|${turn}|payload`, payloadCatalog.length);
  const payloads = Array.from({ length: payloadCount }, (_, index) => payloadCatalog[(offset + index) % payloadCatalog.length]);
  const suffix = createHash("sha256").update(`${seed}|tear|${turn}`).digest("hex").slice(0, 12).toUpperCase();
  return { id: `TEAR-${suffix}`, turn, rarity, payloads };
}

export function maybePersistTearArrival(db: DatabaseSync, campaignId: string, seed: string, turn: number): TearArrival | null {
  const arrival = generateTearArrival(seed, turn);
  if (arrival) persistTearArrival(db, campaignId, arrival);
  return arrival;
}
