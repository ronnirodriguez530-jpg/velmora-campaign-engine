# Velmora System Integration Matrix

## Purpose

This matrix answers a stricter question than “does code exist?”:

> Can this system participate in the actual Campaign Master → validation → game state → browser → save/rollback loop?

Tags, catalogs, prose, schemas, and isolated unit tests are useful inputs. None of them alone make a feature integrated or playable.

## Seven integration gates

A first-release feature is **integrated** only when every applicable gate passes:

1. **Definition** — stable typed definitions, IDs, boundaries, and runtime validation exist.
2. **State** — campaign-specific state persists in the save rather than living only in prompts or prose.
3. **Mechanics** — executable rules read and change that state; labels do not substitute for behavior.
4. **Campaign Master authority** — the Campaign Master can use the feature only through an explicit validated tool, or an engine-owned controller invokes it at a clearly documented boundary.
5. **Context and visibility** — relevant state reaches the correct player or Director perspective without leaking hidden information or flooding every request.
6. **Player surface** — the browser lets the player see and use the feature when player interaction is required.
7. **Recovery proof** — persistence, refresh behavior, rollback, compatibility, and at least one end-to-end or cross-module test prove the complete path.

Status key:

- **PASS** — the gate works for the stated first-release scope.
- **PARTIAL** — real implementation exists, but the gate is incomplete or narrow.
- **MISSING** — the required bridge does not exist.
- **N/A** — the gate is not required for that system.

## Current matrix

| System | Definition | State | Mechanics | CM authority | Context | Browser | Recovery proof | Honest status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Protected world canon | PASS | PASS | PASS | N/A | PASS | PARTIAL | PASS | Working foundation |
| Campaign blueprint and opening controller | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Integrated opening foundation |
| Story-thread ledger | PASS | PASS | PASS | PASS | PASS | PARTIAL | PASS | Integrated engine foundation |
| Quest Engine | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Integrated foundation; long-form quality still unverified |
| Scene presentation/composition | PASS | PASS | PARTIAL | PARTIAL | PASS | PASS | PARTIAL | Mocked/cloud presentation works; complete composer and real-provider proof missing |
| NPC Engine | PASS | PASS | PASS | PASS | PASS | MISSING | PASS | Engine-integrated; dedicated player presentation and real-provider evaluation missing |
| Faction Engine | PASS | PASS | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PASS | Condition/path scaffold only |
| Location/world state | PASS | PASS | PARTIAL | PARTIAL | PASS | PARTIAL | PASS | Movement/consequence foundation only |
| Player character | PASS | PASS | PASS | PARTIAL | PASS | PASS | PASS | Core character integrated; background, role, ties, recovery, and party missing |
| Noncombat action and dice | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Integrated foundation |
| Combat encounter state | PASS | PASS | PARTIAL | MISSING | PARTIAL | MISSING | PASS | Equipped weapons now drive attacks; encounter authority and browser loop still missing |
| Inventory/equipment | PASS | PASS | PARTIAL | MISSING | PASS | MISSING | PASS | Weapon/Defense equipment mechanics work; broader item use and player loop missing |
| Powers/abilities | PASS | PASS | PARTIAL | MISSING | PASS | MISSING | PASS | Ownership/sustained activation work; effects and use loop missing |
| Progression | PASS | PASS | PASS | PARTIAL | PASS | MISSING | PASS | Quest reward bridge works; player spending surface and wider rewards missing |
| Tear/Surge events | PARTIAL | PASS | PARTIAL | MISSING | PARTIAL | PARTIAL | PARTIAL | Arrival records exist; payloads do not act on the world |
| Creatures and altered life | PARTIAL | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | Curated catalog only |
| Relics and magic-tech effects | PARTIAL | PARTIAL | MISSING | MISSING | PARTIAL | MISSING | PARTIAL | Some item records exist; most curated effects remain reference-only |
| Journal | PASS | PASS | PASS | N/A | PASS | PASS | PASS | Integrated compact reminder |
| Persistence/update system | PASS | PASS | PARTIAL | N/A | N/A | PASS | PARTIAL | Saves/rollback/update work; migrations/export/recovery incomplete |
| Adaptive Campaign Master learning | PASS | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | Contract only; deliberately later |
| Autonomous off-screen world | PARTIAL | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | Deliberately later |

