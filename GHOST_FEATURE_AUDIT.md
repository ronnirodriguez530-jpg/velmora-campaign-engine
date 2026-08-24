# Velmora Ghost Feature Audit

Audit date: 2026-08-22

Purpose: distinguish the application that actually exists from scaffolding, approved design, and absent features. A passing test means only that its stated scope works; it does not prove an unimplemented game system exists.

## Status meanings

- **Working:** concrete code path exists and is covered by a relevant test or direct user verification.
- **Partial/scaffold:** some schema, UI, or mechanical placeholder exists, but the feature is not playable end to end.
- **Design-only:** approved in a project specification, with no implementation yet.
- **Absent:** no supporting schema or working code exists.
- **Unverified live:** implementation exists against a mocked provider or local test, but the real external connection has not been exercised.

## Working now

1. Local Node browser server bound to `127.0.0.1`.
2. Browser navigation between Story, Character, Quests, Factions, Locations, Inventory, History, and Settings.
3. Named campaign creation, reopening, and SQLite persistence.
4. Authored foundation loading and validation for six factions, nine locations, four stages, and seven fixed character slots.
5. Current-location and directly-connected-location lookup.
6. Fixed authored-character presence lookup by current location.
7. Deterministic generic scene placement, persistence, and reuse.
8. Story-presentation storage for diagnostic or cloud-produced narration.
9. Strict cloud Director request/response adapter tested with a fake API response.
10. Five bounded world-change tools: faction condition, fixed-character reputation, player movement, abstract faction-path advancement, and current-location consequence.
11. Atomic turn commits, event logging, checkpoints, and one-turn rollback for the currently captured state.
12. Provisional deterministic Tear-arrival records.
13. Provisional numeric stage progression through abstract faction-path counters.
14. Public-update client, local version manifest, source replacement, and protection rules for the local save/config paths.
15. Persistent general NPC records with active/known/background categories, automatic category decisions from bounded relevance signals, and category-change history.
16. Separate world-fact, NPC-knowledge, NPC-belief, and personal-memory storage, including meaningful-memory promotion from background to known.
17. Directional NPC relationships combining a five-step standing, optional qualities, and recorded cause history.
18. Adaptive NPC Context Gate with configurable detail budget, relevance ranking, full/supporting detail tiers, and knowledge isolation.
19. Curated NPC reference registry, tagged design-principle retrieval, source-license validation, required attribution checks, and an initial originality/quality evaluator.
20. Constrained on-demand minor-NPC generation with canon validation, persisted design profiles, applied lesson IDs, and a permanent novelty ledger.
21. NPC lifecycle and archival with normally permanent death, explicit transition history, and complete NPC-state rollback coverage.
22. Live-turn NPC integration: filtered NPC context reaches the Campaign Master, which may propose one engine-validated minor NPC request per committed turn.
23. NPC Turn Manager with bounded memory, adjacent player-standing, relationship qualities, existing public-fact learning, non-death status, connected movement, and involvement/category updates.
24. Current automated suite: 36 of 36 tests passing.

## Partial or scaffolded

### Campaign Master

- The OpenAI Responses API adapter, strict tool schemas, basic prompts, and local key-setting route exist.
- The real API connection has not been verified in this workspace.
- The prompts are a basic bounded narrator/turn planner, not the trained DM Core discussed later.
- No DM handbook retrieval, examples library, rules retrieval, evaluations, or adaptive behavior exists.

### Characters and NPCs

- `character_state` stores only ID, status, reputation, location, and an unused replacement-character field for seven fixed authored slots.
- The seven content records contain roles and faction links, not complete NPC identities or personalities.
- There is no player-character record or character-creation flow.
- A general `npc_records` registry now preserves minimal identity, origin, faction, location, role, status, relevance turn, and storage category.
- Automatic category decisions, recorded transitions, knowledge/belief separation, personal memory storage, directional relationship storage, adaptive Context Gate, curated reference retrieval, constrained minor-NPC generation, persistent novelty, lifecycle/archival, complete NPC rollback, bounded creation, and bounded live NPC consequence management work. Restricted-fact reveal events, high-consequence death resolution, and a real-provider playtest do not exist yet.

### Quests

- A `quest_instances` table exists.
- No authored quest exists; there is no creation/activation/completion tool, application service, or usable Quest UI.
- The Quest page is a static empty state and its badge is hard-coded to zero.

### Factions

- Six faction definitions, condition values, and provisional path counters exist.
- The Factions page can display those numbers.
- Relationships, named leadership, actual faction milestones, faction quests, goods transactions, and political simulation do not exist.
- The faction badge counts nonzero path counters; it does not identify a genuine actionable faction event.

