# Velmora QA Support Lab

This folder is deliberately isolated from the live runtime (`src/`) and automated test suite (`tests/`).

Purpose: stress-test whether Velmora behaves like a living DM when players do things the authored path did not anticipate.

Nothing in this folder is canon or runtime behavior by default. It is support material for identifying failure cases, documenting expected behavior, and handing concrete gaps back to implementation work.

## Rules

1. Do not treat material here as canon unless explicitly promoted elsewhere.
2. Do not import files from this directory into production runtime code.
3. A scenario passes only when the DM can understand the action, resolve it coherently, persist meaningful consequences, and continue play without requiring a prewritten branch.
4. Failures should be classified as: crash/runtime failure, state failure, reasoning failure, continuity failure, canon violation, dead-end/railroad, or degraded fallback.
5. Prefer general fixes over one-off scripted branches.

## Current focus

- Unexpected player actions
- Quest abandonment and quest destruction
- NPC death/refusal/betrayal
- Improvised locations and people
- World consequence propagation
- Delayed faction/NPC reactions
- Missing-information recovery
- Model/API/subsystem failure recovery
- Long-session continuity
- Contradictory or adversarial player input
