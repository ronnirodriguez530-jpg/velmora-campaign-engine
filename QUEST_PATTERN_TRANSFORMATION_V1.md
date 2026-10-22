# Quest Pattern Transformation V1

This layer converts causally relevant abstract quest-design patterns into a bounded recipe for an original Velmora quest candidate. It does not author scenes and is not yet connected to live quest generation.

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

Internal phrase-overlap evaluation runs without a provider. Semantic and sequence scores are validated when supplied, but the live AI adapter does not yet calculate them. Live quest generation must not claim this layer until it supplies a candidate, similarity signals, and an accepted evaluation before persistence.

## Tests

The focused tests prove deterministic composition, minimum source diversity, refusal to force irrelevant patterns, acceptance of an original Velmora candidate, and rejection of unbound entities, source references, pattern/facet dominance, copied wording, and excessive semantic or sequence similarity.

## Next integration

The next checkpoint must connect this layer to quest composition without changing the approved player-facing contract:

1. derive causal tags from the active story thread and world state;
2. build the bounded recipe;
3. generate only goal, stakes, and two or three likely directions;
4. evaluate originality and structural legality;
5. retry or reject before any quest is persisted;
6. keep hidden outcomes, consequence seeds, and exact objectives outside player context.
