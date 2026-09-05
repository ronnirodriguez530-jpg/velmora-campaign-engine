# Velmora Living-DM Master Roadmap

This file tracks the side QA/research effort focused on one question:

> Can Velmora keep a coherent living story going when the player does something the engine did not explicitly expect?

This roadmap is non-canon and non-runtime by default. It exists to identify gaps, define expected behavior, and hand concrete requirements to implementation work.

## Core success condition

For any unexpected but valid player action, the DM should be able to:

1. Interpret the player's intent.
2. Resolve the action from canon + current world state + reasonable inference.
3. Persist meaningful consequences.
4. Propagate those consequences to NPCs, factions, locations, quests, and story threads where appropriate.
5. Continue play without needing a prewritten branch.
6. Avoid contradictions, silent resets, arbitrary railroading, or campaign-ending subsystem failures.

---

# 1. Already established / already in progress

## Quest resilience foundation
- [x] Flexible quest opening rather than rigid linear quest chains.
- [x] Explicit prerequisite / parallel / optional-branch / consequence relationships.
- [x] Hard cap of two simultaneous unresolved quests per story thread.
- [x] Parallel work stays alive by default when another route completes.
- [x] Recoverable quest failure can produce altered routes.
- [x] Up to two distinct recovery routes may exist when justified.
- [x] Recovery requires durable consequence evidence, not just a generic recovery sentence.
- [x] Failed routes stay in history rather than being erased.
- [x] Recovery may appear immediately or later when consequences create a credible opening.

## NPC persistence foundation
- [x] Persistent NPC identities.
- [x] NPC memories.
- [x] NPC knowledge and beliefs.
- [x] Player/NPC/faction relationship state.
- [x] NPC status/location persistence.
- [x] Generated NPC support and constrained generation.

## General engine foundation already present
- [x] Persistent campaign state.
- [x] Event log / durable consequences.
- [x] Save/load persistence.
- [x] Validation boundaries between Director output and deterministic engine state.
- [x] Existing tests for NPCs, dice, placement, database, inventory, cloud director, etc.

---

# 2. Current immediate gap

## Route invalidation
Status: SPECIFIED IN QA; RUNTIME ACTION STILL NEEDED.

Problem: an unresolved route can become genuinely impossible because the world changed, but the engine currently has no dedicated action to close that route for a verified causal reason.

Required behavior:
- A sibling route completing is NOT enough to invalidate another route.
- Route invalidation requires durable premise-breaking world evidence.
- Evidence may include destroyed/inaccessible locations, dead/departed/unavailable required NPCs, faction/state changes that eliminate the premise, irreversible world events, or equivalent durable consequences.
- Invalidated routes remain in history.
- Other unresolved routes remain untouched unless their own premises are invalidated.
- Invalidating a route frees its unresolved-quest slot.
- Recovery may still emerge later if a new credible route exists.

Needed runtime work:
- [ ] Dedicated route-invalidation quest action.
- [ ] Evidence references stored with invalidation.
- [ ] Validation that cited evidence actually predates/supports invalidation.
- [ ] Distinct event type for route invalidation.
- [ ] Journal/UI wording that distinguishes "player failed" from "route became impossible".
- [ ] Tests for sibling preservation, unrelated evidence rejection, double invalidation rejection, and recovery after invalidation.

---

# 3. World consequence propagation

This is the highest-priority living-world system after route invalidation.

Goal:

Player action -> local effect/witnesses -> knowledge/belief updates -> faction/NPC propagation -> delayed reactions -> new situations.

Needed capabilities:
- [ ] Determine who directly witnessed an event.
- [ ] Record what each witness actually knows versus assumes.
- [ ] Allow witnesses to tell other NPCs.
- [ ] Allow rumors to mutate in confidence/content without becoming objective truth.
- [ ] Allow faction intelligence to acquire information from members/sources.
- [ ] Update faction/NPC behavior when new information materially changes goals.
- [ ] Generate delayed reactions rather than forcing all consequences into the same turn.
- [ ] Preserve provenance: witnessed, told, inferred, rumor, official report, etc.
- [ ] Prevent secret information from globally leaking just because the Director knows it.

Stress cases:
- [ ] Player spreads a false rumor in a crowded market.
- [ ] Player commits a crime with only one witness.
- [ ] Witness lies about what happened.
- [ ] Two factions hear different versions of the same event.
- [ ] Player's reputation changes among people they have never directly met because news traveled.

---

# 4. Unexpected quest behavior

Goal: quests are opportunities inside a living world, not gates required for reality to continue.

Needed/verified behavior:
- [ ] Player ignores a main quest entirely; world problem keeps moving.
- [ ] Player abandons a quest after starting it.
- [ ] Player reveals a supposedly secret quest publicly.
- [ ] Player solves the underlying problem without following quest objectives.
- [ ] Player destroys the quest-giver's planned approach but leaves the underlying problem intact.
- [ ] Player helps the "opposition" instead.
- [ ] Urgent problems advance off-screen when ignored.
- [ ] NPCs/factions may solve, worsen, or transform problems without the player.
- [ ] Critical information is not permanently trapped in one quest-giver.

