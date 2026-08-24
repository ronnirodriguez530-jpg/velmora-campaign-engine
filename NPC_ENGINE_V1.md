# Velmora NPC Engine V1

## Status

This document is the build contract for the NPC foundation. Each approved section is implemented and tested before dependent behavior is added.

## Approved architecture

- Major NPCs are authored.
- Minor NPCs may be generated under Velmora canon, faction, location, and role constraints.
- A dedicated NPC Engine owns NPC identity, storage, memory, relationships, lifecycle, relevance, and repetition control.
- The Campaign Master may request or portray an NPC, but it cannot directly rewrite NPC truth.
- The NPC Engine uses a curated, expandable reference library. It does not browse freely during play.
- Outside material teaches character-design principles and patterns; it is not copied into Velmora characters.

## Storage categories

Every NPC belongs to exactly one category:

1. `active`: currently involved in a scene, quest, conflict, faction decision, or immediate player stake.
2. `known`: encountered or consequential, but not currently active.
3. `background`: a lightweight continuity record for an incidental or inactive character.

NPCs are reclassified after meaningful events. Reclassification never deletes identity or history.

### Required transitions

- Background to known: named, meaningfully encountered, affected by the player, or witness to an important event.
- Known to active: enters the current scene or becomes directly relevant to a quest, conflict, faction decision, threat, or alliance.
- Active to known: immediate involvement ends.
- Known to background: extended inactivity with no unresolved persistent tie.
- Any NPC remains known or active when tied to a relationship, secret, promise, consequence, or clear player interest.

## Implemented checkpoint

- Persistent NPC records and the three storage categories.
- Automatic category decision from approved relevance signals.
- Recorded category-change reason and event history.
- Tests proving promotion, demotion protection, persistence, and no silent deletion.
- Separate world truth, NPC knowledge, NPC belief, and personal memory records.
- Facts remain unknown to an NPC until explicitly learned by witnessing, being told, or inference.
- Belief may disagree with world truth without changing that truth.
- Meaningful personal memories automatically promote background NPCs to known.
- Directional relationships combine one standing (`hostile` through `loyal`) with optional qualities and a complete cause history.
- Initial qualities are `trusted`, `wary`, `afraid`, `indebted`, `respectful`, and `attached`.
- An adaptive Context Gate ranks NPCs by explicit scene focus, current links, category, location, and recency.
- Context uses a configurable detail budget rather than a fixed cast size.
- Full-detail NPCs include only their own learned knowledge, memories, and directional relationships.
- Supporting NPCs retain compact identity and player-relationship context; overflow is counted for group treatment rather than silently erased.
- The curated reference library registers source identity, license, allowed use, and required attribution.
- Runtime retrieval uses short, original teaching principles and evaluation checks rather than complete source text.
- The initial curriculum draws from public-domain fiction craft sources and the CC BY 4.0 SRD rules reference.
- The design evaluator rejects source-specific copied elements, duplicate names, incomplete designs, and highly similar existing concepts.
- On-demand generation requires an explicit scene reason, approved location, approved faction when applicable, role, category, and campaign turn.
- Generated minor NPCs receive an original design profile, applied curriculum lessons, and a permanent novelty fingerprint.
- Repeating the same request cannot silently reuse the same identity or design fingerprint.
- The generator does not pre-fill unused population. A small persistent resident base can be authored separately and additional minor NPCs are created only when needed.
- NPC lifecycle supports available, injured, missing, detained, unavailable, dead, and departed states.
- Dead and departed NPCs are archived rather than deleted. Dead NPCs cannot return without a future explicitly approved resurrection rule.
- NPC records, designs, novelty, knowledge, memories, and relationships are included in turn snapshots and restored by rollback.
- The live perspective context now includes the adaptive NPC Context Gate output.
- The Campaign Master can propose at most one minor-NPC request per committed turn. The engine validates current location, faction, role, category, and reason before generating and storing anything.
- The Campaign Master cannot supply the NPC identity or bypass the design evaluator, novelty ledger, transaction, or rollback system.
- The NPC Turn Manager accepts bounded updates only for existing, current NPCs at the player's scene location.
- A managed turn may record one memory, one adjacent player-standing change, up to two relationship-quality changes, one existing public fact, a non-death status, connected movement, and whether involvement continues or ends.
- The engine derives active/known category from involvement. Ordinary turn management cannot kill an NPC, invent a fact, reveal a new restricted fact, or move an NPC beyond the current location graph.

## Not implemented yet

- Validated reveal events for restricted knowledge and dedicated high-consequence death resolution.
