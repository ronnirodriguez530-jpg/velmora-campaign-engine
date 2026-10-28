# Combat System V1

## Purpose

This checkpoint establishes the minimum persistent theater-of-the-mind combat state. It gives the Campaign Master a rules boundary for an encounter; it does not prescribe a scene, enemy, or story route.

## Implemented

- One active encounter per campaign
- Quick, standard, and set-piece modes with bounded participant limits
- Player, hostile, and supporting combatants
- Initiative, rounds, current actor, HP, Defense, attack bonuses, and bounded damage dice
- Natural 1 misses, natural 20 critical hits, damage, defeat, victory, and player HP persistence
- Credible escape, surrender, and negotiation exits
- Atomic encounter actions, durable audit events, save compatibility, and one-turn rollback

The player combatant is derived from the saved character. Other combatants are supplied as validated encounter ingredients, allowing the Campaign Master to construct encounters from current quests and world state rather than selecting a prewritten fight.

The approved player-facing experience is specified separately in `COMBAT_INTERFACE_DRAFT_1.md`. Its layout and interaction rules are approved, but its browser implementation remains unfinished.

## Deliberately unfinished

- Browser implementation of the approved Draft 1 combat interface and player-clicked combat rolls
- Campaign Master encounter-generation tools and creature behavior
- Conditions, death, rest, recovery, healing, equipment damage, and power effects
- Condensed group and supporting-NPC turns
- Pacing enforcement and the approximately 65/35 story-to-combat target
- Full integration of combat results with quests, NPCs, factions, and locations

Noncombat exits currently consume an already resolved action-check outcome. The later Campaign Master and browser checkpoints must connect that boundary to the existing player-clicked dice workflow; they may not silently roll on the player's behalf.
