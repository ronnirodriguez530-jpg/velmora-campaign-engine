# Velmora — Next Chat Handoff

## Start here

Continue from this file, then read:

1. `MASTER_CHECKLIST.md` — live project status and fixed work order.
2. `COMBAT_SYSTEM_V1.md` — implemented combat-engine boundary.
3. `COMBAT_INTERFACE_DRAFT_1.md` — approved first-version combat experience.
4. `CAMPAIGN_MASTER_TOOLBOX_V1.md` — authoritative single Campaign Master/toolbox architecture.

Do not use the opening section of `PROJECT_STATUS.md` as current status; that file is a preserved chronological record.

## Verified checkpoint

- Public repository: `ronnirodriguez530-jpg/velmora-campaign-engine`
- Branch: `main`
- Current public commit before this handoff: `927b9bb2d35d2bfe11b5fd01afdf01e8dd4eee3f`
- Version: `0.6.0`
- Full automated suite: **135/135 passing**
- Work through the combat-state foundation is implemented.
- Combat Interface Draft 1 is approved as a specification but is not yet implemented in the browser.

## Project purpose that must not drift

The user defines protected canon, hard boundaries, and major truths. The Campaign Master must generate and remember the playable campaign: scenes, dialogue, quests, complications, NPC behavior, connections, and recovery paths. Do not ask the user to author the campaign scene by scene.

The architecture is one adaptive Campaign Master using bounded tools, not multiple autonomous departments. Each tool must work from persisted state, respect engine validation, and remain usable by an online provider now while preserving a possible future offline provider boundary.

## Approved Combat Interface Draft 1

The approved screen contains:

- Top encounter name, round, and active turn.
- Visible player HP, Defense, range, remaining slots, and initiative.
- Central chronological battle dialogue feed.
- Visible hostiles, relevant ranges, and immediate encounter objective.
- Bottom action area with category controls, legal options, Custom Action, and End Turn.

Permanent categories:

- **Fight** — weapon/unarmed attacks and maneuvers.
- **Action** — movement, defend, cover, help, hide, environment, negotiation, escape, and surrender.
- **Powers** — powers and special abilities.
- **Bag** — carried items, consumables, equipment, and quest items.
- **Custom Action** remains a persistent text field rather than a category.

Normal turn budget:

- 1 Power
- 1 Action
- 1 Movement
- 1 Minor Interaction

Every option declares its slot cost. Resolve each selection immediately, consume its slot or slots, then show the remaining legal choices. End Turn is always available. Failed attempts still consume their declared slots. Pending selections and rolls survive refresh and cannot be rerolled.

Player rolls are prompted separately and explain their purpose, modifier, and target/stakes before the player clicks. Attack and damage are separate rolls; damage appears only after a hit. Other actors roll automatically, with every result shown.

Battle-feed identities:

- White: world/system/neutral
- Orange: Campaign Master narration
- Blue: player
- Green: NPCs and ordinary enemies
- Purple: party members
- Red: bosses

Always include the actor name/role; color alone is not sufficient.

Theater-of-the-mind ranges are Engaged, Near, Far, and Out of Reach. The Campaign Master determines credible movement from the scene, but the interface must show legal movement and expected resulting range before commitment.

There is no separate reaction slot in V1. At 0 HP the player becomes Downed. Without help, the player receives one Recovery Roll on each turn while circumstances allow. Success restores 1 HP and normal actions return on the next scheduled turn. Failed rolls do not accumulate toward automatic death.

## Exact next implementation checkpoint

Build the **player-facing turn controller** as the next small, independently tested checkpoint:

1. Persist the four-slot turn budget.
2. Tag available combat options with their slot costs.
3. Reject actions that are illegal, lack a target, violate range, or require spent slots.
4. Return short player-facing reasons for greyed-out options.
5. Resolve one selection immediately, then expose remaining slots.
6. Support End Turn without requiring every slot to be spent.
7. Preserve pending selection/roll state across refresh and prevent rerolls.
8. Add focused tests plus the full regression suite.
9. Update `MASTER_CHECKLIST.md`, commit, and publish to public GitHub before calling the checkpoint complete.

This checkpoint is primarily engineering from already approved rules. Do not reopen the Draft 1 layout or silently invent missing combat mechanics.

## Decisions that still require the user

Stop and ask before fixing rules for:

- Weapon-specific damage and combat maneuvers.
- Defend, help, hide, and cover effects.
- Healing items and other combat item effects.
- Power costs, limits, risks, combat values, and interruption.
- The initial condition list and exact effects.
- Creature, enemy, party-member, and group-turn behavior.
- Combat pacing enforcement.

Ask in small batches. Do not turn every implementation detail into a question; ask only when the answer would materially define gameplay or protected behavior.

## Checkpoint discipline

Every completed section must:

1. Match the live checklist and approved design.
2. Pass focused tests and the full suite.
3. Update documentation honestly.
4. Receive its own Git commit.
5. Be published to public GitHub `main`.
6. Verify local and public trees match before reporting completion.

Never call a specification playable, and never let invisible backend work masquerade as a finished player-facing feature.
