# World Consequence Propagation Support Spec

Status: QA design contract; runtime propagation layer not yet implemented.

## Goal

Velmora should be able to turn a local player action into a living chain of consequences without globally leaking information or requiring prewritten branches.

Target flow:

Player action -> local event -> witnesses/effects -> individual knowledge/beliefs -> communication/rumor -> faction intelligence -> delayed reaction -> new world/quest/story situation.

## What already exists

The current engine already has useful primitives:

- persistent `world_facts` with truth status and visibility;
- per-NPC knowledge with method (`witnessed`, `told`, `inferred`), confidence, believed state, source NPC field, learned turn, and update turn;
- persistent NPC memories;
- directional NPC relationships to player/NPC/faction;
- persistent NPC location/status/category;
- durable event log;
- location consequences;
- faction condition/path state;
- Director context with current-location NPCs and their detailed knowledge/memories when relevant.

These are strong foundations. The missing piece is a first-class propagation mechanism connecting them.

## Current gaps found in audit

1. `manage_npc_turn.learnedFact` directly teaches one NPC a fact, but there is no explicit witness/reveal event that proves how a restricted or secret fact became available.
2. NPC knowledge supports `sourceNpcId`, but the ordinary NPC-turn request does not currently specify a source NPC when knowledge is transferred.
3. There is no first-class NPC-to-NPC communication action.
4. There is no rumor/claim record distinct from objective `world_facts`.
5. A player lie therefore must not be stored as established world truth merely so NPCs can believe it.
6. Factions have condition/path state but no persistent intelligence ledger recording what a faction knows, believes, suspects, and from whom.
7. There is no delayed propagation queue/scheduler; all knowledge movement currently has to be manually proposed during a turn.
8. Current context is location-centric, which is good for context control but means off-screen propagation needs its own bounded mechanism.

## Core design rule: truth, claim, and belief are different things

The engine must never collapse these layers:

### World truth
Objective campaign facts. Example: `The player did not steal the ledger.`

### Claim/report
Something someone said, reported, inferred, or circulated. Example: `The player stole the ledger.`

### Individual/faction belief
What an NPC or faction currently believes about a fact/claim and with what confidence.

A false rumor may become widely believed without changing objective truth.

## Recommended new persistent concept: information claims

Add a persistent claim/report layer rather than converting every rumor into `world_facts`.

Suggested shape:

- `claimId`
- `campaignId`
- `statement`
- `subjectType` / `subjectId` where applicable
- `originType`: `witness_report | player_statement | npc_statement | inference | official_report | rumor`
- `originNpcId` nullable
- `originFactionId` nullable
- `originEventSequence` nullable
- `truthFactId` nullable (only when the claim maps to an objective fact)
- `createdTurn`
- `status`: `circulating | dormant | disproven | confirmed`

A claim can exist even if objective truth is unknown.

## Witness recording

A resolved player/world action that is socially meaningful should be able to produce an information event.

Suggested action: `record_information_event`.

Required data:

- source durable event sequence or current action resolution;
- location;
- concise observable content;
- directly witnessing NPC IDs;
- whether the event was public/obvious or required special perception/access;
- optional linked world fact or claim;
- reason.

Validation should ensure named witnesses were actually present/eligible unless the event represents later evidence discovery rather than direct witnessing.

Do not automatically teach every NPC at a location everything. Visibility matters.

## NPC-to-NPC transfer

Suggested action: `transfer_information`.

Required data:

- source NPC;
- recipient NPC;
- fact or claim ID;
- communication method (`told`, `shown_evidence`, `official_report`, etc.);
- resulting confidence and believed state;
- reason.

Validation:

- source NPC must actually possess/know the fact or claim unless explicitly lying/fabricating;
- ordinary direct communication requires plausible contact/location or a supported communication channel;
- recipient belief need not equal source belief;
- source provenance must be persisted;
- a recipient can later retell it, creating a traceable chain.

## Lying and fabrication

A source should be allowed to tell a claim they do not believe, but this must be represented as a claim/report, not as knowledge of an established fact.

Example:

Player publicly says: `Chrysalis stole the missing shipments.`

The engine may create a claim:

`CLAIM-...: Chrysalis is responsible for the missing shipments.`

Witnesses may believe it at different confidence levels. The actual culprit fact remains untouched.

## Rumor propagation

Rumor should be bounded and causal rather than a magical global broadcast.

A propagation step should consider:

- who currently knows/believes the claim;
- their relationships and faction membership;
- whether they have plausible contact with recipients;
- importance/novelty of the information;
- confidence;
- motive to share, hide, distort, or weaponize it;
- elapsed turns;
- location/social network relevance.

