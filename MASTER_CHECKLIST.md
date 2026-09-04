# Velmora Master Checklist

This is the single top-level checklist for the entire Velmora campaign and application. Work proceeds in order. New ideas must be placed inside an existing section or explicitly added here before design or implementation begins.

## Status key

- **Working:** implemented and tested end to end.
- **Partial:** some real data or code exists, but the section is not complete.
- **Designed:** decisions or rules are recorded, but not implemented.
- **Missing:** required work has not been created.
- **Later:** deliberately excluded from the first playable release.

## Level 1 — Playable foundation

### 1. World canon — Complete foundation

- [x] Velmora premise, tone, Tear, Endless Surge, and survival premise
- [x] Six-wedge city structure and crown position
- [x] Six factions and their broad responsibilities
- [x] Sixfold Council and the unconscious First Speaker's removal from active leadership
- [x] Basic Tear rules and one-way crossing rule
- [x] Central Tear begins relatively small, grows through the campaign, and supports multiple possible approaches rather than one fixed outcome
- [x] Single central Tear may cause temporary void-rift wormholes from random worlds or locations, while remaining the only true Tear
- [x] Tear event generator may schedule arrivals and void-rift events but cannot create a second true Tear or general outward exploration routes
- [x] Void-rifts progress from chance events to selected entity-opened events and attempted controlled openings through the transformed First Speaker and containment system
- [x] Opening attack secretly begins the First Speaker's transformation by an unnamed crystalline void entity
- [x] First Speaker remains alive through a false recovery with brief complete-control episodes, missing memory, and gradually visible cracks
- [x] Entity influence is locked to the four campaign stages so sustained takeover and endgame authority cannot occur early
- [x] Order of Glass has no mandatory bargain or predetermined allegiance to the entity
- [x] Order of Glass rebuilt as a luxury civic facade governed underneath by a spy-and-thief guild
- [x] Order leader publicly serves on the Sixfold Council while secretly directing the guild; ordinary district life and officials remain intact
- [x] Order of Glass awareness fixed at 75% unaware, 15% speculative, 5% suspicious, and 5% informed but silent
- [x] Wayfarer Pact operates inside Velmora on objects emerging from the Tear rather than entering it
- [x] Magic may be innate, invented, magic-technological, discovered, taken, taught, or made
- [x] Highest-tier magic originates from the central Tear or its void-rifts, and no true magic masters currently exist
- [x] High-tier magic is controllable but initially costly and risky, with burden reducible through experience, technique, equipment, or magic-tech
- [x] Magical alterations may be temporary, treatable, permanent, or evolving and use a common/uncommon/rare Level 1-3 scale
- [x] Alterations may affect body, abilities, mind, or combinations and occur through bounded random eligible events rather than preset timing
- [x] Relics may be old-world survivors, void-rift arrivals, or newly created inside Velmora
- [x] Creatures originate only as altered native life or void-rift arrivals; manufactured species are excluded from the base
- [x] Rare Level 3 abilities arise through approved opportunities and sources, never automatic random assignment; permanent player acquisition requires choice and approval
- [x] Each faction leader also serves as that faction's Sixfold Council representative
- [x] First Speaker and six faction leaders are variable campaign-generated identities attached to persistent fixed offices
- [x] Fortified containment zone exists around the central Tear under the public justification of safety
- [x] Containment is guarded by an independent force attached to the First Speaker's office rather than a faction force
- [x] First Speaker's senior deputy maintains operational command of containment and routine administration after the attack without inheriting the Speaker's political authority
- [x] Six faction leaders collectively hold political authority until a replacement First Speaker is chosen
- [x] Hybrid containment design: wall, six controlled gates, circulation road, and magical anchors
- [x] Engine-readable district positions, palettes, environments, ways of life, and landmarks for all six faction wedges
- [x] First Speaker's senior deputy represented as an essential variable NPC slot rather than a ghost role
- [x] Approved top-level city geography, district order, initial landmarks, neutral axis, and containment design
- [x] Canon review confirming contradictions are removed and later decisions are assigned to their proper sections

### 2. Generative campaign structure and protected story canon — Partial

