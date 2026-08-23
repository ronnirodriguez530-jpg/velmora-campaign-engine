import type { DatabaseSync } from "node:sqlite";
import type {
  FullNpcContext,
  NpcContextPackage,
  NpcRecord,
  SupportingNpcContext
} from "../domain/types.ts";
import {
  getNpc,
  getNpcDesignProfile,
  getNpcRelationship,
  listNpcKnowledgeForContext,
  listNpcRelationships,
  listNpcsAtLocation,
  listRelevantNpcMemories
} from "../persistence/database.ts";

export type NpcContextRequest = {
  campaignId: string;
  locationId: string;
  focusNpcIds?: string[];
  linkedNpcIds?: string[];
  detailBudget?: number;
};

const FULL_DETAIL_COST = 4;
const SUPPORTING_DETAIL_COST = 1;
const DEFAULT_DETAIL_BUDGET = 36;

function categoryScore(npc: NpcRecord): number {
  if (npc.category === "active") return 300;
  if (npc.category === "known") return 200;
  return 100;
}

export function buildNpcContext(db: DatabaseSync, request: NpcContextRequest): NpcContextPackage {
  const budgetLimit = request.detailBudget ?? DEFAULT_DETAIL_BUDGET;
  if (!Number.isInteger(budgetLimit) || budgetLimit < FULL_DETAIL_COST) {
    throw new Error(`NPC context detail budget must be an integer of at least ${FULL_DETAIL_COST}`);
  }

  const focusIds = new Set(request.focusNpcIds ?? []);
  const linkedIds = new Set(request.linkedNpcIds ?? []);
  const candidates = new Map<string, NpcRecord>();
  for (const npc of listNpcsAtLocation(db, request.campaignId, request.locationId)) {
    candidates.set(npc.npcId, npc);
  }
  for (const npcId of [...focusIds, ...linkedIds]) {
    const npc = getNpc(db, request.campaignId, npcId);
    if (npc && npc.status !== "unavailable") candidates.set(npc.npcId, npc);
  }

  const ranked = [...candidates.values()].sort((left, right) => {
    const leftScore =
      (focusIds.has(left.npcId) ? 10_000 : 0) +
      (linkedIds.has(left.npcId) ? 2_000 : 0) +
      categoryScore(left) +
      (left.locationId === request.locationId ? 50 : 0) +
      left.lastRelevantTurn;
    const rightScore =
      (focusIds.has(right.npcId) ? 10_000 : 0) +
      (linkedIds.has(right.npcId) ? 2_000 : 0) +
      categoryScore(right) +
      (right.locationId === request.locationId ? 50 : 0) +
      right.lastRelevantTurn;
    return rightScore - leftScore || left.npcId.localeCompare(right.npcId);
  });

  const full: FullNpcContext[] = [];
  const supporting: SupportingNpcContext[] = [];
  let budgetUsed = 0;
  let omittedCount = 0;

  const baseSupportingCost = Math.min(ranked.length * SUPPORTING_DETAIL_COST, budgetLimit);
  const expandedByAvailableBudget = Math.floor(
    Math.max(0, budgetLimit - baseSupportingCost) / (FULL_DETAIL_COST - SUPPORTING_DETAIL_COST)
  );
  const priorityFullCount = ranked.filter((npc) => focusIds.has(npc.npcId) || npc.category === "active").length;
  const fullTarget = Math.min(
    ranked.length,
    Math.floor(budgetLimit / FULL_DETAIL_COST),
    Math.max(priorityFullCount, expandedByAvailableBudget)
  );

  for (const [index, npc] of ranked.entries()) {
    const wantsFull = index < fullTarget;
    if (wantsFull && budgetUsed + FULL_DETAIL_COST <= budgetLimit) {
      full.push({
        detail: "full",
        npc,
        design: getNpcDesignProfile(db, request.campaignId, npc.npcId) ?? null,
        knowledge: listNpcKnowledgeForContext(db, request.campaignId, npc.npcId),
        memories: listRelevantNpcMemories(db, request.campaignId, npc.npcId),
        relationships: listNpcRelationships(db, request.campaignId, npc.npcId)
      });
      budgetUsed += FULL_DETAIL_COST;
      continue;
    }
    if (budgetUsed + SUPPORTING_DETAIL_COST <= budgetLimit) {
      supporting.push({
        detail: "supporting",
        npc,
        playerRelationship: getNpcRelationship(db, request.campaignId, npc.npcId, "player", "player") ?? null
      });
      budgetUsed += SUPPORTING_DETAIL_COST;
      continue;
    }
    omittedCount += 1;
  }

  return { full, supporting, omittedCount, budgetUsed, budgetLimit };
}