The deterministic engine should validate recipients/provenance and limits. The Director may choose *why* an NPC shares or distorts information.

## Distortion

Do not mutate an existing claim in place when meaning materially changes.

Instead:

- create a derivative claim linked to the source claim;
- preserve provenance;
- allow different versions to coexist.

This supports two factions hearing genuinely different stories about one incident.

## Faction intelligence

A faction should not automatically know everything its members know.

Recommended persistent faction-intelligence record:

- factionId;
- fact/claim ID;
- confidence;
- believed state;
- source NPC/report;
- acquisition method;
- acquired turn;
- last updated turn;
- dissemination level (`cell | leadership | operational | broad`).

This matters especially for the Order of Glass and other organizations whose internal information boundaries should be meaningful.

## Reaction layer

Knowledge is not itself a reaction.

A faction/NPC reaction should occur only when:

1. the actor possesses relevant information;
2. the information matters to an existing desire, relationship, duty, faction goal, quest, or story thread;
3. a plausible action opportunity exists.

Possible reactions use existing systems where possible:

- change NPC relationship;
- create/advance/block story thread;
- generate dynamic quest;
- change faction condition/path;
- move/change status of NPC;
- record location consequence;
- create a later encounter/scene pressure.

Do not create a new bespoke reaction subsystem for every case if existing tools can express the consequence.

## Delayed reaction requirement

Not everything should react in the same turn.

Need a bounded pending-information/reaction mechanism so the world can produce outcomes several turns later.

Examples:

- a witness reports a crime after the player leaves;
- a faction messenger reaches leadership two turns later;
- a rumor reaches another wedge after several scenes;
- an NPC quietly acts on information without immediately confronting the player.

The engine should avoid processing every possible social connection every turn. Only active/relevant/high-importance propagation candidates should be considered.

## Context safety

Player-facing context must never expose secret Director information merely because the Director knows it.

NPC dialogue should be generated from that NPC's own knowledge/beliefs plus publicly observable state.

Director context may see provenance and objective truth needed to reason correctly, but the story presentation must remain perspective-safe.

## Required initial stress tests

### WCP-01 Direct witness
Player commits a visible action in front of one NPC.
Expected: only eligible witness receives first-hand knowledge/memory; unrelated NPC does not.

### WCP-02 Unseen action
Player commits an action with no witness and leaves no discovered evidence.
Expected: no NPC/faction magically knows.

### WCP-03 NPC tells NPC
Witness later tells another NPC.
Expected: recipient knowledge method is `told`, source provenance points to teller, confidence may differ.

### WCP-04 False public rumor
Player falsely accuses a faction in a market.
Expected: claim exists; some witnesses may believe it; objective truth is unchanged.

### WCP-05 Conflicting versions
Two sources circulate incompatible versions.
Expected: both claims coexist; different NPCs/factions may believe different versions.

### WCP-06 Secret containment
One NPC learns a restricted/secret fact.
Expected: no global visibility; it spreads only through validated reveal/communication.

### WCP-07 Faction report
Faction member submits a credible report.
Expected: faction intelligence changes without automatically teaching every faction member.

### WCP-08 Delayed reaction
A report reaches leadership later.
Expected: faction response occurs on a later turn and cites the information chain.

### WCP-09 Dead witness persistence
A witness tells another NPC, then dies/departs.
Expected: transferred information remains with recipient.

### WCP-10 Save/reload
Create witness -> transfer -> faction report, reload campaign.
Expected: complete provenance chain survives.

### WCP-11 No Director leakage
Director knows secret truth but present NPC does not.
Expected: NPC narration/dialogue cannot use the secret unless learned.

### WCP-12 Reputation through news
NPCs who never met the player receive credible reports about them.
Expected: later behavior may change causally without fabricating direct memories.

## Recommended implementation order

1. Claim/report persistence separate from objective facts.
2. Validated direct witness/reveal recording.
3. NPC-to-NPC information transfer with provenance.
4. Faction intelligence ledger.
5. Bounded delayed propagation/reaction candidates.
6. Director context exposure of relevant claims/intelligence.
7. Stress tests for false rumor, secret leakage, conflicting reports, and delayed reactions.

## Acceptance criterion

This layer passes when the following can happen naturally and persistently:

The player lies in a market -> three actual witnesses hear it -> two believe it differently -> one tells a faction contact later -> the faction records the report but is uncertain -> another source contradicts it -> faction behavior changes based on its current belief -> the player encounters consequences several sessions later.

At no point should the false statement become objective world truth merely because it spread.
