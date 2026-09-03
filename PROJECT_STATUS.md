# Velmora Project Status

## Current phase

World-canon, generative campaign-blueprint foundation, and persistent story-memory foundation are complete; validated Story Engine authority is next.

## Completed

1. Campaign foundation and core Velmora canon recorded.
2. Headless local engine created.
3. Limited persistent state, current-location context filtering, validation, checkpoints, rollback, and event history implemented for the existing scaffold.
4. Local and cloud Campaign Director boundaries implemented.
5. Preserved faction progression, stage progression, Tear arrivals, and four-stage scene scaffolding restored.
6. Canon, scaffolding, test-only material, and deferred content separated in `BOUNDARIES.md`.
7. Bounded multi-path Simulation Runner implemented.
8. Local browser server and high-contrast interface connected directly to the engine and SQLite save.

## Verified checkpoint

- Foundation validation passed.
- Automated tests passed: 17 of 17.
- Full simulation passed: 12 independent paths × 12 turns, with zero validation failures and no canon mutation.
- All four mechanical faction-pair patterns reached Resolution.

## Demonstrated limitation

Every simulation reached Resolution after the same amount of abstract faction progress. The engine continuity works, but the provisional progression is too uniform to judge story pacing. That is not a code failure; it is the exact point where minimum approved opening content is now required.

## Verified browser checkpoint

- Browser application serves locally at `http://127.0.0.1:4173`.
- Campaign creation/opening, scene placement, actions, persistence, and rollback passed automated integration testing.
- Full suite passed: 18 of 18 tests.
- Windows one-click launcher added as `start-velmora.bat`.
- The live Director control is unavailable until an API key is deliberately configured.

## Verified story-first checkpoint

- Campaign Master scene-presentation contract implemented.
- Initial scenes and post-action scenes can receive persistent narration and two meaningful choices.
- The cloud adapter is prompted to return action results as story while its five supported durable changes remain engine-validated; real provider behavior is still unverified.
- Diagnostic narration is visibly labeled and replaced when the Live Campaign Master connects.
- Main interface rebuilt around narration and player input.
- Character, quests, factions, locations, inventory, history, and settings appear in the top-left navigation; Character, Quests, and Inventory remain placeholders.
- Faction and location badges reflect limited scaffold counters; Quest and Inventory badges are hard-coded to zero.
- The API key can be configured locally through Settings without placing it in chat.
- The current audited suite passes 20 of 20 tests, covering the shell and scaffold only.
- Public GitHub source repository established.
- In-app update check, installation, save protection, restart, and browser reload implemented.

## Verified NPC storage checkpoint

- General NPC records persist separately from the eight fixed authored-character slots.
- Active, known, and background categories are enforced by the database.
- Approved relevance signals produce deterministic category decisions.
- Category changes retain identity and create both category history and engine events.
- The complete audited suite passes 22 of 22 tests.

## Verified NPC memory checkpoint

- World truth, NPC knowledge, NPC belief, and personal memory are stored separately.
- Private facts remain unknown until explicitly learned by witnessing, being told, or inference.
- NPC beliefs may be mistaken without changing world truth.
- Meaningful memories preserve continuity and promote background NPCs to known.
- The complete audited suite passes 24 of 24 tests.

## Verified NPC relationship checkpoint

- Each relationship has one readable standing: hostile, unfriendly, neutral, friendly, or loyal.
- Optional qualities preserve nuance without adding multiple numerical meters.
- Relationships are directional and can target the player, another NPC, or a faction.
- Every relationship update records its cause and turn.
- The complete audited suite passes 25 of 25 tests.

## Verified NPC Context Gate checkpoint

- Scene context scales through a configurable detail budget rather than a fixed NPC count.
- Explicit focus, campaign links, category, location, and recency determine priority.
- Foreground NPCs receive full learned knowledge, memories, and relationships.
- Supporting NPCs receive compact identity and player-relationship context.
- Knowledge remains isolated per NPC; unlearned secrets are not inserted into that NPC's portrayal context.
- The complete audited suite passes 26 of 26 tests.

## Verified NPC teaching-library checkpoint

- The engine loads a local, expandable registry of approved outside sources and original distilled design lessons.
- Source licenses and required CC BY attribution are validated at startup/test time.
- Runtime retrieval selects short principles by design need rather than loading complete books or campaigns.
- The initial evaluator rejects missing character foundations, copied source-specific elements, duplicate names, and highly similar existing concepts.
- The complete audited suite passes 29 of 29 tests.

## Verified constrained NPC-generation checkpoint

- Minor NPCs are generated only after a concrete scene request.
- Every request must use an approved location, approved faction when applicable, role, category, reason, and turn.
- Generated designs use the teaching library, pass the originality evaluator, and receive persistent identity and design records.
- The novelty ledger prevents exact design-fingerprint reuse within a campaign.
- No large unused population is pre-generated.
- The complete audited suite passes 31 of 31 tests.

