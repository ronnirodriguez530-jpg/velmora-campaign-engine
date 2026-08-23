# Velmora DM Core — Rules Foundation V1

Status: approved design checkpoint; implementation pending.

This file records only decisions explicitly established with the user. It is the rules contract for the first competent Campaign Master build. Later modules may extend these rules but must not silently replace them.

## Play priorities

- Campaign pacing target: approximately 65% story and 35% combat across the campaign, not a forced quota per session.
- Player controls one character initially; party control is a later expansion.
- Theater-of-the-mind play uses Engaged, Near, and Far zones.
- The player always retains free-text control. Suggested actions are optional.
- The main Story screen stays clean through progressive disclosure: contextual action dropdown, temporary roll popup, compact combat strip, and detailed trackers in their respective sidebar pages.

## Core resolution

- Roll: `d20 + relevant ability modifier + proficiency when applicable`.
- The DM calls for a roll only when the outcome is uncertain and meaningful.
- The player clicks Roll in a popup. The DM identifies the test and stakes; the exact DC normally remains hidden.
- Natural 20: critical success.
- Meet the DC: success.
- Miss by 1–3: success with a cost.
- Miss by 4 or more: failure.
- Natural 1: critical failure.
- Critical results remain proportional: they cannot accomplish the impossible or cause arbitrary campaign-breaking consequences.
- Advantage rolls two d20s and keeps the higher. Disadvantage keeps the lower. They do not stack and cancel each other.

### Difficulty ladder

- Easy: DC 8
- Standard: DC 12
- Hard: DC 16
- Extreme: DC 20

Difficulty follows the world and circumstances; it does not secretly scale to oppose the player.

## Character foundation

- Abilities: Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma.
- Starting array: 15, 14, 13, 12, 10, 8, assigned by the player.
- Modifier: `(score - 10) / 2`, rounded down.
- Standard 18-skill list.
- Player freely chooses four proficient skills; proficiency is +2.
- Player freely chooses two proficient saving throws; proficiency is +2.
- Starting maximum HP: `12 + Constitution modifier`.

## Combat

### Encounter detail

- Quick conflict: minor fights resolve through one or two meaningful rolls.
- Standard fight: player and major enemies act individually; similar minor enemies act as a group.
- Set-piece fight: important bosses and dramatic battles may use detailed turn-by-turn combat.
- The player may request to zoom in or resolve quickly.
- Allied NPC actions are summarized unless they directly affect the player.
- Enemies do not automatically fight to the death.

### Zones and turns

- Engaged: immediate melee reach.
- Near: reachable with one movement.
- Far: requires extra movement or ranged capability.
- Players and major named opponents roll individual initiative: `d20 + Dexterity modifier`.
- Similar minor enemies share initiative and a combined turn.
- On a standard turn, a character may move one zone and take one meaningful action.
- Suggested actions: Attack, Use Ability, Move, Guard, Help, Use Item, Flee, Do Something Else.

### Attacks, Defense, and damage

- Attack: `d20 + Strength or Dexterity modifier + proficiency` against Defense.
- Defense: `10 + Dexterity modifier + armor bonus`.
- Damage: weapon die plus Strength or Dexterity modifier.
- Attack and damage appear in one roll sequence.
- Critical hits roll the weapon die twice.

### Zero HP and death

- At 0 HP, the character falls unconscious and begins death saves.
- At the start of each turn, the player rolls: 10+ succeeds; 9 or lower fails.
- Three successes stabilize; three failures cause death.
- Natural 20 restores 1 HP; natural 1 counts as two failures.
- Damage while downed causes one failure; a critical hit causes two.
- Enemies normally shift attention away from unconscious characters unless an established reason says otherwise.

### Conditions

- Prone: standing uses movement; nearby melee attacks gain advantage and ranged attacks suffer disadvantage.
- Restrained: cannot move; own attacks suffer disadvantage; attacks against the target gain advantage.
- Stunned: cannot move or act.
- Hidden: cannot be directly targeted until detected; attacking reveals the character.
- Frightened: cannot willingly approach the source and suffers disadvantage while it is present.
- Poisoned: disadvantage on attacks and ability checks.
- Unconscious: follows the 0 HP rules.
- Each condition records its source, duration, and escape method.

### Morale

- Morale checks trigger when enemies lose their leader, half their force, or their objective.
- Roll `d20 + Wisdom modifier` against DC 12.
- Failure leads to flight, surrender, bargaining, or withdrawal according to the enemy's nature.
- Mindless or explicitly fearless creatures are exempt.

## Rest and recovery

- Short rest: one uninterrupted hour in a reasonably safe place; restore `1d6 + Constitution modifier` HP.
- Only one short-rest recovery occurs between long rests.
- Long rest: eight hours; restores full HP.
- A character at 0 HP must be stabilized before resting.
- Rest may be interrupted only by established danger.

## Magic and special abilities

- Usage types: at-will, once per short rest, or once per long rest.
- Every ability defines activation, target or zone, required roll, effect, duration, and usage limit.
- The DM may propose a new ability after a justified story event, but the player must Accept, Edit, or Reject it before it becomes permanent.
- Ability save DC: `10 + relevant ability modifier + 2 proficiency`.
- A character may maintain one sustained magical effect at a time.
- Taking damage while sustaining magic requires a DC 12 Constitution save; critical damage imposes disadvantage.
- Unconsciousness ends sustained effects.
- The actual Velmora ability catalog is required campaign content and remains unestablished.

## Equipment and inventory

- Inventory uses slots: `10 + Strength modifier`.
- Small bundles and normal items generally use 1 slot; bulky items use 2; very bulky items use 3.
- Currency and tiny personal objects use a small separate pouch unless unusually large.
- Equipped weapons and worn armor occupy slots.
- Exceeding capacity imposes disadvantage on physical checks and prevents moving from Far to Engaged in one turn.
- Only equipped items provide effects. Swapping equipment during combat uses an action; outside combat it does not.
- Consumables disappear when used.

### Weapon categories

- Improvised: d4
- Light: d6
- Standard: d8
- Heavy: d10 and normally 2 slots

### Armor

- None: +0 Defense
- Light: +1 Defense and 1 slot
- Medium: +2 Defense and 2 slots
- Heavy: +3 Defense and 3 slots
- Shield: +1 Defense, 1 slot, and one hand; incompatible with a heavy two-handed weapon.

## Silly Mode: Anything Goes

- A player-controlled on/off slider permits intentional actions outside normal rules and canon.
- While enabled, impossible declarations are valid player-authored overrides rather than DM hallucinations.
- Each override asks whether it is temporary or permanent.
- Permanent overrides enter campaign canon; temporary overrides end with their scene or effect.
- Overrides are recorded in history and can be undone.
- Silly Mode never permits save corruption or gives the DM control over the player character.

## Advancement boundary

V1 keeps advancement deliberately simple:

- Meaningful experience events are recorded automatically.
- XP cannot currently be spent, farmed, or converted into detailed upgrades.
- Story milestones trigger level advancement.
- Level rewards and character-specific progression remain blocked until roles and the actual ability catalog exist.

## Required later modules — named, not forgotten

1. Advancement and Skill Tree — study suitable progression systems from other games after character roles and abilities are established.
2. Rolled ability-score generation — optional alternative to the starting array.
3. Individual weapon dice and traits.
4. Detailed armor traits, Dexterity limits, and penalties.
5. Deeper magical-energy systems if the authored magic catalog requires them.
6. Actual Velmora power and ability catalog.
7. Velmora economy and item catalog.

