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

## Remaining provisional choices requiring review

1. **Module rules and content:** The approved modular direction still needs rules for which ingredients may be created, combined, and validated. The current four formulas and generic text remain scaffolding.
2. **Thread concurrency:** A story thread may currently have only one unresolved quest.
3. **Follow-up structure:** A completed quest automatically becomes the prerequisite and link for the next quest on the same thread.
4. **Default failure:** Every composed quest currently defaults to recoverable failure using a generic neglect trigger.
5. **Recovery replacement:** A recoverably failed quest currently permits exactly one altered replacement using one exact recorded recovery path.
6. **Quest classifications:** Thread kinds automatically map to main, faction, side, personal, dynamic, and fragment quest types.
7. **Progression trigger:** A completed turning-point quest currently awards one advancement opportunity; the major-objective rule is unfinished.
8. **Per-turn limits:** The Campaign Master may currently generate at most two quests and manage at most four in one committed turn.
9. **Generic authored text:** Generated objective wording, stakes, outcomes, consequence seeds, and opening quest text are implementation-written scaffolding rather than approved content pools.

## Review order

Review decisions in dependency order:

1. Define module rules and content boundaries.
2. Review thread concurrency, follow-up linking, failure, and recovery.
3. Review quest classification, progression rewards, and Campaign Master limits.
4. Replace provisional text and formulas with approved generative rules and content boundaries.
5. Re-run sustained quest simulations before combat work begins.

## Implementation boundary

Until review is complete, the current quest composer proves storage and validation only. It is not the approved final campaign-flow generator. Later systems may rely on its data contracts, flexible objective graph, and safety boundaries, but not on its provisional story formulas, module text, thread concurrency, follow-up linkage, recovery cadence, or reward cadence.