Design principle:
Information and problems belong to the world, not to a single scripted branch.

---

# 5. NPC resilience

Goal: important and improvised NPCs survive unexpected social behavior without collapsing the story.

Needed tests/capabilities:
- [ ] Player befriends a hostile NPC.
- [ ] Player attacks or betrays a friendly NPC.
- [ ] Player kills an important quest-related NPC.
- [ ] Player recruits a random background NPC.
- [ ] Player returns to an improvised NPC many sessions later.
- [ ] Improvised NPC gains additional coherent personal details over time.
- [ ] NPC can change loyalties/goals because of events.
- [ ] NPC-to-NPC knowledge transfer works.
- [ ] NPC death/departure does not erase information they already spread.
- [ ] NPC replacement/fallback emerges naturally when a role becomes vacant.

---

# 6. Improvised world persistence

Goal: mundane details created during play become durable world facts instead of disposable narration.

Needed capabilities/tests:
- [ ] DM safely invents an undefined mundane location/detail when needed.
- [ ] Improvised place gets a stable identity if it becomes relevant.
- [ ] Improvised business/group/institution can persist.
- [ ] Player can create a business, gang, crew, club, shrine, workshop, etc.
- [ ] Damage to an improvised place persists.
- [ ] Generated ownership, staffing, relationships, and history remain coherent.
- [ ] The DM does not generate a contradictory second version later.

Examples:
- Player asks for a tavern where none is authored.
- Player establishes a smuggling route.
- Player hires workers and opens a shop.
- Player names a previously unnamed alley and starts using it as a meeting place.

---

# 7. Location and physical-world consequences

Goal: Velmora's physical state changes and stays changed.

Needed capabilities/tests:
- [ ] Destroyed/damaged locations affect future scenes.
- [ ] Access routes can become blocked/opened.
- [ ] Player-created shortcuts remain usable.
- [ ] Ownership/control can change.
- [ ] Local population/activity responds to danger or prosperity.
- [ ] Repairs/reconstruction can occur over time.
- [ ] Location changes can invalidate or create quests.
- [ ] Map/world descriptions reflect current state, not default canon snapshots.

---

# 8. Faction reaction system

Goal: factions behave like organizations with goals and information rather than global reputation meters.

Needed capabilities/tests:
- [ ] Different factions can interpret the same event differently.
- [ ] Cross-faction incidents can create independent responses.
- [ ] Factions can exploit player-created chaos.
- [ ] Faction goals continue without the player.
- [ ] Internal faction knowledge may differ from public knowledge.
- [ ] Faction reaction can be delayed.
- [ ] Factions can make moves against each other off-screen.
- [ ] Player may remain independent from all factions without campaign failure.
- [ ] Faction alliances/enmities may evolve from campaign events.

---

# 9. Story-thread autonomy

Goal: active story problems continue to exist and evolve outside direct player attention.

Needed capabilities/tests:
- [ ] Thread can advance because NPC/faction/world actions occur.
- [ ] Thread can become blocked.
- [ ] Thread can resolve without player intervention when credible.
- [ ] Thread can fail because of world events.
- [ ] Thread can branch into a new thread.
- [ ] Dormant thread can return later because conditions changed.
- [ ] Threads do not all demand simultaneous player attention.
- [ ] World pacing prevents every unresolved issue from escalating every turn.

---

# 10. Information resilience

Goal: secrets, clues, truths, lies, and discoveries survive unusual player behavior.

Needed capabilities/tests:
- [ ] Critical clue has multiple plausible discovery routes.
- [ ] Killing/refusing one information source does not hard-lock campaign truth.
- [ ] Player can discover evidence before receiving the related quest.
- [ ] NPC misinformation remains distinguishable from established truth.
- [ ] Player lies do not overwrite objective world facts.
- [ ] Conflicting testimony can coexist.
- [ ] Evidence can become inaccessible/destroyed while truth remains discoverable through other routes when plausible.
- [ ] Director-private facts never leak automatically to player-facing context.

---

# 11. Freeform action resilience

Goal: the DM handles natural language actions instead of only recognized commands.

Needed tests:
- [ ] Ambiguous action.
- [ ] Multi-part action.
- [ ] Social + physical action combined.
- [ ] Player attempts something not represented by a subsystem.
- [ ] Player bypasses combat through negotiation/trickery.
- [ ] Player combines powers/items/environment unexpectedly.
- [ ] Player tries something impossible; DM explains/resolves fictionally rather than crashing.
- [ ] Player contradicts canon intentionally; claim is treated as a claim, not rewritten truth.

---

# 12. Failure and graceful degradation

Goal: one malformed model/tool/subsystem result must never kill the campaign.

Needed capabilities/tests:
- [ ] Malformed Director JSON/output.
- [ ] Missing optional tool request fields.
- [ ] Invalid quest/NPC/location reference.
- [ ] Contradictory proposed state change.
- [ ] Cloud/model unavailable.
- [ ] Timeout or empty response.
- [ ] Tool request rejected by deterministic validation.
- [ ] Partial turn where one requested action fails.
- [ ] Safe fallback narration/context without corrupting state.
- [ ] Player can retry/continue after failure.

