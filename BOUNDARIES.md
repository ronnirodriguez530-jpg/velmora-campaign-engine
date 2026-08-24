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