- [x] Generative opening-pressure foundation connected to the initial scene without exposing the hidden campaign blueprint
- [x] Opening convergence and witnessed inciting event: public address in Council Plaza during the First Speaker's attack and the Surge's failure to end
- [x] Six fully concrete, engine-validated Council Crown spawn situations mapped to permanent d6 results
- [ ] Player-clicked opening d6 selection and saved outcome, implemented with the core dice system
- [x] Variable opening conflict over replacing the incapacitated First Speaker
- [ ] Replacement candidates and selection events generated from approved campaign conditions rather than one preset outcome
- [x] First Speaker's hidden transformation, false recovery, intermittent control, and escalating influence established as a campaign conflict
- [x] Stage-dwell pacing floor prevents rapid faction progress from reaching Resolution before 48 meaningful player turns
- [ ] Approved pools and stage rules for transformation clues, interventions, consequences, and possible outcomes
- [x] Seeded, stage-gated campaign blueprint foundation with variable opening pressure, focal faction tension, three clue routes, a later reversal, and a Resolution-only endgame gate
- [x] Persistent story-thread ledger foundation with visibility, stage, location, urgency, recovery-path, and rollback-safe records
- [x] Validated Director tools for activating, advancing, blocking, resolving, failing, and replacing story threads during play
- [x] Replacement routes must consume a recorded recovery path and inherit the source thread's visibility and stage gates
- [x] Validated creation of new player goals, witnessed consequences, NPC commitments, faction developments, and branches from existing threads during play
- [x] Created-thread provenance records the exact player input, location, NPC, faction, or source thread that caused it
- [x] Live creation cannot invent a new main plot, bypass the protected First Speaker arc, change visibility rules, or exceed current stage authority
- [x] Unresolved generated threads are capped and retrieved through the existing bounded relevance context
- [x] Main-quest generator using approved canon, campaign conditions, and player-created goals
- [x] Faction-quest generator using faction agendas, local pressures, relationships, and current state
- [x] Reusable side-quest generator with objective, stakes, failure conditions, recovery routes, and consequences
- [ ] Scene composer connected to active threads, quests, NPCs, factions, locations, and consequences
- [ ] Choice junctions, consequences, failures, and recovery paths generated and validated during play
- [ ] Final-truth candidates and player-choice resolution
- [ ] End states that preserve player agency
- [x] Minimum opening authority cast fixed at the First Speaker, senior deputy, and six faction leaders, with identities generated per campaign
- [ ] Additional recurring roles created on demand when generated questlines require them

### 3. Locations and world content — Partial

- [x] Nine top-level locations and connection graph
- [x] Validated movement between connected locations
- [x] District identities, functions, map positions, palettes, ways of life, and one foundation landmark each
- [ ] Additional district risks and points of interest required by the opening campaign
- [ ] Interiors and sublocations needed by the opening campaign
- [x] Top-level location context and current/connected-location perspective filtering
- [ ] Mechanically usable Tear creatures, altered life, magical events, relics, and fragments
- [x] Initial power families, high-tier rift directions, creature roster, set-piece reserve, and creature name bank curated in `content/velmora/POWER_CREATURE_CATALOG.md`
- [x] Foundation relics, high-tier rift relics, institutional magic-tech, and scrap-magic equipment curated in `content/velmora/RELIC_MAGIC_TECH_CATALOG.md`
- [ ] Content placement rules that keep expansion inside Velmora

### 4. Base software engine — Working foundation

- [x] Local Node.js application and browser server
- [x] SQLite campaign saves
- [x] World-state storage and event history
- [x] Scene placement, persistence, and reuse
- [x] Player movement validation
- [x] Atomic turns, checkpoints, and one-turn rollback
- [x] Local and cloud Director boundaries
- [x] Bounded multi-path simulation test runner
- [ ] Complete rollback coverage for every future system
- [ ] Stable data contracts for every remaining module

### 5. Player character and party — Partial

- [x] Player-character identity and creation flow
- [x] Character sheet and persistent character state
- [x] Attributes, modifiers, skills, proficiencies, and saves
- [ ] Health, defense, conditions, death, rest, and recovery
- [ ] Background, role, faction ties, and starting equipment
- [x] Single-character control for the first release
- [ ] Party membership and later party-control boundary

Implemented health scope: starting/current HP and unarmored Defense are derived and persisted. Conditions, damage, death, rest, recovery, armor, and equipment effects do not exist yet.

### 6. NPC Engine — Working foundation

- [x] Persistent NPC records and storage categories
- [x] Bounded NPC creation and novelty protection
- [x] Memories, knowledge, beliefs, and relationships
- [x] Status, movement, involvement, lifecycle, and archival
- [x] Perspective-aware NPC Context Gate
- [x] NPC Turn Manager and rollback coverage
- [ ] Restricted-fact reveal events
- [ ] High-consequence NPC death resolution
- [ ] Essential authored NPC identities and personalities
- [ ] Faction-specific generation constraints for the First Speaker, senior deputy, and six faction-leader offices
- [ ] Real-provider NPC behavior playtest

