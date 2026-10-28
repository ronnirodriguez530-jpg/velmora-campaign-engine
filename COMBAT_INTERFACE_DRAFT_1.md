# Combat Interface — Draft 1 (Approved)

## Status

Approved design specification. This document fixes the intended first-version combat experience without marking the browser implementation complete.

## Screen structure

- Encounter name, round, and active turn remain visible at the top.
- Player health, Defense, range, remaining turn slots, and initiative remain visible without opening another page.
- The center of the screen is a chronological battle dialogue feed.
- Hostiles, relevant ranges, and the immediate encounter objective remain visible beside the feed.
- The action area stays available at the bottom with category controls, legal options, the Custom Action field, and End Turn.

## Player input

The permanent combat categories are:

- **Fight** — weapon attacks, unarmed attacks, and combat maneuvers.
- **Action** — movement, cover, defend, help, hide, environmental interaction, negotiation, escape, or surrender.
- **Powers** — currently available powers and special abilities.
- **Bag** — carried consumables, equipment, and quest items.

Custom Action is a persistent text field rather than another category. The Campaign Master interprets the player's request and divides it into legal slot costs. It asks for confirmation only when the interpretation is ambiguous or especially consequential.

## Turn budget

Each normal player turn provides:

- 1 Power
- 1 Action
- 1 Movement
- 1 Minor Interaction

Every option declares which slot or slots it consumes. A resolved choice immediately consumes its slots and greys out every remaining option that requires them. The player may end the turn without spending every slot. A failed attempt still consumes its declared slot.

Selections resolve immediately in this order:

1. Choose a category and legal option, or enter a Custom Action.
2. Choose any required target or details.
3. Receive a separate roll prompt when a player roll is required.
4. Resolve and narrate the result.
5. Show the remaining turn slots and legal options.

Committed selections and pending rolls must survive refresh. A refresh may not create a reroll.

## Battle dialogue feed

The feed is one chronological account of dialogue, narration, attacks, actions, and rolls. It uses both a named speaker label and a color identity:

| Color | Speaker or event |
| --- | --- |
| White | General world, system, and neutral events |
| Orange | Campaign Master narration |
| Blue | Player |
| Green | NPCs and ordinary enemies |
| Purple | Party members |
| Red | Bosses |

Color never replaces the actor name or role. Player rolls are announced before the clickable die and identify the purpose, modifier, and stakes or target. Attack and damage are separate prompts; damage is rolled only after a hit. NPC, party-member, enemy, and boss rolls occur automatically, but every result appears in the feed.

## Theater-of-the-mind position

Combat uses four visible ranges:

- Engaged
- Near
- Far
- Out of Reach

The Campaign Master determines credible movement from the scene, terrain, obstacles, engagement, and abilities. The interface shows legal movement choices and their expected resulting range before selection. Invalid actions or targets are greyed out with a short reason.

## First-version boundaries

- There is no separate player reaction slot.
- Saving throws and passive defenses may still resolve as rule responses.
- At 0 HP, the player becomes Downed and normal turn slots are disabled.
- A Downed player without available help receives one Recovery Roll on each of their turns while circumstances allow.
- A successful Recovery Roll restores 1 HP; normal actions return on the player's next scheduled turn.
- Failed Recovery Rolls do not accumulate toward automatic death.
- Capture, stabilization, removal, retreating enemies, or the end of the encounter may replace or end the Recovery Roll loop.

## Design boundary

This interface organizes access to the combat engine. It does not prewrite encounters, enemy decisions, dialogue, or scene flow. Those remain adaptive Campaign Master responsibilities constrained by the saved world, quest, character, and combat state.
