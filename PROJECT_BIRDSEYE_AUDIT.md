# Velmora Project Bird's-Eye Audit

## Purpose

This is a reconciliation snapshot, not a second roadmap. It answers four questions:

1. What does Velmora currently contain?
2. What is genuinely functional?
3. What useful material exists but is not yet playable?
4. Does each part belong to the master plan?

`MASTER_CHECKLIST.md` remains the roadmap. `SYSTEM_INTEGRATION_MATRIX.md` remains the integration verdict. `FUNCTION_BUILD_QUEUE.md` remains the unfinished-function queue. Nothing is deleted or promoted merely because it appears in this audit.

## Product center

Velmora is an online-first, replayable living-campaign game. The user approves protected canon and hard rules. One adaptive Campaign Master uses bounded engine tools to generate scenes, quests, NPC behavior, complications, and consequences during play. The repository and save—not the cloud provider—own canon, rules, validation, state, and memory.

The project is not meant to become a prewritten campaign book, a collection of disconnected catalogs, or several competing AI departments.

## Connected playable spine

The following path is implemented and tested as one connected route:

1. Create or reopen a named campaign.
2. Create one persistent player character.
3. Click the opening d6 to select one fixed Crown starting situation.
4. Play a bounded adaptive exploration window.
5. Reach and witness the First Speaker strike.
6. Reveal the seeded hidden crisis.
7. Generate the first formal quest from the established thread and crisis.
8. Accept free-text or suggested noncombat actions.
9. Confirm an interpreted quest direction when necessary.
10. Resolve uncertain actions through a refresh-safe player-clicked d20.
11. Submit bounded Campaign Master tools for quests, NPCs, story threads, faction condition, reputation, movement, and location consequences.
12. Validate and commit accepted changes atomically.
13. Rebuild player context, narration, active quests, and the latest five meaningful events.
14. Save, reopen, or roll back the last committed turn.

This is the strongest usable part of the project. With a configured cloud provider, it can support an opening and noncombat story/quest loop. It is not yet a complete campaign because combat, inventory use, powers, progression controls, and several world systems do not enter this same loop.

## Master-checklist reconciliation

| Master area | What exists | Actual status | What is usable now |
| --- | --- | --- | --- |
| 1. World canon | Six factions, protected Tear/Speaker arc, Order of Glass, stage gates, district identities, boundaries | Strong foundation | Reliable constraint and generation material |
| 2. Campaign structure | Seeded blueprint, opening pressures, faction pressures, clue routes, reversals, stage dwell gates | Functional structure | Creates bounded campaign direction without prewriting scenes |
| 3. Locations/world content | Nine foundation locations, graph movement, placement, limited consequences, map references | Partial | Current/connected location context and movement |
| 4. Base engine | SQLite, events, context, validators, transactions, checkpoints, rollback | Functional foundation | Supports the connected playable spine |
| 5. Player character/party | Character creation, abilities, skills, saves, HP, Defense; no party system | Character functional; party missing | Character page and derived rules |
| 6. NPC Engine | Identity, categories, knowledge, belief, memory, relationships, lifecycle, generation, turn updates | Strong engine foundation | Campaign Master can generate/manage bounded current-scene NPCs; no dedicated UI |
| 7. Action/dice | Automatic versus uncertain actions, hidden DC, proficiency, advantage/disadvantage, outcome bands | Functional | Real player-clicked noncombat resolution |
| 8. Combat | Encounter state, initiative, slots, attacks, damage, exits, equipped weapons, unarmed fallback, rollback, APIs | Mechanical island | Test/API use only; no Campaign Master start tool or rendered combat screen |
| 9. Powers | Seven definitions, ownership, source gates, sustained activation | Isolated foundation | Storage/context only; no approved effects or player use loop |
| 10. Inventory/economy | Eight definitions, quantities, equipment, Defense, consumption, weapon-to-combat bridge | Partial island | Engine equipment works; Inventory page and broader item use do not |
| 11. Advancement | Milestones, opportunities, approved ability/skill spending, quest reward bridge | Partial bridge | Engine logic works; player cannot view/spend in browser |
| 12. Quest Engine | Generation, directions, adaptive objectives, outcomes, recovery, neglect, concurrency, journal, originality gates | Strongest story subsystem | Functional inside normal play; long-form quality still needs live proof |
| 13. Factions | Definitions, condition, provisional paths, limited tools | Scaffold | Basic counters and bounded changes only |
| 14. Tear/Surge | Deterministic arrival scheduling and curated concepts | Scaffold/reference | Scheduling only; payloads do not materialize mechanically |
| 15. Campaign Master | Cloud adapter, planning/presentation context, validated existing tool families | Partial brain/toolbox | Runs the connected noncombat spine; cannot yet coordinate all systems |
| 16. Player freedom/modes | Free-text input and some recovery contracts; override/Silly Mode designs only | Mostly designed | Ordinary free input works |
| 17. Browser | Story, Character, Quest journal, Factions, Locations, History, Settings, d6/d20 overlays | Partial application | Opening and noncombat story loop; Inventory is static and combat is unrendered |
| 18–23. Reliability/release | Persistence, rollback, tests, updater, Windows launcher, public GitHub | Working foundation | Local launch/update works; migrations/export/security/accessibility remain incomplete |
| 24–26. Advanced systems | Adaptive-learning contract, autonomous world concept, expansion boundaries | Design only | Preserve for later; do not treat as current functionality |

