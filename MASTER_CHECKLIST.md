# Velmora Master Checklist

This is the single top-level checklist for the entire Velmora campaign and application. Work proceeds in order. New ideas must be placed inside an existing section or explicitly added here before design or implementation begins.

## Status key

- **Working:** implemented and tested end to end.
- **Partial:** some real data or code exists, but the section is not complete.
- **Designed:** decisions or rules are recorded, but not implemented.
- **Missing:** required work has not been created.
- **Later:** deliberately excluded from the first playable release.

## Level 1 — Playable foundation

### 1. World canon — Partial

- [x] Velmora premise, tone, Tear, Endless Surge, and survival premise
- [x] Six-wedge city structure and crown position
- [x] Six factions and their broad responsibilities
- [x] Sixfold Council and the unconscious First Speaker's removal from active leadership
- [x] Basic Tear rules and one-way crossing rule
- [x] Central Tear begins relatively small, grows through the campaign, and supports multiple possible approaches rather than one fixed outcome
- [x] Single central Tear may cause temporary void-rift wormholes from random worlds or locations, while remaining the only true Tear
- [x] Tear event generator may schedule arrivals and void-rift events but cannot create a second true Tear or general outward exploration routes
- [x] Void-rifts progress from chance events to selected entity-opened events and eventually controlled Order of Glass openings without traversal
- [x] Order of Glass is unknowingly empowered by an unnamed void entity whose bargain increasingly corrupts its informed leader
- [x] Wayfarer Pact operates inside Velmora on objects emerging from the Tear rather than entering it
- [ ] Canon boundaries for magic, alteration, relics, creatures, and rare abilities
- [ ] Named faction leadership and essential recurring characters
- [ ] Final approved city geography, districts, interiors, important landmarks, and containment infrastructure
- [ ] Canon review confirming contradictions and open decisions

### 2. Campaign structure and authored content — Missing

- [ ] Campaign premise and playable opening
- [x] Variable opening conflict over replacing the incapacitated First Speaker
- [ ] Replacement candidates and selection events generated from approved campaign conditions rather than one preset outcome
- [x] Order of Glass leader's hidden bargain and escalating influence established as a campaign conflict
- [ ] Order bargain branches, interventions, consequences, and possible outcomes
- [ ] Major campaign spine with acts or stages
- [ ] Multiple main-quest paths
- [ ] Six faction questlines
- [ ] Reusable side-quest structure and initial authored side quests
- [ ] Choice junctions, consequences, failures, and recovery paths
- [ ] Final-truth candidates and player-choice resolution
- [ ] End states that preserve player agency
- [ ] Minimum recurring cast required by the campaign

### 3. Locations and world content — Partial

- [x] Nine top-level locations and connection graph
- [x] Validated movement between connected locations
- [ ] District identities, functions, risks, and points of interest
- [ ] Interiors and sublocations needed by the opening campaign
- [ ] Location context and perspective filtering
- [ ] Actual Tear creatures, altered life, magical events, relics, and fragments
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

### 5. Player character and party — Missing

- [ ] Player-character identity and creation flow
- [ ] Character sheet and persistent character state
- [ ] Attributes, modifiers, skills, proficiencies, and saves
- [ ] Health, defense, conditions, death, rest, and recovery
- [ ] Background, role, faction ties, and starting equipment
- [ ] Single-character control for the first release
- [ ] Party membership and later party-control boundary

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
- [ ] Real-provider NPC behavior playtest

### 7. Core action and dice rules — Designed

- [ ] Player-clicked dice roller and stored roll records
- [ ] Difficulty levels and outcome bands
- [ ] Advantage and disadvantage
- [ ] Attribute, skill, proficiency, and saving-throw resolution
- [ ] Clear boundary between automatic actions and required rolls
- [ ] Failure that creates consequences without routinely stopping play

### 8. Combat and encounters — Designed

- [ ] Theater-of-the-mind encounter state
- [ ] Quick, standard, and set-piece combat modes
- [ ] Initiative and player-facing turn flow
- [ ] Condensed handling for groups and supporting NPCs
- [ ] Actions, targets, damage, defense, conditions, and defeat
- [ ] Creature behavior and encounter resolution
- [ ] Escape, surrender, negotiation, and non-combat solutions
- [ ] Approximately 65/35 story-to-combat pacing target

### 9. Powers, magic, and abilities — Missing

- [ ] Ability and power catalog
- [ ] Character ability ownership
- [ ] Costs, limits, risks, duration, and sustained effects
- [ ] New-magic boundaries with no existing masters
- [ ] Rare Tear-linked abilities and one-way teleportation boundary
- [ ] Player approval process for newly proposed abilities
- [ ] Power scaling that does not break the campaign

### 10. Inventory, equipment, and economy — Missing

- [ ] Item and inventory storage
- [ ] Weapons, armor, shields, consumables, and quest items
- [ ] Equipment effects and usage rules
- [ ] Relic classification and ownership
- [ ] Faction goods and basic city economy
- [ ] Rewards, scarcity, acquisition, loss, and recovery

### 11. Advancement — Missing

- [ ] Simple first-release progression method
- [ ] XP or milestone event storage
- [ ] Character improvement boundaries
- [ ] Ability and equipment progression connections
- [ ] Later skill-tree module kept separate until prerequisites exist

### 12. Quest Engine — Partial scaffold

- [x] Basic quest-instance table
- [ ] Authored quest data format
- [ ] Creation, discovery, activation, update, completion, and failure
- [ ] Objectives, branches, prerequisites, and consequences
- [ ] Main, faction, and side-quest classification
- [ ] Quest perspective filtering and Campaign Master tools
- [ ] Quest rollback and save compatibility
- [ ] Functional Quest page and actionable notifications

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
- [ ] Creatures, magical effects, altered life, relics, and fragments
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
- [ ] Proper use of rolls, combat, abilities, items, and player freedom
- [ ] Rules and campaign reference retrieval
- [ ] Examples and evaluation tests for good DM behavior
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
- [ ] Functional Character page
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

- [x] Current automated suite passes 36 of 36 tests
- [x] Isolated multi-path Simulation Runner
- [ ] Tests for player characters, quests, combat, items, powers, and progression
- [ ] Full-campaign multi-path simulations
- [ ] Real-provider behavior and regression evaluations
- [ ] Browser interaction and accessibility testing
- [ ] Save migration, corruption recovery, and updater testing
- [ ] Performance and long-campaign endurance testing

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
2. Finish the minimum world canon and campaign spine.
3. Build the player-character foundation.
4. Implement core action and dice resolution.
5. Establish and implement the minimum powers, items, and progression data.
6. Build the Quest Engine and initial authored quests.
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

Velmora is currently between steps 1 and 2. The world foundation, application shell, persistence layer, and NPC Engine foundation exist. The campaign spine, player character, quests, combat, powers, items, progression, and complete DM Core do not yet exist.
