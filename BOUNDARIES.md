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
- Raw Tear-magic leaves the First Speaker unconscious and unable to continue coordinating the six factions. Finding a replacement becomes an opening conflict, but the replacement and the events that produce them may differ between campaign runs.
- The Tear sits at Velmora's center. It begins relatively small at the campaign opening and grows as the story advances.
- Possible approaches to the Tear include containing, stabilizing, studying, harnessing, redirecting, sealing, controlling, transforming, or destroying it. These are possible player and faction directions, not predetermined outcomes.
- The Tear event generator schedules possible arrivals and temporary void-rift events caused by Velmora's single central Tear. It cannot create a second true Tear or a general route for outside exploration.
- Early void-rifts appear by chance. Later, an unnamed crystalline, cosmic void entity deliberately opens selected void-rifts, and the Order of Glass eventually learns to open controlled void-rifts of its own.
- The Order uses controlled void-rifts for contact, observation, power, or extraction but does not travel through them.
- The void entity inhabits the remote side of a recurring void signature. Its power unknowingly strengthens and magically empowers the Order of Glass; only the Order's leader eventually discovers the source.
- The Order's leader traces the recurring power, encounters the entity through an open void while remaining in Velmora, and accepts a bargain: greater power in exchange for helping the entity acquire power from other people, magical sources, or potentially the central Tear.
- The exact power granted by the bargain may vary with the campaign but must come from an approved power catalog and remain within engine limits.
- As the campaign progresses, the leader becomes increasingly power-lusted and unable to bear the influence. The entity increasingly pushes or makes decisions through him, creating a major Order of Glass conflict.
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

## Mechanical scaffolding—not canon

- Numeric faction-path progress from 0–3.
- The provisional stage thresholds tied to those numbers.
- The provisional 15% Tear-arrival check and 70/23/7 rarity weights.
- The four generic scene templates whose IDs begin with `TPL-SCAFFOLD`.
- Simulation profiles and abstract milestones.
- The `Guarded Central Avenue` name and its exact map function.
- The exact name, shape, and connection layout of the current `Tear Containment Ring` node. A contained central Tear is canon; this particular map implementation remains provisional until the location section is approved.

These parts exist so the engine can run, branch, and be tested. They may be replaced by approved content without changing canon.

## Test-only material

- Mock Director responses.
- Simulation actions such as `commit simulation step`.
- Generated test campaigns, seeds, scenes, and event histories.

## Deferred content

- Named quests and their actual milestones.
- Specific powers, creatures, major beings, relics, and world fragments.
- Final truth candidates and final outcomes.
- Exact faction relationships and detailed faction leadership.
- Final Tear frequency and probability tuning.

## Hard rule

The engine may select, place, combine, validate, and simulate approved structures. It may not promote scaffolding or generated material into canon, rewrite the setting, or create permanent new mechanics without approval.