## Useful material that must be preserved

### Runtime and tests

- `src/`, `content/velmora/*.json`, `public/`, `tests/`, and persistence schemas are executable project assets.
- The 143-test suite, simulation runners, and rollback coverage are valuable regression protection.
- The simulations prove bounded mechanics and invariants; they do not prove narrative quality or campaign variety.

### Protected design and operating contracts

- `BOUNDARIES.md`
- `STORY_ENGINE_V1.md`
- `CAMPAIGN_MASTER_TOOLBOX_V1.md`
- `QUEST_ENGINE_V1.md` and its decision/originality policies
- `NPC_ENGINE_V1.md`
- `COMBAT_INTERFACE_DRAFT_1.md`
- `WEAPON_SYSTEM_V1.md`
- power, item, progression, and combat feature specifications

These documents hold approved intent and constraints. Where status language is stale, update the status rather than discarding the underlying rules.

### Reference and future-use material

- Quest and NPC reference libraries
- Power/creature and relic/magic-tech catalogs
- Map images and circulation/faction visual plans
- QA stress scenarios and consequence-propagation specifications
- Abstract scene templates and campaign blueprint pools

These are useful source material. They remain reference, test support, or future implementation input until promoted through the seven integration gates.

## Material drift found

No useful file needs deletion. The following items need reconciliation so they do not compete with the master list:

1. `README.md` calls the browser a “complete local application,” although multiple required player loops are absent.
2. `PROJECT_STATUS.md` is a valuable chronological record but contains old test totals and old placeholder descriptions. Its historical warning is correct and should remain prominent.
3. `DM_CORE_RULES_V1.md` says combat equipment swapping uses an Action; the later approved and implemented rule uses Minor Interaction.
4. `ITEM_SYSTEM_V1.md` still lists attacks and damage as wholly missing even though typed equipped weapons now drive combat.
5. `BOUNDARIES.md` still calls the first actionable objective/opening-quest implementation unfinished, although the opening controller now creates it after the strike and crisis.
6. `CAMPAIGN_MASTER_TOOLBOX_V1.md` says combat inventory connection is pending; the engine connection exists, while Campaign Master and browser integration remain pending.
7. The QA support material identifies additional valuable holes—rumors/claims, NPC-to-NPC information transfer, faction intelligence, and consequence propagation—that need explicit links to the master checklist and function queue.

These are documentation/status conflicts, not reasons to remove the underlying work.

## Current proof

- Content validation: passes.
- Automated suite: 143/143 passes.
- General simulation: 12 paths × 12 turns, no validation failures or canon mutation; paths reduce to four repeated scaffold patterns.
- Quest simulation: 12 paths, no validation failures; every path proves the same bounded recovery/concurrency/journal invariants.

The repeated simulation shapes are acceptable as mechanical proof but demonstrate that these runners are not evidence of a finished adaptive Campaign Master.

## What can reasonably be used today

### Usable as a game path

- Campaign and character creation
- Opening d6 and adaptive pre-strike exploration
- First Speaker strike, hidden crisis, and first quest timing
- Cloud-generated noncombat scenes and natural player actions
- Quest directions, action checks, NPC/thread/quest consequences
- Quest/recent-event journal
- Save, reopen, rollback, and update controls

### Usable as development foundations

- Combat engine and weapon rules
- Inventory/equipment
- Powers and progression records
- Faction/location/Tear scaffolds
- Reference libraries, catalogs, maps, and QA specifications

### Not yet safe to claim as playable

- Campaign Master-created and managed combat
- Dedicated combat screen
- Inventory, power, or progression player loops
- Conditions, Downed/recovery, range, maneuvers, creature AI, and group combat
- Living faction politics or materialized Tear payloads
- Full consequence propagation and autonomous off-screen world activity
- Sustained live-provider campaign quality
- Stable release recovery, export/import, accessibility, and migration support

## Reconciliation plan before more feature building

1. Freeze new feature implementation temporarily.
2. Keep `MASTER_CHECKLIST.md` as the only overall roadmap.
3. Link every `FUNCTION_BUILD_QUEUE.md` entry to one master section and the supporting design/runtime/test files.
4. Correct stale status language and rule conflicts without deleting historical or reference material.
5. Promote the QA consequence-propagation holes into the master checklist/function queue.
6. Mark every asset as one of: authoritative, executable, reference/support, historical, or superseded-by-link.
7. Define one minimum playable-release chain and distinguish it from later expansion work.
8. Resume implementation only from that reconciled chain.

## Preservation rule

Reconciliation means relabeling, linking, merging duplicated status, and identifying superseded rules. It does not mean deleting catalogs, QA work, map references, historical checkpoints, or partially implemented systems. Removal requires proof that an asset is both redundant and contains no unique approved decision, test, source, or reusable content.
