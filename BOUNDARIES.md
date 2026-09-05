# Velmora Content Boundaries

This file prevents engine scaffolding, tests, and generated output from silently becoming campaign canon.

## Confirmed canon

- Velmora is the compact playable world around a stable but unstable-surging Tear.
- Six wedge-shaped faction districts surround the Tear; the council hall sits at the crown position.
- The six established factions, the First Speaker, the Endless Surge, and the four broad campaign stages remain secured.
- The player initially controls one character.
- Normal quests support two major outcomes; turning points may support a third.
- Stage transition evaluates world state and requires meaningful progress through two of six faction lines.
- Tear arrivals may contain creatures, raw magical energy, and fragments of other worlds; payload count is one common, two uncommon, and three rare.
- Velmora's central Tear is the only true Tear in reality. Its instability can cause temporary voids or rifts to appear as wormholes whose origins may be any world, location, or universe.
- Void-rifts deliver creatures, energy, materials, weapons, relics, fragments, and other phenomena into Velmora. They are not additional Tears or normal routes for outward exploration.
- Crossing remains one-way. Rare special travel through an open connection may eventually exist, but nobody currently knows how.
- The Wayfarer Pact does not enter or explore the Tear. Its scavengers and specialists recover, identify, adapt, and trade materials, weapons, relics, and other objects that emerge from it inside Velmora.
- Raw Tear-magic leaves the First Speaker unconscious and unable to continue coordinating the six factions. Unknown to Velmora, the strike begins a transformation through which an unnamed crystalline void entity can gradually influence and control the Speaker. Until the Speaker recovers or a replacement is chosen, the six faction leaders collectively hold Velmora's political authority. Finding a replacement becomes an opening conflict, but the replacement and the events that produce them may differ between campaign runs.
- The player begins inside the Council Crown and reaches Council Plaza from one of six fixed starting situations for the First Speaker's public address. Every route gives the player a direct view when raw Tear-magic strikes the First Speaker and the Endless Surge begins but fails to end. The player's first actionable objective remains part of the unfinished playable-opening design.
- At campaign creation, a player-clicked d6 selects one of six fixed Council Crown spawn situations. Every result, including the player's reason for being there, remains identical across campaigns. The six approved entries are stored in `content/velmora/opening-spawns.json`; the Campaign Master may not rewrite a result, invent a seventh result, or move the opening outside the Crown.
- The Tear sits at Velmora's center. It begins relatively small at the campaign opening and grows as the story advances.
- A hybrid containment fortress surrounds the central Tear and is publicly justified as necessary for "safety." It combines a heavy inner wall, six controlled wedge-facing gates, a guarded circulation road, and magical anchor towers. It is guarded by an independent force attached to the office of the First Speaker, separate from the six factions. After the First Speaker falls, the Speaker's senior deputy or right hand maintains operational command of the guard and routine administration but gains no authority to coordinate or overrule the Sixfold Council. Its exact effectiveness remains uncertain.
- Possible approaches to the Tear include containing, stabilizing, studying, harnessing, redirecting, sealing, controlling, transforming, or destroying it. These are possible player and faction directions, not predetermined outcomes.
- The Tear event generator schedules possible arrivals and temporary void-rift events caused by Velmora's single central Tear. It cannot create a second true Tear or a general route for outside exploration.
- Early void-rifts appear by chance. Later, the unnamed crystalline void entity deliberately opens selected void-rifts and works through the transformed First Speaker toward controlled access to the central Tear and Velmora's connected containment system.
- The opening strike is the beginning of the First Speaker's transformation rather than a simple attack or completed possession. The Speaker remains alive within the transformation.
- During Stabilization, the First Speaker may appear to recover. The entity can take complete control only for brief periods, after which the Speaker returns with missing or distorted memories.
- Early takeovers are short and difficult to distinguish from injury or trauma. Over time, unfamiliar speech, impossible knowledge, altered priorities, crystalline physical signs, and growing interest in the containment system expose small cracks in the apparent recovery.
- The entity's control grows only through campaign-stage gates: hidden transformation in Opening, false recovery and brief control in Stabilization, longer influence and deliberate manipulation in Escalation, and a possible sustained takeover in Resolution.
- RNG may vary the symptoms, discoveries, complications, and timing allowed inside the current stage, but it cannot produce a later-stage transformation or launch the final takeover early.
- The entity ultimately seeks control of the Tear and Velmora itself by taking command of the citywide containment and control system. The exact method and final outcome remain unresolved until the campaign's later choices.
- The Order of Glass no longer inherits a mandatory bargain, corruption arc, or alliance with the entity. Its leader and faction may investigate, misunderstand, exploit, assist, or oppose the transformation according to campaign conditions and player choices.
- The Order of Glass presents itself as Velmora's wealthiest and most cultured district, with luxury commerce, arts, banking, diplomacy, records, and ordinary civic officials. Its real authority is a hidden guild of spies and thieves that controls appointments, intelligence, commerce, and major district decisions.
- The Order's faction leader is publicly its polished Sixfold Council representative and secretly the head of the guild. This preserves one faction leader and one council seat rather than creating a second hidden ruler.
- The guild uses informants, infiltration, disguise, surveillance, targeted theft, coded exchanges, and leverage to keep watch across Velmora. Its doctrine is that nothing in the city should happen without the Order knowing about it.
- Normal residents do not all belong to the guild. They live within a functioning district whose wealth and conventional administration conceal the covert structure operating underneath it.
- Across the population, 75% are unaware of the guild, 15% have heard speculative rumors, 5% genuinely suspect an organized covert power from patterns they have observed, and 5% know the truth but keep quiet. These groups are mutually exclusive and total 100%.
- Magic is new to the world and has no true masters. It may be innate, invented, engineered through magic-tech, discovered, taken, taught, or made.
- The central Tear and its void-rifts are the sources of the world's highest-tier magic. Other methods may produce useful magic but cannot silently exceed that power ceiling.
- Powerful Tear and void-rift magic can be controlled, but its early use carries substantial cost and risk. Experience, technique, equipment, or magic-tech may reduce that burden over time; exact costs and limits belong to the approved ability catalog.
- Magical alterations may be temporary, treatable, permanent, or capable of evolving further.
- Alterations use a three-level scale parallel to Tear rarity: Level 1 is common and minor, Level 2 is uncommon and significant, and Level 3 is rare and major. The level measures severity and complexity; exact duration, treatment, and evolution belong to the later alteration system.
- An alteration may affect the body, magical abilities, the mind, or a combination. Its timing is not a fixed story beat; eligible alteration events are selected randomly from an approved bounded catalog.
- The alteration system remains simple: each event needs only a level, affected area or areas, and a concise effect. Random generation cannot invent new permanent mechanics outside the approved catalog.
- Relics may be surviving objects from Velmora's old world, objects arriving from other worlds through void-rifts, or objects newly created inside Velmora.
- A relic's approved catalog entry must define its origin, capabilities, limits, and risks before the Campaign Master may use it mechanically.
- Creatures have only two origin categories: native life altered by magic, or beings arriving through void-rifts. Factions may study, treat, tame, or manage individual creatures and alterations, but they do not manufacture a third category of entirely new creature species.
- Relic and magic-tech content is curated in `content/velmora/RELIC_MAGIC_TECH_CATALOG.md`. Magic-tech may be refined institutional equipment or rough scrap-built equipment, but no item gains mechanical authority until the inventory and item systems exist.
- Random events may create opportunities to acquire a rare Level 3 ability, but they cannot automatically grant or permanently impose one.
- Approved rare-ability paths include unusual birth, surviving major Tear or void exposure, bonding with a rare relic, creating advanced magic-tech, evolving an existing ability, accepting a bargain, or receiving or taking power from another source.
- Permanent player ability acquisition requires an approved catalog entry, engine validation, character choice, and explicit player approval. Rare abilities begin costly or difficult to control and may become safer through experience, technique, or equipment.
- Each faction's leader is also that faction's representative on the Sixfold Council. The base leadership cast therefore contains six faction leaders rather than separate leaders and representatives.
- The First Speaker and six faction leaders are fixed offices, not fixed identities. A new campaign generates faction-appropriate identities, traits, abilities, relationships, and ambitions for those seven offices, then preserves them for that campaign.
- The First Speaker's senior deputy or right hand is also a variable campaign identity. This role preserves operations after the attack but cannot simply replace the First Speaker's political function.
- Each faction wedge is a distinct lived environment rather than only an administrative border. Following the approved blueprint references, the clockwise map order from the crown is Aurorus Circle, House Chrysalis, Hands of Velmora, League of Thorns, Wayfarer Pact, and Order of Glass. Approved colors, way of life, atmosphere, and landmarks are stored in the faction and location content files for use by the engine and map.
- The supplied map images are visual references, not automatic canon. Their circular structure, repeated faction order, central containment, radial circulation, outer wall, and defensive vocabulary are approved directions; incidental labels, measurements, exact buildings, and small notes remain non-canon until separately recorded.
- Required role-specific conflicts remain attached to the office. The generated First Speaker inherits the opening transformation, false recovery, intermittent control, and replacement conflict. No faction leader begins with a mandatory bargain or predetermined allegiance to the entity.

