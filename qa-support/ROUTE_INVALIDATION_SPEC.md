# Route Invalidation Support Spec

Status: support-layer design for implementation review. Non-canon and non-runtime until promoted.

## Problem

Velmora now supports two simultaneous unresolved quests on one story thread and preserves parallel/optional routes by default. The missing resilience case is when a durable world consequence makes one unresolved route's premise impossible.

The engine currently has no distinct quest-management action for this condition. Using ordinary recoverable failure would blur two different causes:

- the player failed or neglected a route;
- the world changed so the route no longer exists as a viable possibility.

The journal should preserve the route as failed history when consequences truly invalidate it, but the Director must not be allowed to close parallel work merely because another route completed.

## Approved behavior captured by this spec

1. Completing one route does not automatically close another unresolved route.
2. An unresolved route remains pursuable unless consequences make its premise impossible.
3. When consequences make an unresolved route impossible, preserve it in the journal as `failed`.
4. Ordinary generated quests begin recoverable unless verified stakes justify permanence.
5. Route invalidation must therefore be evidence-backed rather than discretionary.

## Proposed management action

Add a distinct `manage_quest` action:

`invalidate_route`

Required fields:

- `questId`: unresolved quest being invalidated.
- `invalidationEvidenceEventSequences`: 1-4 durable event-log sequence IDs.
- `reason`: concise causal explanation of why the cited consequences make the quest premise impossible.

This is not a new quest state. The resulting journal state is still `failed` so history remains simple and player-readable.

## Validation contract

`invalidate_route` may succeed only when all conditions below are true.

### Quest state

The target quest must be unresolved:

- `locked`
- `available`
- `active`
- `changed`

A completed or already failed route cannot be invalidated again.

### Evidence quantity

Require 1-4 distinct event sequences. Empty evidence is rejected. Duplicate references are rejected.

### Evidence ownership and durability

Every event must:

- belong to the same campaign;
- exist in the event log;
- be a durable world-changing event, not narration alone;
- occur at or after the quest's creation turn.

Initial allowed evidence families can reuse the same durable consequence families already trusted for recovery:

- `change_faction_condition`
- `change_npc_reputation`
- `advance_faction_path`
- `record_location_consequence`
- `manage_npc_turn`
- `manage_story_thread`
- `create_story_thread`

Additional authoritative quest events may be accepted where directly causal, especially completion/failure of a linked route, but only if paired with world evidence when the route's premise depends on a world change rather than the other route's mere state transition.

### Causal requirement

Evidence cannot merely be chronologically later. The request's `reason` must assert a direct premise-breaking relationship.

Examples of valid invalidation:

- Target requires negotiating with NPC A; NPC A is now durably recorded dead/departed and no replacement can satisfy that specific premise.
- Target requires recovering an intact object from a location; a recorded consequence establishes the object/location was destroyed.
- Target requires preventing an event that a durable story/faction consequence establishes has already happened.

Examples that must be rejected:

- "The other route was completed."
- "This route is less interesting now."
- "The player has ignored it for a while" without a verified deadline/consequence.
- "The Director wants to simplify the journal."
- Evidence that only changes reputation while the quest premise remains possible.

## Persistence/event behavior

On success:

1. Set quest `state` to `failed`.
2. Preserve objectives exactly as historical state; do not pretend unfinished objectives were attempted.
3. Preserve the quest in the journal.
4. Append a dedicated event such as `quest_route_invalidated` containing:
   - `questId`
   - `evidenceEventSequences`
   - `reason`
5. Do not automatically fail, complete, alter, or hide any other unresolved quest on the thread.
6. The freed unresolved slot may later support a consequence-backed altered/recovery route if normal recovery rules permit it.

## Recovery interaction

Route invalidation is not automatically recoverable.

If the invalidated quest has `failureMode: recoverable`, recovery still requires the existing recovery contract: a recorded failed quest, a listed recovery path, and durable consequence evidence supporting the altered route.

If its premise is permanently impossible but the underlying story problem remains solvable, the altered route should represent a genuinely different approach rather than resurrecting the invalidated premise.

## Director-facing rule

The Campaign Master should reason in this order:

1. Is the unresolved route still fictionally possible?
   - Yes -> preserve it.
2. Did another route merely complete?
   - Yes -> preserve it unless that completion caused a durable premise-breaking consequence.
3. Is there durable evidence that makes the route impossible?
   - No -> preserve it.
4. Is there sufficient causal evidence?
   - Yes -> request `invalidate_route` with evidence.

Default behavior is preservation, not cleanup.

## Required tests before promotion

### RI-01 Parallel completion preservation

Create two parallel unresolved routes. Complete one. Assert the other remains unresolved.

Expected: PASS without invalidation.

### RI-02 Evidence-free invalidation rejected

Attempt `invalidate_route` with zero evidence.

Expected: validation error; quest unchanged.

### RI-03 Non-durable evidence rejected

Cite narration/non-tool event.

Expected: validation error; quest unchanged.

### RI-04 Unrelated durable consequence rejected by causal gate

Cite a durable faction/reputation event unrelated to the route premise.

Expected: validation must not permit arbitrary cleanup. If causal semantics cannot yet be machine-verified, classify this as requiring Director justification plus later semantic validation rather than silently treating any durable event as sufficient.

### RI-05 Premise-destroying location consequence

Record a location consequence that makes the route's required target impossible, then invalidate.

Expected: target quest becomes `failed`; parallel route remains untouched; dedicated invalidation event is recorded.

### RI-06 NPC premise invalidation

A route specifically depends on an NPC who becomes durably unavailable/dead/departed under authoritative state.

Expected: invalidation allowed only if the quest premise cannot logically transfer to another NPC.

### RI-07 Double invalidation rejected

Invalidate once, then attempt again.

Expected: validation error; no duplicate event.

### RI-08 Completed quest invalidation rejected

Complete a route, then attempt invalidation.

Expected: validation error.

### RI-09 Recovery from invalidated route still evidence-backed

Invalidate a recoverable route, then attempt altered recovery without consequences.

Expected: rejected by existing recovery evidence rules.

### RI-10 Thread-cap release

Two unresolved routes exist. One is validly invalidated.

Expected: failed route no longer consumes the two-unresolved-quest cap; one new valid route may be created.

## Important implementation warning

Do not implement this as "if sibling quest completed, fail this quest." That recreates railroad branching and violates the approved keep-unless-consequences-invalidate rule.

The system needs to distinguish *route state* from *world causality*.