### 7. Core action and dice rules — Working foundation

- [x] Player-clicked dice roller and stored roll records
- [x] Difficulty levels and outcome bands
- [x] Advantage and disadvantage
- [x] Attribute, skill, proficiency, and saving-throw resolution
- [x] Clear boundary between automatic actions and required rolls
- [x] Failure outcome contract requires proportional consequences and recovery routes instead of routine dead ends

The exact DC remains Director-only. Pending checks survive refreshes, resolved dice cannot be rerolled, and historical roll records do not enter ordinary story context. Real-provider narrative quality is still unverified.

### 8. Combat and encounters — Designed

- [ ] Theater-of-the-mind encounter state
- [ ] Quick, standard, and set-piece combat modes
- [ ] Initiative and player-facing turn flow
- [ ] Condensed handling for groups and supporting NPCs
- [ ] Actions, targets, damage, defense, conditions, and defeat
- [ ] Creature behavior and encounter resolution
- [ ] Escape, surrender, negotiation, and non-combat solutions
- [ ] Approximately 65/35 story-to-combat pacing target

### 9. Powers, magic, and abilities — Partial

- [x] Authored power idea bank consolidated into bounded families and restricted-later concepts
- [x] Minimum engine-readable ability and power catalog with seven bounded definitions
- [x] Persistent character power ownership, acquisition source, activation state, event history, context retrieval, and rollback
- [ ] Costs, limits, risks, duration, and sustained effects
- [ ] New-magic boundaries with no existing masters
- [x] Validated Level 3 Tear/void-rift source and explicit player-approval gate
- [x] Initial movement-power boundaries prevent outward Tear travel and unrestricted portals
- [ ] Player approval process for newly proposed abilities
- [ ] Power scaling that does not break the campaign

Implemented power scope: one sustained magical effect may be active at a time, and activating another ends the first. Instant and fixed-duration effects do not use that slot. Damage interruption, unconsciousness, combat values, proposal UI, and upgrades remain unavailable until their prerequisite systems exist. See `POWER_SYSTEM_V1.md`.

### 10. Inventory, equipment, and economy — Partial

- [x] Initial relic and magic-tech idea bank curated with base, restricted, and later categories
- [x] Minimum engine-readable item catalog spanning weapons, armor, shields, consumables, tools, relics, and quest items
- [x] Persistent item ownership, bounded quantities, acquisition source, event history, context retrieval, and rollback
- [x] Equipment slots, slot replacement, and bounded defense recalculation
- [x] Consumable quantity handling without inventing healing effects
- [x] Initial relic classification and persistent ownership
- [ ] Combat, healing, charge, durability, and other equipment-use effects
- [ ] Faction goods and basic city economy
- [ ] Rewards, scarcity, acquisition, loss, and recovery

Implemented item scope: eight bounded definitions prove every first-release item category. Weapons have no damage yet, consumables have no healing value, and the economy does not exist. See `ITEM_SYSTEM_V1.md`.

### 11. Advancement — Working foundation

- [x] Story-driven first-release milestone progression method
- [x] Persistent unique milestone, advancement-total, and improvement-history storage
- [x] Explicit player approval before advancement spending
- [x] Ability-score and new-skill improvement boundaries with an ability cap of 18
- [x] Derived ability modifiers, health, and defense recalculated after improvement
- [x] Player-context retrieval, save compatibility, and one-turn rollback
- [ ] Ability and equipment progression connections
- [ ] Later skill-tree module kept separate until prerequisites exist

Implemented progression scope: each unique validated major milestone awards one advancement opportunity. The Quest Engine can verify completed turning-point sources; major-objective designation remains unfinished. See `PROGRESSION_SYSTEM_V1.md`.

### 12. Quest Engine — Partial

- [x] Basic quest-instance table
- [x] Strict generated-quest data contract with stable IDs and existing story-thread provenance
- [x] Persistent creation, prerequisite availability, activation, objective updates, completion, and recoverable failure
- [x] Objectives, stakes, prerequisites, meaningful neglect triggers, warnings, recovery paths, and consequence seeds
- [x] Exactly two major outcomes for normal quests and three only for urgency-backed turning points
- [x] Main, faction, side, personal, dynamic, and fragment classification
- [x] Player and Director perspective filtering with bounded retrieval
- [x] Complete quest-ledger snapshot, rollback, and legacy snapshot compatibility
- [x] Seeded main, faction, side, personal, dynamic, and fragment quest generation from active story threads
- [x] Campaign Master quest tools and atomic outcome/consequence application
- [x] Verified turning-point rewards and altered recovery-quest generation
- [ ] Major-objective milestone designation and rewards
- [ ] Functional Quest page and actionable notifications