## Mechanical scaffolding—not canon

- Numeric faction-path progress from 0–3.
- The provisional stage thresholds tied to those numbers.
- The provisional 15% Tear-arrival check and 70/23/7 rarity weights.
- The four generic scene templates whose IDs begin with `TPL-SCAFFOLD`.
- The four generic quest formulas in `src/application/quest-generator.ts`.
- Turning-point completion as the current automatic advancement trigger.
- Simulation profiles and abstract milestones.

These parts exist so the engine can run, branch, and be tested. They may be replaced by approved content without changing canon.

## Test-only material

- Mock Director responses.
- Simulation actions such as `commit simulation step`.
- Generated test campaigns, seeds, scenes, and event histories.

## Deferred content

- Named quests and their actual milestones.
- Final opening-quest content, modular quest-generation rules and content, neglect-trigger execution, quest classification, and quest-based advancement cadence.
- Final mechanics, statistics, and campaign placement for the curated powers, creatures, relics, and magic-tech content.
- Final truth candidates and final outcomes.
- Exact faction relationships and detailed faction leadership.
- Final Tear frequency and probability tuning.

## Hard rule

The engine may select, place, combine, validate, and simulate approved structures. It may not promote scaffolding or generated material into canon, rewrite the setting, or create permanent new mechanics without approval. See `QUEST_ENGINE_DECISION_AUDIT.md` for the Quest Engine choices awaiting review.
