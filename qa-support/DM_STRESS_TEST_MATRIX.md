# Velmora Living-DM Stress Test Matrix

Status values: `UNTESTED`, `PASS`, `PARTIAL`, `FAIL`, `BLOCKED`.

## Core pass condition

For any unexpected but valid player action, the DM should be able to:

1. Interpret intent.
2. Resolve what happens using canon + current state + reasonable inference.
3. Persist meaningful consequences.
4. Continue play without requiring a prewritten branch.
5. Avoid inventing contradictions or silently resetting the world.

## Test categories

| ID | Scenario | Expected resilience | Status | Notes |
|---|---|---|---|---|
| QP-01 | Player ignores the presented main quest and looks for unrelated work | World problem continues independently; DM generates a coherent alternative activity | UNTESTED | |
| QP-02 | Player kills the quest-giver before receiving critical information | Information remains discoverable through world state, evidence, witnesses, or other knowers | UNTESTED | |
| QP-03 | Player refuses every faction invitation | Campaign remains playable without forced allegiance | UNTESTED | |
| QP-04 | Player publicly exposes a secret quest | NPCs/factions react; quest mutates instead of hard-failing | UNTESTED | |
| QP-05 | Player leaves an urgent problem unresolved for many sessions | Problem advances off-screen and returns in updated form | UNTESTED | |
| QP-06 | Player completes one of two parallel routes | Sibling route remains unresolved unless a durable consequence actually makes its premise impossible | PARTIAL | Current quest model preserves sibling routes by default; dedicated evidence-backed invalidation action is still missing. See ROUTE_INVALIDATION_SPEC.md. |
| QP-07 | World consequences make one unresolved route impossible | Impossible route is preserved in journal as failed; sibling route remains untouched; invalidation cites durable causal evidence | BLOCKED | Specification complete in ROUTE_INVALIDATION_SPEC.md; runtime action not yet implemented. |
| NPC-01 | Player befriends a hostile NPC unexpectedly | Relationship state can move outside authored expectation | UNTESTED | |
| NPC-02 | Player attacks a friendly or important NPC | NPC/world response persists and downstream systems adapt | UNTESTED | |
| NPC-03 | Player returns to an improvised NPC after many sessions | Same identity, history, relationship, and relevant memories persist | UNTESTED | |
| NPC-04 | NPC learns something through another NPC rather than directly from player | Knowledge can propagate through the world | UNTESTED | |
| NPC-05 | Player asks an improvised NPC about obscure personal details | DM can extend the character coherently without rewriting prior facts | UNTESTED | |
| WRLD-01 | Player spreads a false rumor in a crowded market | Audience, credibility, rumor spread, faction effects, and later reactions are modeled | UNTESTED | |
| WRLD-02 | Player damages or destroys a location | Physical/world state persists and future scenes reflect it | UNTESTED | |
| WRLD-03 | Player creates a new social institution/business/group | DM can instantiate and persist it without special scripting | UNTESTED | |
| WRLD-04 | Player causes a cross-faction incident | Multiple factions can update beliefs/goals independently | UNTESTED | |
| WRLD-05 | Player asks about an undefined but mundane world detail | DM safely improvises local detail and preserves it thereafter | UNTESTED | |
| SYS-01 | Model/API response is malformed or missing | Engine degrades gracefully and campaign does not die | UNTESTED | |
| SYS-02 | A subsystem returns contradictory state | Validation/recovery prevents corruption and play can continue | UNTESTED | |
| SYS-03 | Player submits ambiguous or adversarial phrasing | DM resolves intent or asks in-world clarification without crashing | UNTESTED | |
| SYS-04 | Very long session accumulates many NPCs/events | Context/state retrieval remains coherent enough to continue | UNTESTED | |
| SYS-05 | Save/reload occurs after improvised content | Emergent content survives persistence boundary | UNTESTED | |
| EDGE-01 | Player tries to leave Velmora instead of engaging local story | DM responds from actual world constraints, not a generic invisible wall | UNTESTED | |
| EDGE-02 | Player tries a solution that bypasses planned combat | Resolution system supports it if fictionally plausible | UNTESTED | |
| EDGE-03 | Player combines unrelated systems in an unusual way | DM reasons across systems instead of rejecting because no branch exists | UNTESTED | |
| EDGE-04 | Player deliberately contradicts known canon | DM distinguishes player claim from world truth and reacts appropriately | UNTESTED | |
| EDGE-05 | Player repeatedly derails tone while actions remain valid | Story adapts without losing world consistency or agency | UNTESTED | |

## Failure classification

- **Crash/runtime failure**: application throws, hangs, or cannot produce a turn.
- **State failure**: consequences are lost, duplicated, or corrupted.
- **Reasoning failure**: DM response is logically incompatible with available state.
- **Continuity failure**: prior generated facts are forgotten or contradicted.
- **Canon violation**: DM invents or rewrites protected setting truth.
- **Dead-end/railroad**: DM cannot continue unless player returns to expected route.
- **Degraded fallback**: system continues, but only through generic/no-op output.

## First audit target

`WORLD CONSEQUENCE PROPAGATION`

Player action -> local witnesses/effects -> knowledge/belief updates -> faction/NPC propagation -> delayed reaction -> new situation.

This is a key separator between a responsive narrator and a living persistent DM.
