# Velmora Ghost Feature Audit

Audit date: 2026-09-02

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
4. Authored foundation loading and validation for six factions, nine locations, four stages, and eight fixed character slots.
5. Current-location and directly-connected-location lookup.
6. Fixed authored-character presence lookup by current location.
7. Deterministic generic scene placement, persistence, and reuse.
8. Story-presentation storage for diagnostic or cloud-produced narration.
9. Strict cloud Director request/response adapter tested with a fake API response.
10. Five bounded world-change tools: faction condition, fixed-character reputation, player movement, abstract faction-path advancement, and current-location consequence.
11. Atomic turn commits, event logging, checkpoints, and one-turn rollback for the currently captured state.
12. Provisional deterministic Tear-arrival records.
13. Provisional numeric stage progression requiring both abstract faction-path counters and stage-dwell floors; Resolution cannot begin before turn 48.
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
24. Persistent story-thread ledger with player/Director visibility, stage and location relevance, urgency, involved-entity links, recovery paths, and rollback capture.
25. Separate player-facing and Director-only story-thread retrieval, preventing hidden planning threads from entering scene-presentation context.
26. Deterministic per-campaign blueprint generation with variable opening pressure, focal faction tension, multiple clue routes, later reversal, and a Resolution-only endgame gate.
27. Persistent hidden blueprint retrieval for Director planning, automatic initial-thread seeding, and safe projection of only the immediate visible crisis into opening-scene context.
28. Validated story-thread management can activate, advance, block, resolve, fail, or recovery-path-replace relevant threads with atomic rollback.
29. Validated live thread creation supports sourced player goals, witnessed consequences, NPC commitments, faction developments, and existing-thread branches without granting new-main-plot authority.
30. Created-thread provenance, visibility inheritance, protected First Speaker boundaries, unresolved-thread caps, and legacy checkpoint defaults.
31. One classless player-character record per campaign, with validated creation, standard-array abilities, derived modifiers, four skill proficiencies, two save proficiencies, starting/current HP, unarmored Defense, persistence, player/Director context, and play-before-creation blocking.
32. Functional browser character creation and persistent character-sheet display.
33. Core action assessment separates automatic actions from uncertain, meaningful checks through a strict Campaign Master schema and engine validation.
34. Player-clicked hidden-DC d20 checks support abilities, linked skills, saving throws, proficiency, Easy/Standard/Hard/Extreme difficulty, advantage/disadvantage, and natural 1/20 priority.
35. Persistent roll records and refresh-safe pending checks prevent rerolls; failed narration can retry with the original stored dice instead of generating a new result.
36. Critical success, success, success with a cost, failure, and critical failure are calculated by the engine and supplied to the Campaign Master with proportional-result and recovery-route instructions.
37. Required player rolls cannot be bypassed through non-browser action paths.
38. Current automated suite: 60 of 60 tests passing.

## Partial or scaffolded

### Campaign Master

- The OpenAI Responses API adapter, strict tool schemas, basic prompts, and local key-setting route exist.
- The adapter now separately assesses roll necessity and must resolve stored engine outcomes, but real-provider adherence and narrative quality remain unverified.
- The real API connection has not been verified in this workspace.
- The prompts are a basic bounded narrator/turn planner, not the trained DM Core discussed later.
- No DM handbook retrieval, examples library, rules retrieval, evaluations, or adaptive behavior exists.

### Characters and NPCs

- `character_state` stores only ID, status, reputation, location, and an unused replacement-character field for eight fixed authored NPC slots.
- The eight authored content records contain roles and faction links, not complete NPC identities or personalities.
- The player-character foundation works, but background, role, faction ties, equipment, conditions, damage, death, rest, recovery, advancement, and party behavior do not exist.
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

- Nine top-level locations, their approved map positions and environments, and a reciprocal connection graph exist.
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
- Stage progression still uses provisional faction counters, but stage-dwell floors now prevent those counters from rushing every simulation into Resolution. Current simulation variety remains mechanical and incomplete.
- There are no truth candidates, no truth-selection logic, no main quests, no faction quests, and no side quests.
- The seeded campaign blueprint, initial thread seeding, context separation, visible opening-pressure projection, validated thread management, and bounded sourced thread creation now exist. These provide continuity memory, not a complete quest or scene-composition system.

