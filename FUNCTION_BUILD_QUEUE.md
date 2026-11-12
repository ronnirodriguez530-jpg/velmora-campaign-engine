# Velmora Function Build Queue

## Purpose

This is the authoritative queue for capabilities that have been identified but are not yet fully built. It prevents a design question, dependency, or integration requirement from disappearing between checkpoints.

A function stays here until it passes every applicable integration gate in `SYSTEM_INTEGRATION_MATRIX.md`: definition, state, mechanics, Campaign Master authority, context/visibility, player surface, and recovery proof. A tag, catalog entry, prompt instruction, or isolated test does not remove it from this queue.

## Active build order

### FBQ-001 — Campaign Master encounter authority

**Checkpoint:** Encounter authority bridge
**Status:** Next
**Goal:** Let the validated Campaign Master start and manage an encounter from established campaign state without bypassing player control or inventing unsupported world facts.

Required functions:

- Decide when established circumstances justify entering combat.
- Construct participants only from supplied NPC, creature, faction, location, quest, or event context.
- Select an encounter mode and enforce its participant limits.
- Assign bounded participant combat statistics through one approved method.
- Preserve player-clicked player rolls and automatic NPC/support rolls.
- Expose credible escape, surrender, and negotiation routes.
- Record encounter start, changes, and resolution as durable events.
- Apply combat results to quests, NPCs, factions, locations, and story threads through the same atomic turn plan.
- Reject an invalid combined plan without leaving a partial encounter or partial world consequence.
- Restore encounter and related world state together through rollback.

Unresolved decision:

- **Enemy and supporting-combatant statistics:** choose whether the Campaign Master selects bounded role templates, requires completed typed NPC/creature profiles, or supplies raw numbers inside strict limits.

This decision must be made before FBQ-001 is marked complete. It is intentionally recorded instead of being silently chosen during implementation.

### FBQ-002 — Draft 1 combat browser

**Checkpoint:** Combat browser bridge
**Status:** Queued after FBQ-001

Required functions:

- Dedicated combat view while an encounter is active.
- Fight, Action, Powers, and Bag category controls plus Custom Action.
- Legal options generated from current state rather than static labels.
- Visible Power, Action, Movement, and Minor Interaction slot availability.
- Target selection, player-clicked attack/damage prompts, and explicit End Turn.
- Battle feed with actor labels and approved color roles.
- Refresh recovery without rerolls or lost selections.

### FBQ-003 — Power-use bridge

**Checkpoint:** Power integration
**Status:** Queued after FBQ-002

Required functions:

- Approved costs, limits, targets, durations, risks, and interruption rules.
- Validated Campaign Master authority and player Power-slot use.
- Persistent effects, event history, context visibility, browser controls, and rollback.

### FBQ-004 — Item-use and recovery bridge

**Checkpoint:** Bag and recovery integration
**Status:** Queued after FBQ-003

Required functions:

- Legal Bag actions and Action/Minor Interaction costs.
- Approved healing, stabilization, recovery, and charge rules.
- Quantity consumption only after successful validated use.
- Durable consequences, refresh recovery, and rollback.

### FBQ-005 — Progression browser bridge

**Checkpoint:** Progression integration
**Status:** Queued after FBQ-004

Required functions:

- Show earned and available advancement opportunities.
- Require explicit player approval for spending.
- Apply only validated improvements and explain rejected choices.
- Persist history and support rollback.

### FBQ-006 — Movement and range execution

**Checkpoint:** Combat rules completion
**Status:** Queued; may be built with FBQ-002

Required functions:

- Enforce Engaged, Near, Far, and Out of Reach without introducing a grid.
- Let the Campaign Master determine scene-appropriate Movement while the engine validates legal changes.
- Connect weapon, power, target, cover, and exit availability to current range.
- Persist position changes and restore them through refresh and rollback.

### FBQ-007 — Combat maneuvers and Custom Action interpretation

**Checkpoint:** Combat rules completion
**Status:** Queued after approved maneuver scope

Required functions:

