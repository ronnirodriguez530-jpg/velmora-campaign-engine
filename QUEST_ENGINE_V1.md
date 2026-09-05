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
- One to five objectives with validated dependency, parallel, branch, required, and optional structure
- Prerequisite quests and locked-to-available transitions
- Meaningful neglect triggers and warning signals
- Stakes, failure modes, recovery paths, and consequence seeds
- Creation, activation, objective updates, completion, and recoverable failure
- Atomic quest updates, event history, bounded context retrieval, save compatibility, and rollback

## Provisional checkpoint 2

The seeded quest composer turns an active story thread into a validated test structure. Its persistence and validation are working, but its campaign-shaping formulas remain provisional:

- The same campaign seed, source thread, and sequence always reproduce the same structure
- Different seeds select among reusable investigate, protect, negotiate, and recovery patterns
- Main, faction, side, personal, dynamic, and fragment types derive from the source thread
- Player-visible threads create available quests; hidden threads create locked Director-only quests
- Current locations, involved factions and NPCs, stage gates, and recovery paths carry forward
- Each source thread may have at most two unresolved quests at a time; the second slot is optional and may contain one meaningfully different alternative
- Follow-ups declare explicit prerequisite, parallel, optional-branch, or consequence relationships; no previous quest becomes a prerequisite automatically
- Every generated quest defaults to recoverable failure, meaningful neglect triggers, and exactly two outcomes

The composer now stores and validates route profiles. A second unresolved route must explicitly link to the first and differ through approach and tradeoff, allies or location, or moral or resource cost. It is never generated merely to fill capacity. The four formulas and authored placeholder text still require review before this becomes the approved campaign-flow generator.

## Approved checkpoint 3A

Quest advancement is paced through verified quest state. The first quest generated from a high-urgency thread may contain exactly one required major objective; completing it can award one advancement opportunity. A verified turning point can award after full completion and a recorded outcome. The quest ID is the unique reward source, so one quest cannot award twice through both routes.

## Working checkpoint 3B

The live Campaign Master can now request bounded quest operations through the validated turn pipeline:

- Generate an engine-owned quest from an active supplied story thread
- Make a locked quest available after its prerequisites and stage gate are satisfied
- Activate an available quest
- Complete or fail one currently active objective
- Complete a quest with exactly one recorded outcome
- Fail a recoverable quest only when it already contains a recovery path

A turn may generate one ordinary quest. Up to two new quests are allowed only when both are altered recovery routes; ordinary and recovery generation cannot be mixed in one turn. A turn may manage at most three quests, with each source thread or quest used only once. Quest completion and its requested faction, NPC, location, or story-thread consequences share the existing atomic world-turn transaction. If any requested change fails validation or execution, none of the quest or consequence changes commit.

## Working checkpoint 4

Recoverably failed quests can produce up to two simultaneously pursuable altered recovery quests:

- The failed quest remains permanently recorded as failed
- The new quest cites the exact failed quest and one of its recorded recovery paths
- The replacement inherits the same story thread, visibility, and maximum campaign stage
- Failed quests are linked as history, not treated as completed prerequisites
- Each altered quest must use a distinct exact recovery path recorded on the failed quest
- Each altered quest must cite 1-4 durable consequence events from the failure turn or later; the failure and a recovery-path sentence alone are insufficient
- Recovery may appear immediately after those consequences are committed or later when new consequences support a credible route
- The source thread's hard two-unresolved-quest cap always applies, so existing unresolved work reduces recovery capacity
- Unrecorded paths, premature recovery, duplicate paths, and attempts beyond two recoveries are rejected
- Hidden faction recovery remains Director-only
- Recovery generation participates in atomic world turns and one-turn rollback

Recovery therefore preserves forward motion without erasing consequences or letting the Campaign Master use failure to invent a different main plot.

## Approved route invalidation

An unresolved route remains open when another route completes. It may be marked failed only when 1-4 cited durable world-consequence events recorded since that route began make its premise impossible. The failed route remains in the journal with its reason and evidence references; it is never deleted or silently closed. This transition and its history are rollback-safe.

## Provisional opening behavior in checkpoint 5

The browser now exposes the player-visible quest ledger as a functional journal:

- New campaigns do not receive a formal opening quest until the approved player-clicked d6 start and First Speaker attack have occurred
- The future opening composer must use both the selected spawn and hidden opening crisis
- Available, active, changed, completed, and failed quests render with their real persistent state
- Quest cards show type, campaign stage, summary, ordered objectives, stakes, recovery provenance, and selected outcome when present
- The navigation badge counts genuinely actionable available, active, and changed quests
- Hidden Director-only and locked quests remain excluded through the player-context boundary

The journal itself is working engineering. It correctly remains empty before the formal opening quest exists.

## Approved review checkpoint 6

Review batch 1 establishes these permanent directions:

- The first formal quest begins after the d6 start and attack, using the selected spawn and hidden crisis.
- Quest construction recombines modular objectives, pressures, complications, and outcomes rather than selecting a fixed whole-quest formula.
- Objectives may be sequential, parallel, branching, or optional when appropriate.

The objective graph is implemented. Each objective records whether it is required, which objectives it depends on, and whether it belongs to a mutually exclusive branch group. Activating a quest exposes every ready objective, completing a branch skips unused alternatives, optional objectives do not block completion, and malformed or cyclic structures are rejected. The modular content rules remain under review.

## Branching rule

Normal quests have exactly two major outcomes. Only a marked turning-point quest backed by an urgency-three story thread may have three. Smaller variations belong in consequence state rather than additional major branches.

Questlines may link and require one another as a spiderweb. A player is not limited to one main questline.

## Failure and neglect rule

Inactivity alone never worsens a quest. A warning is recorded only when the player directly witnesses or is clearly told it, receives it from an established NPC, or encounters an obvious environmental warning. Neglect requires that received warning followed by a deliberate choice of another priority, or a recorded world event advancing the threat. Each neglect trigger must cite fresh evidence and pair atomically with exactly one bounded faction, NPC, location, or story-thread complication. Repeated neglect remains mild without verified exceptional stakes and cannot automatically create permanent failure.

Ordinary generated quests begin recoverable and require at least one recorded route forward. Permanent failure is reserved for a warned deadline, irreversible choice, or major world event. Permanent-failure execution remains withheld until those exceptional stakes can be verified from durable engine records.

## Authority boundaries

- A generated quest cannot invent a main plot; a main quest must descend from an existing main story thread.
- Every quest permanently inherits its classification from its source-thread kind; later story importance cannot reclassify it.
- A quest cannot exceed its source thread's visibility or campaign-stage range.
- Locked player quests remain outside player context until their prerequisites are satisfied and they become available.
- Director-only quests remain outside player narration.
- Quest consequence seeds remain proposals; the Campaign Master must express justified durable effects through validated tools in the same atomic turn.
- One designated major objective or a fully completed verified turning point can award progression, at most once per quest.

## Still required

- User review of the decisions recorded in `QUEST_ENGINE_DECISION_AUDIT.md`
- Live play validation of quest changes and recovery across sustained multi-scene sessions