Primary rule:
Validation failure should reject the bad mutation, not destroy the session.

---

# 13. Long-session continuity and context pressure

Goal: the world remains coherent after many sessions and hundreds/thousands of events.

Needed tests/capabilities:
- [ ] Many NPCs accumulate without overwhelming context.
- [ ] Old important memories remain retrievable.
- [ ] Trivial history can be summarized/archived.
- [ ] Important unresolved promises/debts persist.
- [ ] Old locations retain consequential changes.
- [ ] Returning characters receive relevant context without dumping entire history.
- [ ] Director context prioritization does not hide critical information.
- [ ] Long-running rumors/faction changes remain consistent.
- [ ] Save/reload after extensive emergent content reproduces coherent state.

---

# 14. Save/reload and persistence boundary

Goal: anything that became real during play remains real after restarting.

Needed tests:
- [ ] Generated NPC persists.
- [ ] Generated NPC memory persists.
- [ ] Improvised place/institution persists.
- [ ] Quest recovery/invalidation history persists.
- [ ] Faction/NPC knowledge persists.
- [ ] Rumor provenance persists.
- [ ] Damaged/changed location persists.
- [ ] Story thread state persists.
- [ ] No duplicate generation after reload for entities that already exist.

---

# 15. Leaving / resisting the intended setting path

Goal: world constraints are enforced fictionally without invisible game-master rails.

Needed tests:
- [ ] Player tries to leave Velmora.
- [ ] Player refuses all faction involvement.
- [ ] Player avoids the Tear entirely.
- [ ] Player tries to live an ordinary life.
- [ ] Player spends sessions pursuing commerce/social goals instead of adventure.
- [ ] Player deliberately avoids the apparent main mystery.

Pass condition:
The campaign remains playable, while actual setting constraints and unattended world problems still exist.

---

# 16. Cross-system combination tests

Goal: systems cooperate instead of functioning as isolated modules.

Needed tests:
- [ ] NPC death changes quest viability.
- [ ] Location destruction changes faction plans.
- [ ] Faction conflict changes available jobs/quests.
- [ ] Player rumor changes NPC relationships and faction decisions.
- [ ] Inventory/power use creates persistent location consequences.
- [ ] Quest outcome creates new story thread.
- [ ] Story-thread consequence changes NPC belief or availability.
- [ ] Progression/discovery occurs through emergent play, not only authored quest completion.

---

# 17. World-content gaps that matter to improvisation

These are not requests to prewrite every detail. They are areas where enough structure may be needed so the DM can improvise safely.

Potential research gaps:
- [ ] Travel rules between wedges/districts.
- [ ] Tear-center geography and access.
- [ ] Gates/walls/outer-city access.
- [ ] Water, food, waste, utilities, medicine.
- [ ] Neutral/shared territory.
- [ ] Ordinary jobs and commerce.
- [ ] Law, crime, punishment, jurisdiction across faction borders.
- [ ] Faction leadership/ranks/headquarters where needed.
- [ ] Culture, entertainment, slang, beliefs, funerals, education, childhood.
- [ ] Black markets and informal economies.
- [ ] What exists outside Velmora and what residents believe about it.

Rule:
Only define what gives the DM useful constraints. Do not fill the world so completely that improvisation becomes impossible.

---

# 18. Recommended build/test order

1. [ ] Implement and verify consequence-backed route invalidation.
2. [ ] Build/test world consequence propagation.
3. [ ] Test quest abandonment / off-screen quest progression.
4. [ ] Test NPC death, betrayal, recruitment, and information fallback.
5. [ ] Build/test rumor and NPC-to-NPC knowledge propagation.
6. [ ] Build/test persistent improvised locations/institutions.
7. [ ] Test faction reaction and cross-faction consequences.
8. [ ] Test story-thread autonomy/off-screen movement.
9. [ ] Test information redundancy and truth protection.
10. [ ] Run freeform/adversarial action battery.
11. [ ] Run graceful-degradation/system-failure battery.
12. [ ] Run long-session/context-pressure simulation.
13. [ ] Run save/reload persistence battery.
14. [ ] Run cross-system chaos scenarios.
15. [ ] Re-audit remaining world-content gaps exposed by actual failures.

---

# 19. Final acceptance test for the living DM

Velmora is ready for the target experience when we can repeatedly throw scenarios like these at it without hand-authoring branches:

- Ignore the main quest and start a business.
- Murder the person who was supposed to explain the mystery.
- Befriend the intended enemy.
- Spread a false faction rumor.
- Destroy the location where a quest was supposed to happen.
- Recruit an irrelevant civilian into the adventure.
- Leave an urgent problem alone for weeks.
- Solve a combat problem socially.
- Return to an improvised NPC twenty sessions later.
- Cause two factions to react differently to the same incident.
- Lose cloud/model output for a turn.
- Reload the campaign after all of the above.

If the world remembers, reacts, adapts, and continues coherently, then Velmora is functioning as the living-story DM we are aiming for rather than a large scripted branching RPG.