- Define the smallest approved V1 maneuver set beyond normal attacks.
- Translate free-text combat intent into legal Power, Action, Movement, and Minor Interaction components.
- Ask for confirmation only when interpretation is ambiguous or especially consequential.
- Reject impossible combinations while preserving the legal portion for player review.

Unresolved decisions:

- Initial maneuver list and the exact effects of defend, help, hide, and cover.
- Improvised-weapon rules.

### FBQ-008 — Conditions, Downed state, and combat recovery

**Checkpoint:** Combat/recovery completion
**Status:** Queued after FBQ-004

Required functions:

- Typed condition definitions, duration, source, stacking, removal, context, and rollback.
- At 0 HP, mark the player Downed while the encounter continues.
- If no ally can help, prompt one player-clicked recovery roll per round while circumstances allow.
- A successful recovery restores 1 HP and normal actions on the next scheduled turn.
- Failed recovery rolls never accumulate into automatic death.

Unresolved decision:

- Initial bounded condition list and each condition's exact mechanical effect.

### FBQ-009 — NPC, enemy, party, and group combat behavior

**Checkpoint:** Encounter behavior completion
**Status:** Queued after FBQ-001

Required functions:

- Automatic NPC, party-member, and enemy turns with every roll shown in the battle feed.
- Behavior grounded in identity, beliefs, goals, relationships, morale, and encounter stakes.
- Bounded target and action selection without reading hidden player intentions.
- Condensed handling for groups while preserving named/important combatants.
- Surrender, retreat, negotiation, rescue, and nonlethal behavior where credible.

Unresolved decisions:

- Creature, enemy, party-member, and condensed group-turn rules.

### FBQ-010 — Faction politics and reputation

**Checkpoint:** Faction/Tear/content bridge
**Status:** Queued after the playable combat loop

Required functions:

- Typed faction goals, leaders, agents, assets, goods, territory, relationships, and political pressures.
- Player reputation and allegiance effects that influence access and behavior without forcing faction membership.
- Actionable faction events, milestones, quests, consequences, and perspective filtering.
- Cooperation and conflict that may fracture without automatically collapsing the city.
- Campaign Master tools, event history, browser presentation, and rollback.

### FBQ-011 — Tear, Surge, and payload materialization

**Checkpoint:** Faction/Tear/content bridge
**Status:** Queued after FBQ-010 foundations

Required functions:

- Approved frequency, rarity, stage, and escalation limits.
- Materialize generated arrivals as typed creatures, energy, materials, weapons, relics, fragments, or alterations.
- Place payloads in valid locations and connect them to quests, factions, NPCs, truths, and consequences.
- Implement Surge and Endless Surge behavior without uncontrolled content expansion.
- Persist hidden versus witnessed information and support rollback.

Unresolved decisions:

- Final frequency, rarity, escalation, and player-driven rhythm rules.

### FBQ-012 — Creatures, altered life, relics, and magic-tech effects

**Checkpoint:** Faction/Tear/content bridge
**Status:** Queued with FBQ-011

Required functions:

- Replace catalog-only entries with typed identities, origins, mechanics, placement authority, lifecycle, and effects.
- Preserve the approved creature-origin boundary and stage gates.
- Connect usable effects to combat/noncombat resolution, inventory, quests, locations, context, UI, and rollback.
- Prevent descriptive tags from acting as unvalidated mechanics.

### FBQ-013 — Complete scene composer and system coordination

**Checkpoint:** Complete DM bridge
**Status:** Queued after core playable systems

Required functions:

- Compose scenes from current quests, threads, NPCs, factions, locations, inventory, powers, and encounters.
- Select the appropriate validated tool instead of narrating unsupported state changes.
- Preserve callbacks, secrets, consequences, stage gates, player freedom, and recovery routes.
- Coordinate systems without prewriting scenes or requiring the user to author the campaign.
- Provide coherent transitions between exploration, dialogue, investigation, quests, and combat.

### FBQ-014 — Rules and campaign-reference retrieval

**Checkpoint:** Complete DM bridge
**Status:** Queued with FBQ-013

Required functions:

- Retrieve only relevant canon, rules, craft patterns, and recent state under bounded context budgets.
- Distinguish protected canon, Director-only truth, uncertain observations, and player-known facts.
- Use abstract quest-craft references without copying source expression, identities, or scenes.
- Cite internal provenance in audits while keeping it out of player narration.