## Proven connected game path

The following path is real and tested:

1. Campaign creation persists a seed, blueprint, opening state, initial threads, faction/location state, and save record.
2. Character creation persists one player character and derived statistics.
3. The opening d6 and hidden convergence controller drive adaptive exploration, the witnessed First Speaker strike, the hidden crisis, and the first generated quest.
4. A player action is assessed as automatic or uncertain.
5. A required noncombat roll becomes a refresh-safe player-clicked check.
6. The Campaign Master receives filtered player and Director context and proposes a bounded plan.
7. Validators accept or reject faction, location, NPC, story-thread, and quest tools.
8. Accepted tools commit atomically with event history, checkpoints, and rollback.
9. The next context, story presentation, Quest journal, and recent-event journal use the committed state.

That path is the current integrated core. It does not yet include item use, power use, combat initiation/consequences, creature payloads, or progression spending through the browser.

## Confirmed bridge failures

### Campaign Master tool gap

The validated `ToolRequest` union and executor currently cover factions, fixed-character reputation, movement, location consequences, minor NPC creation, NPC updates, story threads, and quests. They do **not** provide Campaign Master tools for:

- starting or managing encounters;
- using, granting, removing, equipping, or switching items;
- using powers or applying power effects;
- offering or spending progression improvements;
- materializing Tear payloads, creatures, relics, or alterations.

Inventory, powers, progression, and combat may be present in context or reachable through direct application functions, but they are not yet part of the validated Campaign Master plan.

### Player-surface gap

- Inventory is still a static empty browser page even when inventory exists.
- Combat state and roll APIs exist, but Draft 1 controls are not rendered.
- Powers and progression have no player controls.
- NPC relationships and detailed world consequences lack dedicated presentation.

### Content-to-mechanics gap

Creature, relic, magic-tech, and Tear catalogs contain approved ideas and tags, but most entries have no typed executable effects, placement authority, state transitions, or consequence tools. Those records are reference material until they pass all applicable gates.

### Real-provider gap

Mocked and local tests prove contracts. They do not prove that a live Campaign Master can sustain a coherent campaign, choose tools correctly, preserve voice and pacing, or recover from provider failures over long play.

## Bridge implementation order

Work proceeds in dependency order. Each line is a separate tested and public GitHub checkpoint:

1. **Weapon/inventory/combat bridge — COMPLETE** — typed weapon mechanics, d4+Strength unarmed fallback, equipped-weapon derivation, Minor Interaction switching, and combat use from actual inventory.
2. **Encounter authority bridge** — validated Campaign Master encounter start, participant construction, exit/outcome propagation, and quest/world consequences.
3. **Draft 1 combat browser bridge** — real categories, legal options, targets, player-clicked rolls, remaining slots, dialogue feed, and refresh recovery.
4. **Power-use bridge** — approved costs/limits/effects, Power-slot use, validated authority, and browser controls.
5. **Item-use and recovery bridge** — Bag actions, healing/recovery, charges where approved, and durable outcomes.
6. **Progression browser bridge** — player-visible opportunities and explicit approved spending.
7. **Faction/Tear/content bridge** — political pressures and mechanically usable creatures, alterations, relics, and payload placement.
8. **Complete scene-composer/DM bridge** — combine validated systems during play, then run sustained real-provider evaluations.
9. **Release-reliability bridge** — migrations, export/import, backup/recovery, security, accessibility, packaging, and release tests.

If a bridge depends on an unresolved gameplay choice, implementation pauses for that choice. The engine may not invent the rule silently.

## Completion rule

From this checkpoint forward:

- A checked schema or catalog item means **defined**, not playable.
- An isolated application function means **mechanical foundation**, not integrated.
- Context visibility without a validated action path means **read-only connection**, not operational connection.
- An API without rendered controls means **backend-accessible**, not player-facing.
- Unit tests without a cross-module path mean **locally proven**, not end-to-end.
- Only features passing all applicable gates may be described as integrated or complete.