### Locations

- Nine top-level locations and a reciprocal connection graph exist.
- Player movement between directly connected authored locations can be validated and committed.
- Current-location consequences can be stored as text.
- There are no interiors, sublocations, temporary-location lifecycle, dynamic location creation, or location context gate.
- The location badge counts consequences and Tear records, not necessarily actionable decisions.

### Tear system

- A provisional 15% deterministic arrival check records rarity and combinations of three payload labels.
- No actual creature, magic, fragment, encounter, consequence, or content-placement pipeline is attached to those labels.
- Frequency and rarity weights are explicitly scaffolding, not canon.

### Story and campaign progression

- Four broad stage anchors and four generic templates exist.
- The generic templates contain abstract conflict/objective keys rather than authored scenes or quest structure.
- Stage progression is driven by provisional counters and produces uniform simulations.
- There are no truth candidates, no truth-selection logic, no main quests, no faction quests, and no side quests.

### Browser pages and trackers

- Story, Factions, Locations, History, and Settings render limited real data.
- Character, Quests, and Inventory are placeholder pages.
- History shows recent committed player actions and Director summaries, not the complete engine event history.
- There is no combat strip, action dropdown, dice popup, ability proposal card, Silly Mode slider, or NPC interface.

### Perspective filtering

- Current and connected locations and characters physically present at the current location are filtered.
- All faction conditions/path counters and the three most recent Tear arrivals are still sent in the Director context.
- No relevance-ranked retrieval system exists for NPCs, quests, items, secrets, or campaign memory.

## Design-only features

Everything in `DM_CORE_RULES_V1.md` is approved design, not implemented code. This includes:

1. Player-clicked d20 popup, critical/partial outcome rules, difficulty ladder, and advantage/disadvantage.
2. Six ability scores, standard array, modifiers, skills, proficiencies, and saving throws.
3. Player HP, Defense, death saves, conditions, morale, rest, and recovery.
4. Adaptive quick/standard/set-piece theater-of-the-mind combat.
5. Combat actions and the contextual action dropdown.
6. Magic and ability usage, sustained effects, and player approval of proposed abilities.
7. Inventory slots, weapons, armor, shields, consumables, and equipment effects.
8. Silly Mode and temporary/permanent player-authored overrides.
9. XP event recording, milestone advancement, and the later skill-tree module.
10. Progressive-disclosure combat and tracker UI.

The proposed NPC Context Gate is also design-only. It is not yet present in `DM_CORE_RULES_V1.md` or implemented in the database.

## Completely absent systems

1. Validated restricted-fact reveal events and dedicated high-consequence NPC death resolution.
2. Player character storage, character sheet, creation, party membership, and party control.
3. Gameplay dice roller and roll records.
4. Combat state, initiative, turns, HP, damage, conditions, targets, and encounter resolution.
5. Inventory/item storage and equipment state.
6. Ability/power catalog and character ability ownership.
7. XP, level, milestone, or skill-tree storage and behavior.
8. Quest lifecycle application logic and authored quest content.
9. Actual creatures, relics, powers, world fragments, and Tear payload content.
10. Final-truth candidates and player-choice resolution logic.
11. DM training/reference retrieval, example library, or open-licensed rules ingestion.
12. Adaptive learning, player-preference modeling, and DM behavior adjustment.
13. Independent live-world activity. The playable engine advances only in response to committed player actions; the multi-path Simulation Runner is isolated test machinery.
14. Silly Mode and override history.
15. Velmora economy and item catalog.

## Important implementation limitations found

1. The README contains some older command/build terminology.
2. Rollback deletes later scenes, location consequences, and Tear arrivals, but does not delete orphaned later story-presentation records.
3. Quest snapshots preserve only quest state and cannot support future quest creation or detailed quest mutation without expansion.
4. NPC behavior is covered through local and mocked-provider tests, but real Campaign Master quality and real provider behavior remain unverified.
5. Player character, combat, inventory, authored quests, powers, and a full playable campaign remain untested because those systems do not yet exist.

## Correct project position

Velmora currently has a functional local application shell, continuity scaffold, and tested NPC Engine foundation. It is not yet a complete playable D&D campaign engine and does not yet contain the implemented DM Core, player character, authored quests, combat, items, powers, or sufficient authored campaign content.

## Required correction before further feature design

1. Maintain one feature ledger with the four statuses used in this audit.
2. Never describe design-only or partial features in the present tense.
3. Implement and test one dependency-complete vertical system before designing dependent behavior.
4. Continue from the completed NPC foundation into only the minimum safe NPC consequence tools required by live play.