Implemented quest scope: the durable contract, lifecycle, seeded reusable composer, bounded Campaign Master controls, and altered recovery generation work. Quest outcomes and justified world consequences commit together through the atomic turn pipeline. Failed approaches remain recorded while one linked recovery route preserves the source thread, visibility, and stage ceiling. Permanent failure remains blocked until warned deadlines, irreversible choices, and major world events can be verified from engine records. See `QUEST_ENGINE_V1.md`.

Verified progression bridge: a completed preapproved turning-point quest with a recorded outcome can award one advancement opportunity. Ordinary or incomplete quests and duplicate awards are rejected. Major-objective designation and recovery-quest replacement remain unfinished.

### 13. Faction Engine — Partial scaffold

- [x] Six faction definitions and basic conditions
- [x] Provisional faction-path counters
- [ ] Faction relationships and political pressures
- [ ] Leaders, agents, assets, goods, and territory
- [ ] Faction goals, milestones, quests, and consequences
- [ ] Player reputation and allegiance effects
- [ ] Conflict that can divide cooperation without forcing collapse
- [ ] Actionable faction events and perspective filtering

### 14. Tear and Surge Engine — Partial scaffold

- [x] Provisional bounded deterministic arrival generator
- [ ] Approved frequency and rarity rules
- [ ] Actual payload catalog and placement logic
- [ ] Simple bounded alteration-event generator using approved level, affected-area, and effect entries
- [ ] Creatures, magical effects, altered life, relics, and fragments
- [x] Initial altered-native and void-arrival creature content curated without adding a third manufactured-creature origin
- [ ] Surge escalation and Endless Surge behavior
- [ ] Player-driven rhythm and consequence rules
- [ ] Safety limits preventing uncontrolled content expansion
- [ ] Tear events connected to quests, factions, locations, and truth paths

### 15. Campaign Master / DM Core — Partial and designed

- [x] Local Director boundary
- [x] Strict cloud-provider request and response adapter
- [x] Engine validation before world changes are committed
- [x] Basic story presentation storage
- [ ] Complete DM operating rules
- [ ] Scene narration connected to quests, characters, factions, and consequences
- [x] Player-known and Director-only story-thread retrieval separated so hidden planning truth is not sent to scene narration
- [x] Hidden campaign blueprint retrieval included only in Director planning context
- [x] Campaign Master thread-control requests are bounded to four per turn and committed atomically with rollback support
- [ ] Proper use of rolls, combat, abilities, items, and player freedom
- [ ] Rules and campaign reference retrieval
- [ ] Approved story-craft reference library for quests, mysteries, factions, consequences, pacing, and recovery
- [ ] Examples and evaluation tests for coherent long-form DM behavior
- [ ] Complete evaluation set for callbacks, varied paths, failure recovery, and stage-gated endgame pacing
- [x] Mechanical tests for thread continuity, recovery-path replacement, hidden-context isolation, stage gates, rollback, and growing thread history
- [ ] Recovery when provider output is invalid or repetitive
- [ ] Real-provider end-to-end playtest

### 16. Player freedom and special modes — Designed

- [ ] Contextual suggested actions without restricting free input
- [ ] Silly Mode toggle
- [ ] Temporary and permanent player-authored overrides
- [ ] Override history and canon separation
- [ ] Guardrails that allow creativity without corrupting saves

### 17. Browser interface — Partial

- [x] High-contrast application shell and navigation
- [x] Story, Factions, Locations, History, and Settings show limited real data
- [x] Functional Character page
- [ ] Functional Quest page
- [ ] Functional Inventory page
- [ ] Clean location and world-state presentation
- [ ] Dice popup and contextual action control
- [ ] Progressive combat interface
- [ ] NPC and relationship presentation where relevant
- [ ] Actionable badges based on genuine events
- [ ] Accessibility, keyboard use, readable scaling, and error feedback

## Level 2 — Reliable application

### 18. Data integrity and compatibility — Partial

- [x] SQLite persistence and named campaign reopening
- [x] Atomic commits and existing checkpoint rollback
- [ ] Schema versioning and migrations
- [ ] Backward-compatible save upgrades
- [ ] Save export, import, backup, and recovery
- [ ] Validation for all authored and generated data
- [ ] Orphan-record cleanup and complete rollback rules

### 19. Testing and quality assurance — Partial

