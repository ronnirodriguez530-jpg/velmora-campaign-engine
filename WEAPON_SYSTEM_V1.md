# Weapon System V1 — Approved Decisions

## Status

Design decisions approved by the user. They are not implemented until the item definition, inventory, combat, browser, persistence, rollback, and cross-module tests pass the integration gates.

## Approved base model

- Weapons use three bounded damage tiers:
  - Light: d6
  - Standard: d8
  - Heavy: d10
- A weapon uses its relevant Strength or Dexterity modifier for both the attack roll and damage.
- A critical hit rolls twice the weapon dice and adds the relevant ability modifier once.
- Switching the equipped weapon during combat consumes the turn's Minor Interaction slot.
- Tags may describe secondary identity or retrieval traits, but tags may not substitute for typed range, damage, ability, slot-cost, or use rules.

## Required executable connection

The implemented path must be:

`Item definition → owned inventory record → equipped main-hand weapon → derived combat attack/damage values → player roll prompt → resolution/event history → save/rollback/browser refresh`

The current generic player d6 in the combat foundation is a placeholder and must be removed when this bridge is implemented.

## Still undecided

- Whether V1 begins with normal attacks only or includes any initial maneuvers.
- Exact weapon tags and their mechanical meanings.
- Ranged-weapon ammunition, reload, and range rules.
- Unarmed and improvised-weapon rules.
- Starting weapon/loadout selection.

These choices must be approved before their dependent mechanics are implemented.