## Verified NPC lifecycle and rollback checkpoint

- NPCs can become injured, missing, detained, unavailable, dead, or departed without losing identity or history.
- Dead and departed NPCs are archived rather than deleted.
- Dead NPCs cannot return through ordinary engine behavior; only rollback currently reverses death.
- Turn snapshots now include NPC records, designs, novelty, knowledge, memories, relationships, and qualities.
- Rollback restores the complete prior NPC state and removes NPCs generated during the rolled-back turn.
- The complete audited suite passes 33 of 33 tests.

## Verified live-turn NPC integration checkpoint

- Adaptive NPC context is now part of the perspective sent to scene presentation and turn planning.
- Full NPC context includes the generated design profile plus only that NPC's learned knowledge, memories, and relationships.
- The Campaign Master may propose at most one new minor NPC in a committed turn.
- The engine—not the Campaign Master—chooses identity and design, validates canon, persists the result, and protects it with rollback.
- End-to-end tests cover Director proposal, validation, transactional generation, next-scene context, and rollback.
- The complete audited suite passes 35 of 35 tests.

## Verified NPC Turn Manager checkpoint

- The Campaign Master may propose bounded consequences only for existing current NPCs at the player's scene location.
- The engine validates one memory, an adjacent player-standing change, limited relationship qualities, one existing public fact, non-death status, connected movement, and continued/ended involvement.
- Active/known category changes are derived by the engine rather than assigned freely by the Campaign Master.
- Ordinary turn management cannot kill an NPC, invent a fact, reveal a new restricted fact, or move an NPC outside the current location graph.
- Public facts are included in perspective context so the Campaign Master can reference only facts the engine actually exposes.
- End-to-end tests confirm application and complete rollback of managed NPC consequences.
- The complete audited suite passes 36 of 36 tests.

## Active checkpoint

The real implementation boundary is recorded in `GHOST_FEATURE_AUDIT.md`. The application shell, limited continuity scaffold, and bounded NPC Engine foundation work; the complete DM Core remains unimplemented.

The approved top-level Velmora geography and district identities are stored in engine-readable faction and location data. The eight essential authored-character slots identify offices only; their campaign identities and personalities remain unfinished.

## Verified Story Engine memory foundation

- Persistent story-thread records now store kind, status, player/Director visibility, allowed stage range, urgency, involved locations/factions/NPCs, recovery paths, and continuity turns.
- Current-stage and current-location retrieval prevents premature or irrelevant threads from entering context.
- Player-facing scene context receives only player-known threads. Director turn planning receives a separate hidden-thread packet, preventing the hidden First Speaker arc from leaking into narration merely because the Campaign Master needs it for planning.
- Story-thread state is included in turn snapshots and rollback restoration.
- This memory foundation remains covered by the current audited suite.
- Validated thread-management authority remains unimplemented.

## Verified seeded campaign-blueprint foundation

- Each campaign seed deterministically selects one immediate opening pressure, two focal factions, one faction-pressure pattern, three distinct clue routes, and one later reversal.
- The generated blueprint is persisted once per campaign and is reproducible from the same seed while varying substantially across different seeds.
- The First Speaker's sustained takeover remains mechanically locked to Resolution, and selected reversals cannot enter during Opening.
- Campaign creation automatically seeds a player-visible opening thread plus Director-only Speaker-transformation, faction-pressure, and dormant-reversal threads.
- Initial scene placement receives only the selected visible opening crisis. Faction agendas, clue routes, reversal, and hidden Speaker truth remain outside player-facing narration context.
- Existing campaigns receive a deterministic blueprint and initial threads through the authored-state backfill.
- The audited suite passes 40 of 40 tests.
- The blueprint currently provides structural direction; the validated tools that let the Campaign Master advance and revise threads during play remain the next implementation slice.

## Corrected next phase—do not turn this into a prewritten campaign

Proceed to Section 2 of `MASTER_CHECKLIST.md` and `STORY_ENGINE_V1.md`: implement validated story-thread management so the Campaign Master can develop the generated structure during play without rewriting protected canon.

The user is not expected to author every scene, questline, NPC response, branch, or transition. Additional questions should be limited to protected canon, hard boundaries, and major story truths that the engine must not decide silently. The engine must generate and remember the playable campaign content.

## Later

1. Implement the approved Story Engine and DM Core rules in dependency order.
2. Connect the live Campaign Master and play-test a real campaign through the browser.
3. Build the dedicated Advancement and Skill Tree module only after character roles and the ability catalog exist.

## Scope fence

No additional authority, lore, or dependent feature design is added until the audited data foundation exists.
