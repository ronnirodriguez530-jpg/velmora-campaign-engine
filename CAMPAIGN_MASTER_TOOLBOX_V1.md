# Campaign Master Toolbox V1

## Purpose

Velmora has one Campaign Master brain. It does not contain independent AI departments. The Campaign Master receives a bounded view of the world and uses a controlled toolbox of engine capabilities to understand the situation, present the story, and propose what should change.

The tools remain separate because each has different evidence, authority, validation, persistence, and rollback rules. Their separation makes the Campaign Master more reliable; it does not divide the Campaign Master into competing personalities.

## Authority model

1. Repository content defines protected canon, rules, catalogs, reusable reference principles, and tool contracts.
2. Campaign state records what is true in this particular playthrough.
3. The Context Gate retrieves only the information relevant to the current task and permitted perspective.
4. The Campaign Master interprets the player's action, selects appropriate tools, and proposes a bounded plan.
5. Deterministic validators accept or reject every proposed operation.
6. Accepted operations commit together as one transaction. Rejected plans receive at most one repair attempt and otherwise change nothing.
7. The presentation layer narrates only the validated result and player-permitted information.

The Campaign Master cannot directly edit the database, rewrite canon, change schemas, grant itself authority, or make generated material permanent without validation.

## Campaign Master toolbox

| Tool family | Responsibility | Current position |
| --- | --- | --- |
| Context Gate | Retrieve relevant canon, state, NPC perspective, quests, threads, history, and hidden Director planning material without leaking secrets | Working foundation |
| Opening controller | Run the d6 start, adaptive exploration window, First Speaker strike, hidden crisis, and first formal quest timing | Working |
| Story-thread tools | Create, activate, advance, block, resolve, fail, or replace causally sourced threads within stage and visibility gates | Working foundation |
| Quest tools | Construct, reveal, activate, revise, advance, complete, fail, recover, and connect quests within concurrency and consequence limits | Working foundation |
| NPC tools | Generate bounded minor NPCs; manage individual knowledge, belief, memory, relationships, location, status, and involvement | Working foundation |
| Faction tools | Read and change bounded faction condition and faction-path state | Partial scaffold |
| Location and world tools | Move the player, record durable location consequences, and schedule bounded Tear activity | Partial scaffold |
| Action and dice tools | Decide automatic versus uncertain action, create a hidden-DC check, accept the player's roll, and resolve approved outcome bands | Working foundation |
| Character tools | Maintain the persistent player character and approved derived statistics | Working foundation |
| Power tools | Maintain approved power definitions, ownership, sustained activation, and protected Level 3 acquisition | Working foundation |
| Inventory tools | Maintain item definitions, quantities, equipment slots, consumption, and defense effects | Working foundation |
| Progression tools | Award validated story milestones and apply explicitly approved ability or proficiency improvements | Working foundation |
| Reference retrieval | Retrieve bounded abstract craft principles from repository libraries without copying source content or browsing during play | Working quest/NPC foundation |
| Originality review | Enforce internal phrase checks and cloud semantic/sequence review before referenced quest generation persists | Working for cloud-requested quests |
| Scene presentation | Turn validated state into player-facing narration, dialogue, atmosphere, and suggested actions | Cloud adapter working; sustained real-provider evaluation pending |
| Journal | Show active quests and the latest five meaningful player-known events as a compact reminder | Working |
| Persistence and rollback | Store accepted changes, checkpoints, event history, save continuity, and one-turn restoration | Working foundation |
| Combat tools | Initiative, turns, attacks, damage, defense, conditions, defeat, escape, surrender, and encounter resolution | Not built |
| Adaptive DM tools | Track player tendencies, craft performance, motifs, repetition, and tool-use effectiveness | Designed; not built |

This table describes capabilities, not autonomous agents. The Campaign Master uses only the tools justified by the current moment.

## Bounded learning contract

Velmora learning means the Campaign Master becomes better at using its own toolbox and at running the current campaign. It does not mean the model retrains itself or rewrites the program.

Future adaptive records may include:

- player approaches and interests, stored as uncertain observations rather than permanent labels;
- pacing, scene length, combat frequency, requested tone, and response to guidance versus freedom;
- recently used quest structures, complications, NPC roles, emotional beats, and solution shapes;
- deliberate motifs, callbacks, mirrored choices, and consequence echoes;
- unresolved promises, abandoned pressures, successful tools, rejected plans, and recovery patterns;
- bounded craft evaluations of agency, causality, consistency, clarity, novelty, pacing, and follow-through.

A novelty record prevents accidental reuse. A motif record permits intentional recurrence when the recurrence carries established meaning. The engine must distinguish those two cases instead of treating all repetition as either acceptable or forbidden.

Adaptive records may influence retrieval, prioritization, pacing, variation, and which tools the Campaign Master uses. They may not independently change canon, mechanics, thresholds, stage gates, permissions, player-agency protections, reference restrictions, or this blueprint.

Campaign-specific adaptation may happen automatically after validation. Permanent engine improvement remains a human-reviewed, tested, versioned GitHub change.

## Online-first and offline-compatible boundary

The initial playable release is online-first. The cloud Campaign Master performs high-level interpretation and story presentation.

Core Velmora systems must nevertheless remain provider-independent:

- canon, libraries, generators, validators, tools, persistence, and campaign memory live in the repository and save;
- provider-specific request and response formats remain inside the cloud adapter;
- the cloud provider proposes but never owns state;
- loss of connectivity must leave the current operation uncommitted rather than corrupting or forking the save;
- Diagnostics remains test machinery and must never be presented as a genuine offline DM.

A future Local Campaign Master may implement the same Campaign Director interface and use the same context packets, tools, validators, and saves. That connection point is protected now, but building the offline Campaign Master is not part of the current development phase.

## Efficiency rule

Shared infrastructure should be consolidated when several tools need the same evidence, memory, context, consequence, or validation behavior. Tool responsibilities remain explicit even when they reuse one underlying service. Efficiency work may reduce duplicated code and context, but it may not blur authority or create an unvalidated shortcut around the transaction pipeline.

## Architectural success test

The architecture succeeds when the Campaign Master can select and combine the correct tools for an unexpected player action, remain grounded in the complete Velmora world, remember what matters, avoid accidental repetition, use deliberate recurrence meaningfully, and commit only coherent validated consequences—without requiring the user to prewrite scenes or allowing the provider to become the source of truth.
