# Weapon System V1 — Approved Decisions

## Status

The first engine bridge is implemented and tested. Typed weapon definitions now flow through owned/equipped inventory into attack and damage resolution, event history, persistence, and rollback. The Draft 1 browser surface and Campaign Master encounter authority remain separate later checkpoints.

## Approved base model

- Weapons use three bounded damage tiers:
  - Light: d6
  - Standard: d8
  - Heavy: d10
- A weapon uses its relevant Strength or Dexterity modifier for both the attack roll and damage.
- A critical hit rolls twice the weapon dice and adds the relevant ability modifier once.
- Switching the equipped weapon during combat consumes the turn's Minor Interaction slot.
- A character without an equipped weapon can always make an unarmed attack for d4 plus Strength.
- Tags may describe secondary identity or retrieval traits, but tags may not substitute for typed range, damage, ability, slot-cost, or use rules.

## Required executable connection

The implemented path must be:

`Item definition → owned inventory record → equipped main-hand weapon → derived combat attack/damage values → player roll prompt → resolution/event history → save/rollback/browser refresh`

This engine path is now executable. Field Knife is a typed light d6 flexible Strength/Dexterity weapon; Scrap Crossbow is a typed standard d8 Dexterity weapon. Criticals double the weapon dice and apply the ability modifier once. Combat switching updates equipment and the active combatant atomically and consumes Minor Interaction.

## Still undecided

- Whether V1 begins with normal attacks only or includes any initial maneuvers.
- Exact weapon tags and their mechanical meanings.
- Ranged-weapon ammunition, reload, and range rules.
- Improvised-weapon rules.
- Starting weapon/loadout selection.

These choices must be approved before their dependent mechanics are implemented.