### Browser pages and trackers

- Story, Factions, Locations, History, and Settings render limited real data.
- Character creation and sheet display work. Quests and Inventory remain placeholder pages.
- History shows recent committed player actions and Director summaries, not the complete engine event history.
- The temporary action-check popup works. There is no combat strip, action dropdown, ability proposal card, Silly Mode slider, or NPC interface.

### Perspective filtering

- Current and connected locations and characters physically present at the current location are filtered.
- All faction conditions/path counters and the three most recent Tear arrivals are still sent in the Director context.
- Relevance-ranked NPC retrieval exists through the NPC Context Gate. Equivalent retrieval for quests, items, secrets, and campaign memory does not exist.

## Design-only features

Most of `DM_CORE_RULES_V1.md` remains approved design rather than implemented code. Implemented exceptions are the classless character foundation and core non-combat d20 action resolution. Remaining design-only scope includes:

1. Damage, healing, armor/equipment effects, death saves, conditions, morale, rest, and recovery beyond the stored starting/current HP and unarmored Defense foundation.
2. Adaptive quick/standard/set-piece theater-of-the-mind combat.
3. Combat actions and the contextual action dropdown.
4. Magic and ability usage, sustained effects, and player approval of proposed abilities.
5. Inventory slots, weapons, armor, shields, consumables, and equipment effects.
6. Silly Mode and temporary/permanent player-authored overrides.
7. XP event recording, milestone advancement, and the later skill-tree module.
8. Progressive-disclosure combat and tracker UI.

## Completely absent systems

1. Validated restricted-fact reveal events and dedicated high-consequence NPC death resolution.
2. Character background/role/faction/equipment systems, party membership, and party control.
3. Combat state, initiative, turns, damage, conditions, targets, and encounter resolution.
4. Inventory/item storage and equipment state.
5. Ability/power catalog and character ability ownership.
6. XP, level, milestone, or skill-tree storage and behavior.
7. Generative quest lifecycle application logic, reusable validated quest structures, and campaign-specific quest creation.
8. Mechanical creature, relic, power, world-fragment, and Tear-payload records; curated content catalogs exist but cannot yet act on game state.
9. Final-truth candidates and player-choice resolution logic.
10. Story/DM training and reference retrieval beyond the existing NPC-only library, including examples or open-licensed structural guidance.
11. Adaptive learning, player-preference modeling, and DM behavior adjustment.
12. Independent live-world activity. The playable engine advances only in response to committed player actions; the multi-path Simulation Runner is isolated test machinery.
13. Silly Mode and override history.
14. Velmora economy and item catalog.

## Important implementation limitations found

1. The README contains some older command/build terminology.
2. Rollback deletes later scenes, location consequences, and Tear arrivals, but does not delete orphaned later story-presentation records.
3. Quest snapshots preserve only quest state and cannot support future quest creation or detailed quest mutation without expansion.
4. NPC behavior is covered through local and mocked-provider tests, but real Campaign Master quality and real provider behavior remain unverified.
5. Character creation is tested, but combat, inventory, authored quests, powers, party control, and a full playable campaign remain untested because those systems do not yet exist.

## Correct project position

Velmora currently has a functional local application shell, continuity scaffold, tested NPC Engine foundation, persistent single-player-character foundation, and core non-combat action resolution. It is not yet a complete playable D&D campaign engine and does not yet contain the complete DM Core, authored quests, combat, items, powers, party behavior, or sufficient generative campaign machinery.

## Required correction before further feature design

1. Maintain one feature ledger with the four statuses used in this audit.
2. Never describe design-only or partial features in the present tense.
3. Implement and test one dependency-complete vertical system before designing dependent behavior.
4. Continue from core action resolution into only the next dependency-safe layer; do not imply that non-combat checks constitute combat.
