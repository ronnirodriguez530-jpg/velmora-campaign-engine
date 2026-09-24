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

## Approved modular composer

The seeded quest composer turns an active story thread into a validated structure:

- The same campaign seed, source thread, and sequence always reproduce the same structure
- Causal state selects from tagged discover, influence, secure, and change objective modules; the seed breaks valid ties
- Opposition, instability, scarcity, and conflict pressures must have a traceable cause
- New-information, changed-access, third-party, and bounded-cost complications must be causal and proportional
- Main, faction, side, personal, dynamic, and fragment types derive from the source thread
- Player-visible threads create available quests; hidden threads create locked Director-only quests
- Current locations, involved factions and NPCs, stage gates, and recovery paths carry forward
- Each source thread may have at most two unresolved quests at a time; the second slot is optional and may contain one meaningfully different alternative
- Follow-ups declare explicit prerequisite, parallel, optional-branch, or consequence relationships; no previous quest becomes a prerequisite automatically
- Every generated quest defaults to recoverable failure, meaningful neglect triggers, and exactly two outcomes

The composer stores and validates route profiles. A second unresolved route must explicitly link to the first and differ through approach and tradeoff, allies or location, or moral or resource cost. It is never generated merely to fill capacity. Generated details remain bounded campaign state, not new setting canon or mechanics.

## Approved checkpoint 3A

Quest advancement is paced through verified quest state. The first quest generated from a high-urgency thread may contain exactly one required major objective; completing it can award one advancement opportunity. A verified turning point can award after full completion and a recorded outcome. The quest ID is the unique reward source, so one quest cannot award twice through both routes.

## Working checkpoint 3B

The live Campaign Master can now request bounded quest operations through the validated turn pipeline:

- Generate an engine-owned quest from an active supplied story thread
- Make a locked quest available after its prerequisites and stage gate are satisfied
- Activate an available quest
- Add one adaptive objective when play creates genuine new work
- Complete or fail one currently active objective
- Complete a quest with an exact causal resolution assembled from what actually changed
- Recognize an unexpected solution that resolves the underlying problem without forcing unfinished presumed steps
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

## Compact journal and opening boundary

The browser now exposes the player-visible quest ledger as a functional journal:

- New campaigns do not receive a formal opening quest until the approved player-clicked d6 start and First Speaker attack have occurred
- The future opening composer must use both the selected spawn and hidden opening crisis
- The journal shows brief active main quests and brief other active quests
- The journal shows only the latest five meaningful player-known events
- Unaccepted quest offers remain in story presentation rather than occupying the journal
- The navigation badge counts active and changed quests
- Hidden Director-only and locked quests remain excluded through the player-context boundary
- The complete per-turn record remains in durable event history and the History view

The journal is intentionally a reminder rather than a second campaign database. It correctly remains empty before the formal opening quest exists.

## Approved review checkpoint 6

Review batch 1 establishes these permanent directions:

- The first formal quest begins after the d6 start and attack, using the selected spawn and hidden crisis.
- Quest construction recombines modular objectives, pressures, complications, and outcomes rather than selecting a fixed whole-quest formula.
- Objectives may be sequential, parallel, branching, or optional when appropriate.

The objective graph is implemented. Each objective records whether it is required, which objectives it depends on, and whether it belongs to a mutually exclusive branch group. A committed direction begins with one immediate objective. New objectives appear only when play justifies them, and a quest must resolve or continue through a linked quest instead of exceeding five objectives. Completing a branch skips unused alternatives, optional objectives do not block completion, and malformed or cyclic structures are rejected.

## Working staged-presentation checkpoint 7A

New quest records now separate the offered problem from uncommitted execution details:

- The player receives a fixed goal, stakes, two normally credible directions, and a third only for an urgency-three situation with enough valid choices.
- Direction modules receive causal scores from the source thread's kind, urgency, people, factions, and locations. Seeded ordering occurs only inside equal-score groups.
- Each direction shows a likely tradeoff without exposing an exact ending.
- Available quests with no committed direction omit their concrete objective graph from player context.
- Unselected exact outcomes, consequence seeds, and internal evidence references remain outside player context.
- The Director planning context retains bounded full quest details so later validation can complete the quest correctly.
- Completed player quests expose only the selected outcome rather than alternate endings.

Checkpoint 7B is complete. Before dice assessment or world mutation, the Campaign Master compares a natural player action with the recorded directions on available, uncommitted quests. It proposes a match only when the intent clearly selects one direction. That interpretation is persisted and shown in a browser confirmation dialog with the direction and likely tradeoff. Rejecting it leaves the quest untouched and lets the player rephrase. Accepting it commits the route exactly once, materializes its responsive objectives and hidden outcomes, and resumes the original action through the ordinary dice/turn pipeline. Pending confirmations survive refreshes and block conflicting actions or rollback until resolved.

Checkpoint 7C maintains unchosen directions after world changes. The Campaign Master may identify one exact offered direction as impossible only by citing one to four durable consequence events directly related to that quest. The engine removes the direction and independently chooses at most one unused module that remains causally credible; the Campaign Master cannot author or force the replacement. Previously invalidated approaches cannot cycle back. If no unused credible module exists, the journal keeps fewer choices. The last direction cannot disappear through this operation: the quest must instead use evidence-backed consequence failure so its loss remains explicit history. Direction revisions count toward the existing maximum of three quest-state changes per turn and rollback restores the prior choices.

## Branching rule

Normal quests have exactly two major outcomes. Only a marked turning-point quest backed by an urgency-three story thread may have three. Smaller variations belong in consequence state rather than additional major branches.

Questlines may link and require one another as a spiderweb. A player is not limited to one main questline.

The two or three stored outcome entries are structural boundaries, not prewritten endings. The exact completion is recorded from actual play across the problem, people or factions, location or world, and player reward or cost as applicable. Quests may mix social, investigation, exploration, and combat; a noncombat route normally remains credible unless established circumstances truly require combat.

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

- Live play validation of quest changes and recovery across sustained multi-scene sessions
- Real-provider sustained play evaluation of generated wording, pacing, and recovery across multi-scene sessions
- Final d6-start-and-attack implementation that creates the opening quest at the approved moment
