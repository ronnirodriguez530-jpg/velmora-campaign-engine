# Velmora Ghost Feature Audit

Audit refreshed: 2026-11-05

## Verdict

Velmora contains substantial executable systems, but it is not yet one fully connected playable game. The opening/story/NPC/quest/noncombat-action path is genuinely integrated. Combat, inventory, powers, progression, Tear payloads, creatures, relics, and several browser pages contain real foundations but do not yet cross the complete Campaign Master → validation → state → browser → rollback loop.

The authoritative gate-by-gate evidence is maintained in `SYSTEM_INTEGRATION_MATRIX.md`. `MASTER_CHECKLIST.md` remains the top-level work ledger.

## What is not a ghost

These systems have real persisted state, executable rules, validation, and tests:

- campaign creation, seed, blueprint, and stage-gated opening;
- player character and derived statistics;
- opening d6, adaptive pre-strike exploration, First Speaker strike, hidden crisis, and first quest;
- story-thread memory and bounded thread tools;
- quest composition, lifecycle, direction confirmation, failure, recovery, neglect, outcomes, and progression reward bridge;
- NPC identity, design, knowledge, belief, memory, relationships, lifecycle, context retrieval, and bounded turn updates;
- noncombat action assessment and player-clicked d20 checks;
- faction condition/path and location movement/consequence foundations;
- event history, checkpoints, persistence, and rollback;
- compact Quest/recent-event journal;
- persistent combat encounters, initiative, turn budget, attack/damage prompts, HP, victory/defeat, and noncombat exits;
- item ownership, quantities, equipment slots, Defense recalculation, consumption records, and rollback;
- power definitions, ownership, sustained activation, protected Level 3 acquisition, and rollback;
- milestone opportunities and approved ability/proficiency spending.

## Current ghost or island features

A feature below may contain real code. It remains a ghost or island because its complete operating path is missing.

1. **Combat** — engine and API foundations exist, but the Campaign Master cannot start/manage encounters through the validated turn plan and the Draft 1 combat screen is not rendered.
2. **Inventory** — weapon and Defense equipment now drive engine mechanics, but no Campaign Master item tools or functional Inventory page exists and broader item use remains isolated.
3. **Powers** — ownership/activation work, but powers have no approved combat/noncombat effects, validated use authority, or player interface.
4. **Progression** — milestone and spending logic work, but players cannot view and spend opportunities in the browser.
5. **Tear payloads** — arrival records exist, but payload labels do not instantiate creatures, alterations, relics, or durable world events.
6. **Creatures and most relic content** — curated catalogs are reference material rather than typed mechanical entities.
7. **Faction politics** — condition/path counters work, but leaders, relationships, assets, pressures, goods, and political behavior remain incomplete.
8. **Scene composer** — presentation exists and receives filtered state, but complete multi-system scene construction and sustained real-provider behavior are unverified.
9. **Adaptive learning** — the bounded-learning contract is design-only and deliberately deferred.
10. **Reliability/release** — migrations, save export/import, backup/recovery, live-provider failure handling, accessibility testing, packaging, and stable release procedure remain incomplete.

## False signals prohibited

The following may not be used as evidence that a feature is complete:

- a tag or category name;
- a prose catalog entry;
- a TypeScript type without runtime validation;
- a database table without an executable rule;
- an application function unavailable to the Campaign Master or player;
- data appearing in context without an authorized mutation path;
- an API response with no usable browser control;
- a passing isolated test when the cross-system path is absent;
- mocked-provider compliance presented as live-provider quality.

## Required integration standard

Every first-release feature must pass the seven gates defined in `SYSTEM_INTEGRATION_MATRIX.md`:

1. Definition
2. State
3. Mechanics
4. Campaign Master authority
5. Context and visibility
6. Player surface
7. Recovery proof

Only then may it be described as integrated or complete.

## Immediate correction

Continue through the bridge order in `SYSTEM_INTEGRATION_MATRIX.md`. The next bridge is the approved weapon/inventory/combat connection. Do not add more isolated catalogs or mechanics while a required connection remains missing.
