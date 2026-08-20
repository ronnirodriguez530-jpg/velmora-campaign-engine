# Velmora Project Status

## Current phase

Local browser application integration.

## Completed

1. Campaign foundation and core Velmora canon recorded.
2. Headless local engine created.
3. Persistent world state, perspective filtering, validation, checkpoints, rollback, and event history implemented.
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
- Action results are prompted as story while all durable changes remain engine-validated.
- Diagnostic narration is visibly labeled and replaced when the Live Campaign Master connects.
- Main interface rebuilt around narration and player input.
- Character, quests, factions, locations, inventory, history, and settings moved into the top-left navigation.
- Actionable section badges are wired to current engine state.
- The API key can be configured locally through Settings without placing it in chat.
- Full suite passed: 19 of 19 tests.

## Active checkpoint

Restart the local app, connect the user's API key through Settings, and perform the first real Campaign Master scene call. This is the only remaining unverified connection in the current build.

## Next phase—do not skip ahead

Perform the first real Campaign Master play-test through the working browser application.

## Later

1. Play-test one real campaign through the browser.
2. Approve only the minimum content gaps demonstrated by that play-test.
3. Establish the GitHub repository and release workflow.

## Scope fence

No additional lore systems or content categories are added during the current phase.