### FBQ-015 — Adaptive Campaign Master behavior

**Checkpoint:** DM quality bridge
**Status:** Queued after FBQ-013

Required functions:

- Learn campaign-local preferences and outcomes as uncertain observations, not permanent player labels.
- Improve pacing, retrieval, variation, tool selection, and response to guidance over time.
- Detect repetition and reuse structures only deliberately or subliminally when appropriate.
- Preserve the single Campaign Master model: capabilities are tools, not autonomous competing departments.
- Enforce the long campaign arc and approximately 65/35 story-to-combat target without a per-session quota.
- Recover safely from invalid, repetitive, or unavailable provider output.

### FBQ-016 — Player freedom, overrides, and special modes

**Checkpoint:** DM/player-control bridge
**Status:** Queued after FBQ-013

Required functions:

- Contextual suggestions that never replace free input.
- Temporary and permanent player-authored overrides with explicit scope.
- Override history, canon separation, validation, and rollback.
- Silly Mode that changes tone without corrupting protected campaign state.

### FBQ-017 — Remaining browser game surfaces

**Checkpoint:** Browser completion
**Status:** Queued alongside their engine bridges

Required functions:

- Functional Inventory, Powers, Progression, NPC/relationship, faction, location, and world-state views.
- Contextual action controls and noncombat dice popup.
- Real state and legal actions only; no permanent placeholder counts or ghost controls.
- High contrast, keyboard operation, readable scaling, notifications, loading, and error recovery.

### FBQ-018 — Economy, rewards, scarcity, and item lifecycle

**Checkpoint:** World/inventory completion
**Status:** Queued after item use and faction goods

Required functions:

- Faction goods, bounded prices, availability, scarcity, rewards, acquisition, loss, and recovery.
- Approved ammunition, reload, charge, durability, crafting, and repair rules where applicable.
- Starting loadout selection without silently assigning player identity.
- Campaign Master tools, browser transactions, event history, and rollback.

Unresolved decisions:

- Ranged ammunition, reload, and range rules.
- Starting weapon and loadout process.

### FBQ-019 — Save compatibility, export, backup, and recovery

**Checkpoint:** Release reliability
**Status:** Required before stable release

Required functions:

- Schema versions and tested forward migrations.
- Backward-compatible save upgrades and orphan-record cleanup.
- Save export/import, backup, corruption detection, and recoverable restore.
- Complete rollback rules across every integrated system.

### FBQ-020 — Provider configuration, security, and failure handling

**Checkpoint:** Release reliability
**Status:** Required before stable release

Required functions:

- Verified live-provider connection with safe local credential storage.
- Request limits, timeouts, retries, cancellation, and cost controls.
- Input validation, prompt-injection boundaries, and strict separation between narration and engine authority.
- Clear online failure behavior and provider-independent interfaces that preserve a future offline option.

### FBQ-021 — Context, archive, and performance control

**Checkpoint:** Release reliability
**Status:** Required before sustained play release

Required functions:

- Context gates and budgets for quests, locations, factions, items, secrets, NPCs, and memory.
- Long-campaign archive, retrieval, indexing, and pruning without losing durable state.
- Performance limits for large casts, histories, encounters, and databases.
- Provider input/output budgets and endurance proof.

### FBQ-022 — End-to-end testing and release proof

**Checkpoint:** Release reliability
**Status:** Final release gate

Required functions:

- Cross-module tests for every applicable seven-gate path.
- Full-campaign multi-path simulations and long-history stress tests.
- Real-provider behavior evaluations for callbacks, varied paths, recovery, secrets, pacing, and stage-gated endgame.
- Browser interaction, refresh, accessibility, migration, corruption recovery, updater, and packaging tests.
- One-command installation and launch instructions for the first stable playable release.

## Queue rule

Newly discovered functions or holes must be added here with a stable ID, checkpoint, dependencies, required operating path, and unresolved decisions. `MASTER_CHECKLIST.md` remains the overall roadmap; this file is the concrete function-level build queue.
