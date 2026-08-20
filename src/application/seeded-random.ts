import { createHash } from "node:crypto";

export function seededInteger(seed: string, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) throw new Error("Invalid seeded integer range");
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 12);
  const value = Number.parseInt(hex, 16);
  return min + (value % (max - min + 1));
}

export function seededChoice<T>(seed: string, values: readonly T[]): T {
  if (values.length === 0) throw new Error("Cannot select from an empty list");
  return values[seededInteger(seed, 0, values.length - 1)]!;
}
