# Quest Reference Research V1

This ledger records why each observational reference was admitted to Velmora's quest-design library. It is design analysis, not a source-content archive or a set of scenes to reproduce.

## Admission rules

- The reference must fill a defined DM-engine design gap.
- A public developer or design source and independent recognition record must be stored in `content/quest-reference/sources.json`.
- Only an abstract structural pattern may enter `patterns.json`.
- Source characters, setting, dialogue, quest text, scene order, signature objects, and solution chains are excluded.
- Live quest generation must eventually combine at least three distinct sources and realize the result entirely through current Velmora state.

## Batch 1 — foundational behavior

| Observed work | Design area examined | Abstract lesson retained | Not retained |
| --- | --- | --- | --- |
| Outer Wilds | Curiosity-led exploration and its information network | Let an answered local question expose another actionable question; learned information is progression | Time-loop premise, planetary structure, discoveries, or solution chain |
| Disco Elysium | Expressive dialogue branching | Choices can define intent, trust, access, and identity without every line producing a giant plot branch | Internal voices, prose style, politics, characters, or dialogue |
| Hades | Persistent reactive dialogue | Selective callbacks make success and failure part of continuing relationships | Mythological cast, escape cycle, dialogue, or encounter cadence |

## Batch 2 — quest depth and resilience

| Observed work and useful examples | Design gap filled | Abstract lesson retained | Not retained |
| --- | --- | --- | --- |
| The Witcher 3; the Family Matters/Bloody Baron arc | Morally complicated human quests | Recontextualize an understandable request through credible testimony and consequences; force priorities between incompatible responsibilities; control length through paced revelations | Family history, creatures, curse, scenes, characters, dialogue, or resolution tree |
| Fallout: New Vegas; faction routes and Beyond the Beef | Political plurality and dense solution space | Factions contain disagreement; the player deals with actual members and affected people; skills and relationships create distinct leverage | Mojave setting, factions, casino plot, characters, dialogue checks, or endings |
| Baldur's Gate 3; Save Mayrina and the linked Iron Throne/Steel Watch situations | Unexpected actions and interlocking quest state | Define the required world change rather than one required action sequence; preserve missing actors, reordered events, and collateral effects | Characters, locations, encounters, signature objects, exploits, or branch sequence |
| Pentiment; its constrained murder investigations | Investigation under incomplete information | Generate clues from a causal truth, limit what can be pursued, distinguish proof from context, and let a defensible judgment alter the community | Historical setting, murders, suspects, visual language, dialogue, or multi-era plot |
| Deus Ex: Human Revolution; police-station demonstrations | Character capability expressed as approach | Build obstacles with social, physical, informational, environmental, and covert affordances that carry different risks and consequences | Cyberpunk setting, augmentations, level layouts, named characters, or mission solutions |
| Mass Effect 2; loyalty missions and final convergence | Relationship investment with mechanical payoff | Personal pressures establish trust and readiness; a later crisis tests preparation, knowledge, and assignments without using one automatic loyalty score | Crew, recruitment flow, science-fiction premise, loyalty quests, assignments, or survival formula |

## Coverage gained

The two batches now cover curiosity, dialogue identity, callbacks, moral recontextualization, faction politics, unexpected solutions, incomplete investigations, capability-based approaches, and relationship payoff. These are separate design departments; no single pattern is treated as a complete quest.

## Remaining work

The library is not yet connected to live quest generation. The next layer must:

1. retrieve a bounded set of causally relevant patterns from at least three distinct sources;
2. transform them through current Velmora NPC, faction, location, thread, and consequence state;
3. reject source similarity and unsupported combinations;
4. produce only goal, stakes, and credible directions at quest creation;
5. evaluate generated quests for originality, coherence, bounded complexity, and recovery behavior.
