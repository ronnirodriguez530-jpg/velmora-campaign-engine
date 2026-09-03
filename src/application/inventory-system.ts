import type { DatabaseSync } from "node:sqlite";
import type { ItemAcquisitionSource, ItemDefinition, PlayerInventoryItem, VelmoraContent } from "../domain/types.ts";
import { appendEvent, getPlayerCharacter, listPlayerInventory, persistPlayerCharacter, persistPlayerInventoryItem } from "../persistence/database.ts";

function campaignTurn(db: DatabaseSync, campaignId: string): number {
  const campaign = db.prepare("SELECT turn FROM campaigns WHERE id = ?").get(campaignId) as { turn: number } | undefined;
  if (!campaign) throw new Error(`Missing campaign state ${campaignId}`);
  return campaign.turn;
}

function findItem(content: VelmoraContent, itemId: string): ItemDefinition {
  const item = content.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error(`Unknown item ${itemId}`);
  return item;
}

function updateEquippedDefense(db: DatabaseSync, content: VelmoraContent, campaignId: string, turn: number): void {
  const character = getPlayerCharacter(db, campaignId);
  if (!character) throw new Error("Create the player character before managing inventory");
  const armorBonus = listPlayerInventory(db, campaignId)
    .filter((item) => item.equippedSlot !== null)
    .reduce((total, item) => total + findItem(content, item.itemId).defenseBonus, 0);
  if (armorBonus > 4) throw new Error("Equipped defense bonus cannot exceed four");
  persistPlayerCharacter(db, {
    ...character,
    armorBonus,
    defense: 10 + character.abilityModifiers.dexterity + armorBonus,
    updatedTurn: turn
  });
}

export function listOwnedInventory(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string
): Array<PlayerInventoryItem & { definition: ItemDefinition }> {
  return listPlayerInventory(db, campaignId).map((item) => ({
    ...item,
    definition: findItem(content, item.itemId)
  }));
}

export function addPlayerItem(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  input: { itemId: string; quantity?: number; source: ItemAcquisitionSource }
): PlayerInventoryItem {
  if (!getPlayerCharacter(db, campaignId)) throw new Error("Create the player character before adding inventory");
  const definition = findItem(content, input.itemId);
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Item quantity must be a positive integer");
  const existing = listPlayerInventory(db, campaignId).find((item) => item.itemId === input.itemId);
  if (existing && !definition.stackable) throw new Error(`${definition.name} is already owned and cannot stack`);
  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  if (nextQuantity > definition.maxStack) throw new Error(`${definition.name} cannot exceed a stack of ${definition.maxStack}`);
  const turn = campaignTurn(db, campaignId);
  const item: PlayerInventoryItem = existing
    ? { ...existing, quantity: nextQuantity, updatedTurn: turn }
    : {
        campaignId,
        itemId: definition.id,
        quantity,
        equippedSlot: null,
        acquisitionSource: input.source,
        acquiredTurn: turn,
        updatedTurn: turn
      };

  db.exec("BEGIN IMMEDIATE");
  try {
    persistPlayerInventoryItem(db, item);
    appendEvent(db, campaignId, turn, "player_item_acquired", {
      itemId: item.itemId,
      quantity,
      totalQuantity: item.quantity,
      source: input.source
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return listPlayerInventory(db, campaignId).find((candidate) => candidate.itemId === item.itemId)!;
}

export function equipPlayerItem(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  itemId: string
): PlayerInventoryItem {
  const definition = findItem(content, itemId);
  if (!definition.equipmentSlot) throw new Error(`${definition.name} cannot be equipped`);
  const inventory = listPlayerInventory(db, campaignId);
  const target = inventory.find((item) => item.itemId === itemId);
  if (!target) throw new Error(`${definition.name} is not owned by the player`);
  if (target.equippedSlot === definition.equipmentSlot) return target;
  const turn = campaignTurn(db, campaignId);

  db.exec("BEGIN IMMEDIATE");
  try {
    const replaced = inventory.find((item) => item.equippedSlot === definition.equipmentSlot);
    if (replaced) persistPlayerInventoryItem(db, { ...replaced, equippedSlot: null, updatedTurn: turn });
    persistPlayerInventoryItem(db, { ...target, equippedSlot: definition.equipmentSlot, updatedTurn: turn });
    updateEquippedDefense(db, content, campaignId, turn);
    appendEvent(db, campaignId, turn, "player_item_equipped", {
      itemId,
      slot: definition.equipmentSlot,
      replacedItemId: replaced?.itemId ?? null
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return listPlayerInventory(db, campaignId).find((item) => item.itemId === itemId)!;
}

export function unequipPlayerItem(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  itemId: string
): PlayerInventoryItem {
  const definition = findItem(content, itemId);
  const target = listPlayerInventory(db, campaignId).find((item) => item.itemId === itemId);
  if (!target) throw new Error(`${definition.name} is not owned by the player`);
  if (!target.equippedSlot) return target;
  const turn = campaignTurn(db, campaignId);
  db.exec("BEGIN IMMEDIATE");
  try {
    persistPlayerInventoryItem(db, { ...target, equippedSlot: null, updatedTurn: turn });
    updateEquippedDefense(db, content, campaignId, turn);
    appendEvent(db, campaignId, turn, "player_item_unequipped", { itemId });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return listPlayerInventory(db, campaignId).find((item) => item.itemId === itemId)!;
}

export function consumePlayerItem(
  db: DatabaseSync,
  content: VelmoraContent,
  campaignId: string,
  itemId: string
): PlayerInventoryItem | null {
  const definition = findItem(content, itemId);
  if (definition.category !== "consumable") throw new Error(`${definition.name} is not consumable`);
  const target = listPlayerInventory(db, campaignId).find((item) => item.itemId === itemId);
  if (!target) throw new Error(`${definition.name} is not owned by the player`);
  const turn = campaignTurn(db, campaignId);
  db.exec("BEGIN IMMEDIATE");
  try {
    if (target.quantity === 1) {
      db.prepare("DELETE FROM player_inventory WHERE campaign_id = ? AND item_id = ?").run(campaignId, itemId);
    } else {
      persistPlayerInventoryItem(db, { ...target, quantity: target.quantity - 1, updatedTurn: turn });
    }
    appendEvent(db, campaignId, turn, "player_item_consumed", {
      itemId,
      remainingQuantity: target.quantity - 1
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return listPlayerInventory(db, campaignId).find((item) => item.itemId === itemId) ?? null;
}
