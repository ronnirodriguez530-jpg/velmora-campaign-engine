# Velmora Item System V1

## Working scope

The first item checkpoint provides eight validated item definitions, persistent inventory quantities, acquisition sources, equipment slots, equipment replacement, bounded defense bonuses, consumable removal, event history, player-context retrieval, save compatibility, and one-turn rollback.

## Initial executable definitions

- Field Knife
- Scrap Crossbow
- Reinforced Coat
- Warded Riot Shield
- First-Aid Wrap
- Rift Detector
- Null Lantern
- Sealed Council Records

The catalog includes a weapon, armor, shield, consumable, tool, relic, and quest item so later systems can use real records instead of placeholders.

## Protected rules

- Every item uses a stable authored identifier and validated category.
- Non-stackable items cannot be duplicated in one character inventory.
- Stackable items cannot exceed their authored stack limit.
- Only one item may occupy an equipment slot at a time; equipping another replaces it.
- Equipped defense bonuses are recalculated from actual equipment and cannot exceed four.
- Quest-item possession cannot reveal contents, create a quest, or invent story authority.
- Relics and magic-tech cannot gain unlisted powers through narration.

## Still required

- Attacks, damage, ammunition, range, reload, blocking, and combat actions
- Healing and recovery values
- Charges, recharge, durability, loss, repair, and recovery
- Starting loadout selection
- Prices, faction goods, scarcity, purchasing, crafting, and loot generation
- Campaign Master tools for granting, removing, equipping, and using items
- Browser inventory interface
