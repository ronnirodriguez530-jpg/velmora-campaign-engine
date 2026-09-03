# Velmora Progression System V1

## Working scope

Velmora uses story-driven milestones rather than grindable experience points. Each unique validated major milestone awards one advancement opportunity. Spending an opportunity requires an explicit player-approved choice.

The first checkpoint supports:

- Persistent milestone records with unique source protection
- Quest, faction, story, and major-discovery source categories
- Earned, spent, and available advancement totals
- A player-approved +1 ability-score improvement
- A player-approved new skill proficiency
- Ability-score cap of 18 for the first release
- Recalculation of ability modifiers, health, and defense
- Persistent advancement history, player-context retrieval, save compatibility, and rollback

## Protected rules

- The same milestone source cannot award progression twice.
- Minor actions, repeated rolls, combat farming, and ordinary scene completion do not award advancement.
- The Campaign Master cannot spend an advancement or alter a character without explicit player approval.
- An improvement consumes exactly one available advancement opportunity.
- An existing skill proficiency cannot be selected again.
- First-release ability scores cannot advance above 18.
- A rolled-back turn restores the character, milestones, advancement totals, and advancement history together.

## Current authority boundary

Milestone awarding is an internal application function. It is not yet exposed to the Campaign Master because quests and verified milestone-source records do not exist. The future Quest Engine must connect a requested award to a completed major objective, faction milestone, protected story event, or recorded major discovery before the award is committed.

## Still required

- Validated Quest Engine authority to award milestones from real completed objectives
- Power upgrades and equipment improvements
- Advancement-choice browser interface
- Long-campaign pacing evaluation and possible opportunity-rate adjustment
- Later skill-tree module, kept separate until the first-release system is proven
