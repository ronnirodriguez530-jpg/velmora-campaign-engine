# Quest Pattern Transformation V1

This layer converts causally relevant abstract quest-design patterns into a bounded recipe for an original Velmora quest candidate. It does not author scenes. As of version 0.5.2, the internal recipe and originality gate is connected to ordinary and recovery quest generation.

## Composition contract

Every recipe:

- begins with current story-thread context and stable Velmora location, NPC, and faction IDs;
- retrieves only patterns matching causal quest tags;
- requires at least three distinct reference sources;
- uses three to five patterns, bounded by repository policy;
- ranks relevance before seeded tie-breaking;
- refuses composition instead of adding unrelated material to meet the source minimum;
- assigns setup, pressure, turn, failure, and echo across selected patterns;
- prevents one pattern from controlling more than two design facets;
- permits two directions normally and three only when the caller supplies the approved turning-point bound.

The recipe is an instruction scaffold. Pattern functions must be transformed through current Velmora state; their wording and their source works are not output content.

## Candidate validation

A candidate is rejected when it:

- uses a different recipe;
- lacks a goal, stakes, two credible directions, or likely tradeoffs;
- exceeds the recipe's direction cap;
- names an entity not bound to the recipe;
- fails to remain connected to its story thread;
- introduces any source-specific reference;
- uses an unselected or duplicated pattern;
- lets one pattern dominate more than two facets;
- omits or duplicates setup, pressure, turn, failure, or echo;
- materially combines fewer than three distinct sources;
- copies too much five-word phrasing from the abstract reference records;
- exceeds an approved external lexical, semantic, or sequence-similarity threshold.

## Similarity thresholds

| Signal | Reject at or above |
| --- | ---: |
| Lexical | 0.35 |
| Semantic | 0.72 |
| Sequence | 0.50 |

Internal phrase-overlap evaluation runs without a provider. Semantic and sequence scores are validated when supplied, but the live AI adapter does not yet calculate them.

## Live persistence gate

Before an engine-generated ordinary or recovery quest is persisted, the generator now:

1. derives causal tags from the active thread's kind, urgency, people, factions, and locations;
2. constructs a deterministic three-source recipe;
3. converts the generated goal, stakes, directions, tradeoffs, and world bindings into a candidate;
4. evaluates the candidate against structural, source-diversity, world-binding, facet-dominance, and phrase-overlap rules;
5. rejects the operation before persistence when evaluation fails;
6. stores the accepted recipe ID, pattern/source provenance, source count, and overlap result as a Director-only audit record.

The player-facing quest view removes this audit record. Players see only the approved quest information, not reference sources or hidden design machinery. Authored and legacy quest records remain compatible through a `null` audit value.

External lexical, semantic, or sequence signals may be supplied to the same live gate. A failing signal leaves neither a quest row nor a `quest_created` event. Automatic provider scoring remains unfinished.

## Tests

The focused tests prove deterministic composition, minimum source diversity, refusal to force irrelevant patterns, acceptance of an original Velmora candidate, and rejection of unbound entities, source references, pattern/facet dominance, copied wording, and excessive semantic or sequence similarity.

## Next integration

The next checkpoint must connect the cloud Campaign Master to automatic semantic and sequence scoring, then retry a rejected provider candidate within a strict bounded attempt limit. Hidden outcomes, consequence seeds, exact objectives, and reference audits must remain outside player context.
