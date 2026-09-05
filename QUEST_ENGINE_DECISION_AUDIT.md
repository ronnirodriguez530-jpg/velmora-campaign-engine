# Velmora Quest Engine Decision Audit

This audit separates protected user-approved direction, implementation-only machinery, and campaign-shaping choices that were implemented without explicit approval. The unapproved choices remain provisional scaffolding until reviewed. They are not canon and may not be used as dependencies for later creative systems.

## Approved direction

- Velmora uses a spiderweb of main, faction, and side paths rather than one linear questline.
- Normal quests support two major outcomes. A marked turning point may support a third.
- Generated quests must arise from existing story threads and cannot invent a new main plot.
- Quests carry objectives, stakes, failure conditions, recovery routes, and consequences without requiring prewritten scene prose.
- Inactivity alone does not worsen a quest. Neglect requires a recorded meaningful trigger.
- Routine failure preserves a route forward. Permanent failure requires a warned deadline, irreversible choice, or major world event.
- Quest visibility and stage gates cannot expose secrets or launch later campaign material early.
- The engine creates moment-to-moment scenes, dialogue, complications, and connective story during play; the user is not required to author scenes.

## Engineering that does not establish campaign content

- Stable quest, objective, and outcome identifiers.
- SQLite persistence, event history, save compatibility, atomic transactions, and rollback.
- Player-known and Director-only filtering.
- Validation of referenced threads, locations, factions, NPCs, facts, prerequisites, stages, and visibility.
- A browser journal that displays only persistent player-known quests and genuine quest state.
- Runtime rejection of malformed or unauthorized quest changes.

## Approved in review batch 1

- **Opening quest timing:** The first formal quest is created only after the player-clicked d6 start and the First Speaker's attack, using both the selected spawn and hidden opening crisis. Automatic quest creation at browser campaign creation has been removed.
- **Quest construction:** The approved generator direction recombines modular objectives, pressures, complications, and outcomes rather than selecting one fixed beginning-to-end formula. The old four formulas remain provisional until their replacement module rules and content are reviewed.
- **Objective flow:** Quest objectives may be sequential, parallel, branching, or optional when appropriate. The engine now stores dependencies, required status, branch groups, and skipped alternatives; it rejects cycles and malformed branches.

## Approved in review batch 2

- **Thread concurrency:** Each story thread has a hard cap of two simultaneous unresolved quests: one primary route and one alternative. Completed and failed quests remain as history but do not consume the cap. Runtime validation enforces the limit even when quest creation bypasses the seeded composer.
- **Meaningful primary/alternative distinction:** The second slot is permission, not a quota. A second unresolved route must explicitly link to the first as parallel or optional and differ through at least one approved dimension: approach and tradeoff, allies or location, or moral or resource cost. If no credible distinction exists, the engine leaves the slot empty and explains any impossible player proposal through a specific established in-world reason rather than inventing an obstacle.
- **Recovery routes:** A recoverably failed quest may generate at most two altered routes from distinct recovery paths recorded on that quest. Both routes may remain pursuable. They still share the source thread's hard cap of two unresolved quests, so existing unresolved work reduces available recovery capacity.
- **Follow-up causality:** Follow-ups use explicit prerequisite, parallel, optional-branch, or consequence relationships according to the referenced quest's actual state. Completing one route does not automatically close another unresolved route; it remains unless a validated consequence makes its premise impossible.
- **Recovery evidence and timing:** An altered route requires a recorded recoverable failure plus at least one durable faction, NPC, location, progression, or story-thread consequence from that failure turn or later. A route may appear as soon as this evidence exists or after later consequences create a credible opening; a recorded recovery-path sentence alone is insufficient.
- **Route invalidation:** Completing one route never silently removes another. When recorded durable world consequences make an unresolved route impossible, the Campaign Master must cite 1-4 exact consequence events and mark the route failed. The journal preserves the route, failure reason, and evidence references; rollback restores its earlier state.
- **Default failure:** Ordinary generated quests begin recoverable. Permanent failure remains reserved for verified, previously established warned deadlines, irreversible choices, or major world events; the engine cannot currently execute it without that future authority layer.
- **Meaningful neglect:** Simple elapsed turns never count. A received warning is recorded only when directly witnessed or clearly told, delivered by an established NPC, or made obvious by the environment. Neglect then requires either that warning followed by the player's deliberate choice of another priority or a recorded world event advancing the threat. Each trigger requires fresh evidence and applies exactly one bounded complication. Repeated neglect remains mild without separately verified exceptional stakes.

## Remaining provisional choices requiring review

1. **Module rules and content:** The approved modular direction still needs rules for which ingredients may be created, combined, and validated. The current four formulas and generic text remain scaffolding.
2. **Recovery content:** Evidence, timing, maximum, distinct paths, simultaneous pursuit, and thread-cap interaction are approved. Module rules must still prove that generated altered routes are meaningfully different and caused by the cited consequences.
3. **Quest classifications:** Thread kinds automatically map to main, faction, side, personal, dynamic, and fragment quest types.
4. **Progression trigger:** A completed turning-point quest currently awards one advancement opportunity; the major-objective rule is unfinished.
5. **Per-turn limits:** The Campaign Master may currently generate at most two quests and manage at most four in one committed turn.
6. **Generic authored text:** Generated objective wording, stakes, outcomes, consequence seeds, and opening quest text are implementation-written scaffolding rather than approved content pools.

## Review order

Review decisions in dependency order:

1. Define module rules and content boundaries.
2. Review thread concurrency, follow-up linking, failure, and recovery.
3. Review quest classification, progression rewards, and Campaign Master limits.
4. Replace provisional text and formulas with approved generative rules and content boundaries.
5. Re-run sustained quest simulations before combat work begins.

## Implementation boundary

Until review is complete, the current quest composer proves storage and validation only. It is not the approved final campaign-flow generator. Later systems may rely on its data contracts, flexible objective graph, and safety boundaries, but not on its provisional story formulas, module text, thread concurrency, follow-up linkage, recovery cadence, or reward cadence.
