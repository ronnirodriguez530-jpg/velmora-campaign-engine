# Velmora Quest Engine V1

## Purpose

Quests are generated campaign structures, not prewritten scene scripts. They organize objectives, choices, stakes, consequences, and recovery while the Campaign Master creates the moment-to-moment story from current world state.

## Working checkpoint 1

The first quest checkpoint provides:

- Persistent main, faction, side, personal, dynamic, and fragment quest records
- Stable quest, objective, and outcome identifiers
- Required origin in an existing persistent story thread
- Player-visible and Director-only quest separation
- Stage ranges inherited from the source thread
- Issuer, location, faction, NPC, linked-quest, and truth-evidence links
- One to five ordered objectives
- Prerequisite quests and locked-to-available transitions
- Meaningful neglect triggers and warning signals
- Stakes, failure modes, recovery paths, and consequence seeds
- Creation, activation, objective updates, completion, and recoverable failure
- Atomic quest updates, event history, bounded context retrieval, save compatibility, and rollback

## Working checkpoint 2

The seeded quest composer now turns any active story thread into a validated quest structure:

- The same campaign seed, source thread, and sequence always reproduce the same structure
- Different seeds select among reusable investigate, protect, negotiate, and recovery patterns
- Main, faction, side, personal, dynamic, and fragment types derive from the source thread
- Player-visible threads create available quests; hidden threads create locked Director-only quests
- Current locations, involved factions and NPCs, stage gates, and recovery paths carry forward
- Each source thread may have only one unresolved quest at a time
- Completed quests become prerequisites and links for later quests on the same thread
- Every generated quest defaults to recoverable failure, meaningful neglect triggers, and exactly two outcomes

The composer supplies story structure rather than finished prose. The Campaign Master remains responsible for interpreting objectives through the live world state and player choices.

## Working checkpoint 3A

Completed turning-point quests can now award one advancement opportunity through a verified quest record. The award requires a completed quest, a selected recorded outcome, and the preapproved turning-point flag. Incomplete and ordinary quests cannot award progression automatically, and duplicate source awards remain blocked.

## Working checkpoint 3B

The live Campaign Master can now request bounded quest operations through the validated turn pipeline:

- Generate an engine-owned quest from an active supplied story thread
- Make a locked quest available after its prerequisites and stage gate are satisfied
- Activate an available quest
- Complete or fail one currently active objective
- Complete a quest with exactly one recorded outcome
- Fail a recoverable quest only when it already contains a recovery path

A turn may generate at most two quests and manage at most four, with each source thread or quest used only once per turn. Quest completion and its requested faction, NPC, location, or story-thread consequences share the existing atomic world-turn transaction. If any requested change fails validation or execution, none of the quest or consequence changes commit.

## Branching rule

Normal quests have exactly two major outcomes. Only a marked turning-point quest backed by an urgency-three story thread may have three. Smaller variations belong in consequence state rather than additional major branches.

Questlines may link and require one another as a spiderweb. A player is not limited to one main questline.

## Failure and neglect rule

Inactivity alone never worsens a quest. A quest may react to neglect only through one of its recorded meaningful triggers.

Recoverable failure requires at least one recorded route forward. Permanent failure is reserved for a warned deadline, irreversible choice, or major world event. Checkpoint 1 deliberately withholds permanent-failure execution until those causes can be verified from durable engine records.

## Authority boundaries

- A generated quest cannot invent a main plot; a main quest must descend from an existing main story thread.
- A quest cannot exceed its source thread's visibility or campaign-stage range.
- Locked player quests remain outside player context until their prerequisites are satisfied and they become available.
- Director-only quests remain outside player narration.
- Quest consequence seeds remain proposals; the Campaign Master must express justified durable effects through validated tools in the same atomic turn.
- Only completed preapproved turning points can currently award quest progression automatically.

## Still required

- Altered recovery-quest replacement
- Major-objective milestone designation and awards
- Quest notifications and browser page