- [x] Current automated suite passes 88 of 88 tests
- [x] Isolated multi-path Simulation Runner
- [ ] Tests for player characters, quests, combat, items, powers, and progression
- [ ] Full-campaign multi-path simulations
- [ ] Real-provider behavior and regression evaluations
- [ ] Browser interaction and accessibility testing
- [ ] Save migration, corruption recovery, and updater testing
- [ ] Full performance and long-campaign endurance testing
- [x] Initial 60-turn growing thread-history stress test keeps relevant Director context bounded
- [x] Multi-path pacing test verifies campaigns remain below Resolution through turn 47 and become eligible at turn 48

### 20. API configuration and security — Partial

- [x] Local API-key setting route and cloud adapter
- [ ] Verified live API connection
- [ ] Safe local credential storage
- [ ] Request limits, timeouts, retry rules, and cost controls
- [ ] Provider failure and offline behavior
- [ ] Input validation and prompt-injection boundaries
- [ ] Clear separation between narration and engine authority

### 21. Performance and context control — Partial

- [x] Current-location perspective filtering
- [x] NPC relevance ranking and detail budgets
- [ ] Context gates for quests, locations, factions, items, secrets, and memory
- [ ] Long-campaign archive and retrieval strategy
- [ ] Database indexing and performance limits
- [ ] Provider context and output budgets
- [ ] Stress testing for large NPC casts and long histories

### 22. Updates and version control — Working foundation

- [x] GitHub repository and version history
- [x] Public update manifest and local updater
- [x] Save and configuration protection during updates
- [ ] Update verification and failed-update recovery
- [ ] Release notes and stable version procedure
- [ ] Save migration tied to application versions

### 23. Installation, deployment, and documentation — Partial

- [x] Local Node.js browser launch path
- [ ] One clear installation procedure
- [ ] One-command launch or desktop shortcut
- [ ] Environment and live-API setup guide
- [ ] Troubleshooting and recovery guide
- [ ] Optional hosted or packaged application plan
- [ ] Maintainer documentation for future modifications

## Level 3 — Advanced future systems

### 24. Adaptive Campaign Master — Later

- [ ] Player preference profile
- [ ] Pacing and style adaptation
- [ ] Repetition detection and correction
- [ ] Approved reference-library expansion
- [ ] Evaluation before behavioral changes are accepted
- [ ] Adaptation that cannot rewrite protected canon or rules

### 25. Autonomous world — Later

- [ ] Independent faction and NPC activity between player actions
- [ ] World clock and scheduled events
- [ ] Off-screen consequence resolution
- [ ] Player-relevance filtering
- [ ] Bounded simulation frequency and scope
- [ ] Catch-up summaries when the player returns
- [ ] Protection against runaway changes or endless generation

### 26. Expansion framework — Later

- [ ] Modular additions for creatures, powers, relics, quests, and locations
- [ ] Content packs that preserve the compact-city boundary
- [ ] Compatibility and dependency validation
- [ ] Canon, optional content, and player-created content separation
- [ ] Party control and other major expansions only after the base game is stable

## Fixed work order

1. Reconcile project records and keep this checklist as the source of truth.
2. Finish the minimum protected world canon and implement the generative campaign blueprint/story-thread foundation.
3. Build the player-character foundation.
4. Implement core action and dice resolution.
5. Establish and implement the minimum powers, items, and progression data.
6. Build the generative Quest Engine and validated reusable quest structures.
7. Build the minimum combat vertical slice.
8. Connect factions, Tear events, locations, and NPCs to quests and consequences.
9. Complete the DM Core using only systems that actually exist.
10. Finish the browser interfaces for those systems.
11. Run local multi-path, rollback, browser, and endurance tests.
12. Connect and evaluate the live Campaign Master.
13. Complete installation, security, updates, and release checks.
14. Declare the first playable release complete.
15. Consider adaptive and autonomous systems only afterward.

## Current position

Velmora has completed the working foundations through step 5 and the core Quest Engine slices of step 6. The strict quest contract, persistent lifecycle, seeded thread-to-quest composition, bounded Campaign Master controls, atomic outcome consequences, altered recovery quests, two/three-outcome rule, prerequisites, visibility separation, failure boundaries, context retrieval, save compatibility, rollback, and verified turning-point progression awards now exist. Major-objective awards, the Quest page, combat, and the complete DM Core do not yet exist.

## Checkpoint discipline

Each completed implementation section must update this checklist, pass the full automated suite, receive a local Git commit, and be pushed to the public GitHub `main` branch before the section is reported complete. Partial work must remain clearly marked partial and must not be described as playable functionality.
