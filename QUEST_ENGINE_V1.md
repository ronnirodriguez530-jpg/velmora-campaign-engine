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
- Quest consequence seeds describe possible durable changes but do not apply them without validated engine tools.
- Quest completion does not yet award progression automatically.

## Still required

- Seeded reusable quest composer using current story threads and campaign conditions
- Specialized main, faction, and side-quest generation
- Validated Campaign Master quest tools
- Consequence application and recovery-quest replacement
- Verified milestone rewards from completed turning points or major objectives
- Quest notifications and browser page
