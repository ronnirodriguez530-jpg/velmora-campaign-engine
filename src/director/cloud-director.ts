import type { CampaignDirector } from "./director.ts";
import type {
  ActionAssessment,
  ActionResolution,
  DirectorContext,
  DirectorPlanningContext,
  DirectorPreview,
  DirectorTurnPlan,
  PerspectiveContext,
  ScenePackage,
  StoryPresentation,
  ToolRequest
} from "../domain/types.ts";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type CloudDirectorOptions = {
  apiKey: string;
  model?: string;
  fetchImpl?: FetchLike;
  endpoint?: string;
  timeoutMs?: number;
};

export type DirectorUsage = { inputTokens: number; outputTokens: number; totalTokens: number };

type SubmittedPlan = {
  summary: string;
  majorActionProposal: boolean;
  factionChanges: Array<{ factionId: string; delta: -1 | 1; reason: string }>;
  npcReputationChanges: Array<{ characterId: string; delta: -1 | 1; reason: string }>;
  movements: Array<{ locationId: string; reason: string }>;
  factionPathAdvances: Array<{ factionId: string; reason: string }>;
  locationConsequences: Array<{ locationId: string; consequence: string; reason: string }>;
  npcRequests: Array<{
    role: string;
    factionId: string | null;
    locationId: string;
    category: "active" | "known" | "background";
    reason: string;
  }>;
  npcUpdates: Array<{
    npcId: string;
    involvement: "continues" | "ends";
    memory: { summary: string; emotionalImpact: string; importance: 1 | 2 | 3; unresolved: boolean } | null;
    playerRelationship: {
      standing: "hostile" | "unfriendly" | "neutral" | "friendly" | "loyal";
      addQualities: Array<"trusted" | "wary" | "afraid" | "indebted" | "respectful" | "attached">;
      removeQualities: Array<"trusted" | "wary" | "afraid" | "indebted" | "respectful" | "attached">;
      reason: string;
    } | null;
    learnedFact: {
      factId: string;
      method: "witnessed" | "told" | "inferred";
      confidence: number;
      believedState: "true" | "false" | "uncertain";
    } | null;
    status: "available" | "injured" | "missing" | "detained" | "unavailable" | "departed" | null;
    newLocationId: string | null;
    reason: string;
  }>;
  storyThreadUpdates: Array<{
    threadId: string;
    action: "activate" | "advance" | "block" | "resolve" | "fail" | "replace";
    summary: string;
    urgency: 0 | 1 | 2 | 3;
    recoveryPathUsed: string | null;
    replacement: {
      threadId: string;
      title: string;
      summary: string;
      kind: "main" | "faction" | "side" | "personal" | "mystery" | "dynamic";
      urgency: 0 | 1 | 2 | 3;
      locationIds: string[];
      factionIds: string[];
      npcIds: string[];
      recoveryPaths: string[];
    } | null;
    reason: string;
  }>;
  storyThreadCreations: Array<{
    threadId: string;
    origin: "player_goal" | "witnessed_consequence" | "existing_thread_branch" | "faction_development" | "npc_commitment";
    basisId: string;
    kind: "faction" | "side" | "personal" | "mystery" | "dynamic";
    title: string;
    summary: string;
    visibility: "player" | "director";
    maximumStage: "opening" | "stabilization" | "escalation" | "resolution";
    urgency: 0 | 1 | 2 | 3;
    locationIds: string[];
    factionIds: string[];
    npcIds: string[];
    recoveryPaths: string[];
    reason: string;
  }>;
  questGenerations: Array<{ sourceThreadId: string; reason: string }>;
  questRecoveries: Array<{ failedQuestId: string; recoveryPath: string; reason: string }>;
  questUpdates: Array<{
    questId: string;
    action: "make_available" | "activate" | "complete_objective" | "fail_objective" | "complete" | "fail_recoverably";
    objectiveId: string | null;
    outcomeId: string | null;
    reason: string;
  }>;
  suggestedActions: [string, string];
  allowsFreeText: true;
};

const ASSESS_ACTION_TOOL = {
  type: "function",
  name: "assess_player_action",
  description: "Decide whether the player's stated action happens automatically or requires one meaningful d20 check.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      resolution: { type: "string", enum: ["automatic", "check"] },
      category: { anyOf: [{ type: "string", enum: ["ability", "skill", "saving_throw"] }, { type: "null" }] },
      ability: { anyOf: [{ type: "string", enum: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] }, { type: "null" }] },
      skill: { anyOf: [{ type: "string", enum: ["acrobatics", "animal_handling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight_of_hand", "stealth", "survival"] }, { type: "null" }] },
      difficulty: { anyOf: [{ type: "string", enum: ["easy", "standard", "hard", "extreme"] }, { type: "null" }] },
      mode: { anyOf: [{ type: "string", enum: ["normal", "advantage", "disadvantage"] }, { type: "null" }] },
      stakes: { type: "string" },
      reason: { type: "string" }
    },
    required: ["resolution", "category", "ability", "skill", "difficulty", "mode", "stakes", "reason"],
    additionalProperties: false
  }
} as const;

const PLAN_TOOL = {
  type: "function",
  name: "submit_turn_plan",
  description: "Submit one bounded Velmora turn proposal. This proposes changes only; the engine validates and executes them.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      summary: { type: "string", description: "Player-visible result using only supplied perspective information." },
      majorActionProposal: { type: "boolean", description: "Whether the input should advance the durable world turn." },
      factionChanges: {
        type: "array",
        items: {
          type: "object",
          properties: {
            factionId: { type: "string" },
            delta: { type: "integer", enum: [-1, 1] },
            reason: { type: "string" }
          },
          required: ["factionId", "delta", "reason"],
          additionalProperties: false
        }
      },
      npcReputationChanges: {
        type: "array",
        items: {
          type: "object",
          properties: {
            characterId: { type: "string" },
            delta: { type: "integer", enum: [-1, 1] },
            reason: { type: "string" }
          },
          required: ["characterId", "delta", "reason"],
          additionalProperties: false
        }
      },
      movements: {
        type: "array",
        items: {
          type: "object",
          properties: { locationId: { type: "string" }, reason: { type: "string" } },
          required: ["locationId", "reason"],
          additionalProperties: false
        }
      },
      factionPathAdvances: {
        type: "array",
        items: {
          type: "object",
          properties: { factionId: { type: "string" }, reason: { type: "string" } },
          required: ["factionId", "reason"],
          additionalProperties: false
        }
      },
      locationConsequences: {
        type: "array",
        items: {
          type: "object",
          properties: {
            locationId: { type: "string" },
            consequence: { type: "string" },
            reason: { type: "string" }
          },
          required: ["locationId", "consequence", "reason"],
          additionalProperties: false
        }
      },
      npcRequests: {
        type: "array",
        maxItems: 1,
        description: "Request at most one persistent minor NPC only when the current scene genuinely needs a new person. Reuse supplied NPCs whenever possible.",
        items: {
          type: "object",
          properties: {
            role: { type: "string" },
            factionId: { anyOf: [{ type: "string" }, { type: "null" }] },
            locationId: { type: "string" },
            category: { type: "string", enum: ["active", "known", "background"] },
            reason: { type: "string" }
          },
          required: ["role", "factionId", "locationId", "category", "reason"],
          additionalProperties: false
        }
      },
      npcUpdates: {
        type: "array",
        maxItems: 20,
        description: "Bounded consequences for existing NPCs directly involved in this turn. Omit uninvolved NPCs.",
        items: {
          type: "object",
          properties: {
            npcId: { type: "string" },
            involvement: { type: "string", enum: ["continues", "ends"] },
            memory: {
              anyOf: [{
                type: "object",
                properties: {
                  summary: { type: "string" },
                  emotionalImpact: { type: "string" },
                  importance: { type: "integer", enum: [1, 2, 3] },
                  unresolved: { type: "boolean" }
                },
                required: ["summary", "emotionalImpact", "importance", "unresolved"],
                additionalProperties: false
              }, { type: "null" }]
            },
            playerRelationship: {
              anyOf: [{
                type: "object",
                properties: {
                  standing: { type: "string", enum: ["hostile", "unfriendly", "neutral", "friendly", "loyal"] },
                  addQualities: { type: "array", items: { type: "string", enum: ["trusted", "wary", "afraid", "indebted", "respectful", "attached"] }, maxItems: 2 },
                  removeQualities: { type: "array", items: { type: "string", enum: ["trusted", "wary", "afraid", "indebted", "respectful", "attached"] }, maxItems: 2 },
                  reason: { type: "string" }
                },
                required: ["standing", "addQualities", "removeQualities", "reason"],
                additionalProperties: false
              }, { type: "null" }]
            },
            learnedFact: {
              anyOf: [{
                type: "object",
                properties: {
                  factId: { type: "string" },
                  method: { type: "string", enum: ["witnessed", "told", "inferred"] },
                  confidence: { type: "integer", minimum: 0, maximum: 100 },
                  believedState: { type: "string", enum: ["true", "false", "uncertain"] }
                },
                required: ["factId", "method", "confidence", "believedState"],
                additionalProperties: false
              }, { type: "null" }]
            },
            status: { anyOf: [{ type: "string", enum: ["available", "injured", "missing", "detained", "unavailable", "departed"] }, { type: "null" }] },
            newLocationId: { anyOf: [{ type: "string" }, { type: "null" }] },
            reason: { type: "string" }
          },
          required: ["npcId", "involvement", "memory", "playerRelationship", "learnedFact", "status", "newLocationId", "reason"],
          additionalProperties: false
        }
      },
      storyThreadUpdates: {
        type: "array",
        maxItems: 4,
        description: "Advance only supplied relevant story threads. Use replace only through a recorded recovery path; never weaken stage gates or expose Director-only truth.",
        items: {
          type: "object",
          properties: {
            threadId: { type: "string" },
            action: { type: "string", enum: ["activate", "advance", "block", "resolve", "fail", "replace"] },
            summary: { type: "string" },
            urgency: { type: "integer", minimum: 0, maximum: 3 },
            recoveryPathUsed: { anyOf: [{ type: "string" }, { type: "null" }] },
            replacement: {
              anyOf: [{
                type: "object",
                properties: {
                  threadId: { type: "string" },
                  title: { type: "string" },
                  summary: { type: "string" },
                  kind: { type: "string", enum: ["main", "faction", "side", "personal", "mystery", "dynamic"] },
                  urgency: { type: "integer", minimum: 0, maximum: 3 },
                  locationIds: { type: "array", items: { type: "string" }, maxItems: 8 },
                  factionIds: { type: "array", items: { type: "string" }, maxItems: 6 },
                  npcIds: { type: "array", items: { type: "string" }, maxItems: 8 },
                  recoveryPaths: { type: "array", items: { type: "string" }, maxItems: 4 }
                },
                required: ["threadId", "title", "summary", "kind", "urgency", "locationIds", "factionIds", "npcIds", "recoveryPaths"],
                additionalProperties: false
              }, { type: "null" }]
            },
            reason: { type: "string" }
          },
          required: ["threadId", "action", "summary", "urgency", "recoveryPathUsed", "replacement", "reason"],
          additionalProperties: false
        }
      },
      storyThreadCreations: {
        type: "array",
        maxItems: 2,
        description: "Create at most two new non-main threads only when the current player action produces a durable goal, witnessed consequence, NPC commitment, faction development, or branch from an unresolved thread.",
        items: {
          type: "object",
          properties: {
            threadId: { type: "string", description: "Stable unique uppercase identifier beginning THREAD-." },
            origin: { type: "string", enum: ["player_goal", "witnessed_consequence", "existing_thread_branch", "faction_development", "npc_commitment"] },
            basisId: { type: "string", description: "Exact existing location, faction, NPC, or thread ID that caused this thread; use player_input for a player goal." },
            kind: { type: "string", enum: ["faction", "side", "personal", "mystery", "dynamic"] },
            title: { type: "string" },
            summary: { type: "string", description: "An unresolved goal, pressure, promise, or question; never a newly established hidden truth." },
            visibility: { type: "string", enum: ["player", "director"] },
            maximumStage: { type: "string", enum: ["opening", "stabilization", "escalation", "resolution"] },
            urgency: { type: "integer", minimum: 0, maximum: 3 },
            locationIds: { type: "array", items: { type: "string" }, maxItems: 8 },
            factionIds: { type: "array", items: { type: "string" }, maxItems: 6 },
            npcIds: { type: "array", items: { type: "string" }, maxItems: 8 },
            recoveryPaths: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
            reason: { type: "string" }
          },
          required: ["threadId", "origin", "basisId", "kind", "title", "summary", "visibility", "maximumStage", "urgency", "locationIds", "factionIds", "npcIds", "recoveryPaths", "reason"],
          additionalProperties: false
        }
      },
      questGenerations: {
        type: "array",
        maxItems: 2,
        description: "Generate a validated quest from an active supplied story thread. The engine owns its structure, secrecy, stage range, and stable IDs.",
        items: {
          type: "object",
          properties: {
            sourceThreadId: { type: "string" },
            reason: { type: "string" }
          },
          required: ["sourceThreadId", "reason"],
          additionalProperties: false
        }
      },
      questRecoveries: {
        type: "array",
        maxItems: 1,
        description: "Create one altered route from a recoverably failed supplied quest using one of its exact recorded recovery paths.",
        items: {
          type: "object",
          properties: {
            failedQuestId: { type: "string" },
            recoveryPath: { type: "string" },
            reason: { type: "string" }
          },
          required: ["failedQuestId", "recoveryPath", "reason"],
          additionalProperties: false
        }
      },
      questUpdates: {
        type: "array",
        maxItems: 4,
        description: "Manage supplied quests only when the player's action justifies the exact lifecycle transition. Complete requires one recorded outcome.",
        items: {
          type: "object",
          properties: {
            questId: { type: "string" },
            action: { type: "string", enum: ["make_available", "activate", "complete_objective", "fail_objective", "complete", "fail_recoverably"] },
            objectiveId: { anyOf: [{ type: "string" }, { type: "null" }] },
            outcomeId: { anyOf: [{ type: "string" }, { type: "null" }] },
            reason: { type: "string" }
          },
          required: ["questId", "action", "objectiveId", "outcomeId", "reason"],
          additionalProperties: false
        }
      },
      suggestedActions: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 2
      },
      allowsFreeText: { type: "boolean", enum: [true] }
    },
    required: ["summary", "majorActionProposal", "factionChanges", "npcReputationChanges", "movements", "factionPathAdvances", "locationConsequences", "npcRequests", "npcUpdates", "storyThreadUpdates", "storyThreadCreations", "questGenerations", "questRecoveries", "questUpdates", "suggestedActions", "allowsFreeText"],
    additionalProperties: false
  }
} as const;

const SCENE_TOOL = {
  type: "function",
  name: "present_scene",
  description: "Present the current validated Velmora scene to the player without changing world state.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      narration: { type: "string", description: "Immersive player-facing scene narration grounded in the supplied perspective." },
      suggestedActions: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2 }
    },
    required: ["title", "narration", "suggestedActions"],
    additionalProperties: false
  }
} as const;

const DIRECTOR_RULES = `You are the D&D-style Campaign Master and Story Brain for Velmora. The engine is the sole source of durable truth.
The planning context includes player-visible state plus a hidden campaignBlueprint and directorStoryThreads. Use hidden material to preserve long-form structure, callbacks, and stage gates, but never reveal it merely because it appears in planning context. Reveal information only through events, evidence, and knowledge the player has actually reached. Do not invent mechanics, change authored canon, create travel through Tears, or mutate state directly.
The supplied playerCharacter is the player's fixed identity and mechanical foundation. Portray the world responding to that character, but never choose the character's thoughts, dialogue, decisions, history, abilities, or actions for the player, and never redefine their recorded identity notes.
You may create temporary sensory detail, dialogue, reactions, and immediate complications needed to make the current scene feel alive. Do not promote those details into permanent world facts unless the engine accepts a corresponding tool request.
Narrate the result of the player's action as story, not as a technical summary. Propose only consequences justified by that action. Keep durable changes rare and bounded. A faction condition or NPC reputation may change by exactly one step. Advance a faction path only after a meaningful completed milestone; never invent the milestone's canon content.
Use the supplied npcContext for portrayal. A full NPC may use only that NPC's supplied knowledge and beliefs. Prefer existing NPCs. Request at most one new minor NPC only when the player's action requires a persistent person who does not already exist; never use this to create a leader, major villain, canon authority, master, unique power holder, or predetermined plot answer. The request must use the current location.
For existing NPCs directly affected by the turn, submit a bounded npcUpdate. Record only memories and relationship changes justified by the player's action. Standing may move only one step. New knowledge must reference an existing supplied public fact; never invent a fact or reveal a restricted fact. Ordinary NPC updates may not cause death. Mark involvement as ends when that NPC should leave the foreground; category changes are owned by the engine.
Manage story continuity through storyThreadUpdates. Advance only a thread materially changed by the player's action. Activate dormant threads when play reaches them; block a route only if it retains a recovery path; resolve only when its promise is actually answered. Replace a broken route only by consuming one of that thread's exact recoveryPaths. A replacement is a route around the same story problem, not permission to invent a new canon truth. Never alter visibility or stage limits, and never surface a Director-only thread in player-visible narration.
Create a new thread only when this turn genuinely produces durable unfinished business. Use storyThreadCreations for a player_goal, witnessed_consequence, npc_commitment, faction_development, or a branch from an unresolved supplied thread. Every creation must cite its exact basis and include a recovery path. Never create a main thread, new canon truth, predetermined answer, unsupported conspiracy, or early version of a later-stage event. Player goals, witnessed consequences, and NPC commitments remain player-visible. Unwitnessed faction developments remain Director-only. Existing-thread branches inherit the source's visibility and may not outlive its stage gate.
Use questGenerations only to ask the engine to build a quest from an active supplied story thread; do not write the quest yourself. Use questRecoveries only after a recoverable quest has failed, selecting one of that quest's exact supplied recovery paths. Recovery changes the route while preserving the failed quest as history, its source thread, secrecy, and stage ceiling. Use questUpdates only for a transition justified by the current action. Resolve one active objective at a time. Complete a quest only after every objective is complete and select exactly one of its recorded outcomes. Outcome consequences must be submitted through the ordinary validated faction, NPC, location, or story-thread tools in the same plan so the engine commits the outcome and its effects atomically. Fail recoverably only when the supplied quest records a recovery path; never invent permanent failure authority.
If actionResolution is automatic, honor its reason, including when the declared intent is impossible. If actionResolution contains a roll, resolve the action in strict accordance with that outcome. Success with a cost achieves the immediate intent but introduces a proportional complication. Failure changes the situation and preserves a credible recovery route instead of simply stopping play. Critical results remain proportional and never accomplish the impossible or break canon.
Always call submit_turn_plan exactly once. Provide exactly two suggested actions while allowing free text. If validation feedback is supplied, repair only the rejected fields.`;

const ACTION_ASSESSMENT_RULES = `You are assessing one declared player action in Velmora before consequences are narrated.
Call for a check only when the outcome is both uncertain and meaningful. Do not roll for ordinary movement, conversation, observation of obvious facts, harmless choices, or impossible actions. An impossible action is automatic only in the sense that no roll occurs; explain in the reason that it cannot achieve the stated result.
For a check, choose one category and the single relevant ability. Skill checks must use their standard linked ability. Saving throws are reactive resistance, not voluntary attempts. Choose Easy 8, Standard 12, Hard 16, or Extreme 20 from the established world circumstances; never scale difficulty to oppose the character. Use advantage or disadvantage only when supplied circumstances clearly justify it; otherwise use normal. State the visible stakes without revealing the DC or hidden information.
For automatic actions, return null for category, ability, skill, difficulty, and mode, and an empty stakes string. Call assess_player_action exactly once.`;

const SCENE_RULES = `You are the D&D-style Campaign Master and Story Brain for Velmora. Present only the validated current scene and player-visible context supplied by the engine.
The supplied playerCharacter is the player's fixed character. Use its recorded identity and abilities for grounding, but never narrate that character's unchosen thoughts, dialogue, decisions, history, or actions.
Write an evocative but focused opening in 2-4 short paragraphs. Establish what the character perceives, what is happening now, and why a response matters. If visibleOpeningPressure is present, make that crisis the immediate playable situation without exposing any hidden blueprint material. You may create temporary sensory detail and dialogue, but may not invent permanent lore, powers, mechanics, hidden truths, new factions, or off-screen knowledge.
Offer exactly two meaningfully different actions. The player may always type something else. Call present_scene exactly once.`;

function parseSubmittedPlan(value: unknown): DirectorTurnPlan {
  if (!value || typeof value !== "object") throw new Error("Cloud Director returned non-object plan arguments");
  const plan = value as Partial<SubmittedPlan>;
  if (typeof plan.summary !== "string" || plan.summary.trim().length === 0) throw new Error("Cloud Director plan requires a summary");
  if (typeof plan.majorActionProposal !== "boolean") throw new Error("Cloud Director plan requires majorActionProposal");
  if (!Array.isArray(plan.factionChanges) || !Array.isArray(plan.npcReputationChanges) || !Array.isArray(plan.movements) || !Array.isArray(plan.factionPathAdvances) || !Array.isArray(plan.locationConsequences) || !Array.isArray(plan.npcRequests) || !Array.isArray(plan.npcUpdates) || !Array.isArray(plan.storyThreadUpdates) || !Array.isArray(plan.storyThreadCreations) || !Array.isArray(plan.questGenerations) || !Array.isArray(plan.questRecoveries) || !Array.isArray(plan.questUpdates)) throw new Error("Cloud Director plan requires change arrays");
  if (plan.npcRequests.length > 1) throw new Error("Cloud Director may request at most one minor NPC per turn");
  if (plan.npcUpdates.length > 20) throw new Error("Cloud Director may update at most twenty affected NPCs per turn");
  if (plan.storyThreadUpdates.length > 4) throw new Error("Cloud Director may update at most four story threads per turn");
  if (plan.storyThreadCreations.length > 2) throw new Error("Cloud Director may create at most two story threads per turn");
  if (plan.questGenerations.length > 2) throw new Error("Cloud Director may generate at most two quests per turn");
  if (plan.questRecoveries.length > 1) throw new Error("Cloud Director may generate at most one recovery quest per turn");
  if (plan.questUpdates.length > 4) throw new Error("Cloud Director may update at most four quests per turn");
  if (!Array.isArray(plan.suggestedActions) || plan.suggestedActions.length !== 2 || !plan.suggestedActions.every((item) => typeof item === "string")) {
    throw new Error("Cloud Director plan requires exactly two suggested actions");
  }
  if (plan.allowsFreeText !== true) throw new Error("Cloud Director must allow free-text actions");

  const toolRequests: ToolRequest[] = [
    ...plan.factionChanges.map((change) => ({ type: "change_faction_condition" as const, ...change })),
    ...plan.npcReputationChanges.map((change) => ({ type: "change_npc_reputation" as const, ...change })),
    ...plan.locationConsequences.map((change) => ({ type: "record_location_consequence" as const, ...change })),
    ...plan.factionPathAdvances.map((change) => ({ type: "advance_faction_path" as const, ...change })),
    ...plan.npcRequests.map((change) => ({ type: "request_minor_npc" as const, ...change })),
    ...plan.npcUpdates.map((change) => ({ type: "manage_npc_turn" as const, ...change })),
    ...plan.storyThreadUpdates.map((change) => ({ type: "manage_story_thread" as const, ...change })),
    ...plan.storyThreadCreations.map((change) => ({ type: "create_story_thread" as const, ...change })),
    ...plan.questGenerations.map((change) => ({ type: "generate_quest" as const, ...change })),
    ...plan.questRecoveries.map((change) => ({ type: "generate_recovery_quest" as const, ...change })),
    ...plan.questUpdates.map((change) => ({ type: "manage_quest" as const, ...change })),
    ...plan.movements.map((change) => ({ type: "move_player" as const, ...change }))
  ];
  return {
    summary: plan.summary,
    majorActionProposal: plan.majorActionProposal,
    toolRequests,
    suggestedActions: [plan.suggestedActions[0], plan.suggestedActions[1]],
    allowsFreeText: true
  };
}

export class CloudDirector implements CampaignDirector {
  readonly source = "cloud" as const;
  readonly #apiKey: string;
  readonly #model: string;
  readonly #fetch: FetchLike;
  readonly #endpoint: string;
  readonly #timeoutMs: number;
  lastUsage: DirectorUsage | null = null;

  constructor(options: CloudDirectorOptions) {
    if (!options.apiKey.trim()) throw new Error("Cloud Director requires OPENAI_API_KEY");
    this.#apiKey = options.apiKey;
    this.#model = options.model ?? "gpt-5.6";
    this.#fetch = options.fetchImpl ?? fetch;
    this.#endpoint = options.endpoint ?? "https://api.openai.com/v1/responses";
    this.#timeoutMs = options.timeoutMs ?? 30_000;
  }

  async preview(context: DirectorContext): Promise<DirectorPreview> {
    return {
      intent: "inspect",
      summary: `Cloud Director is configured for ${context.locationId} during ${context.stage}, turn ${context.turn}. No world state was changed.`,
      suggestedActions: ["Inspect the current location", "Review campaign status"],
      allowsFreeText: true
    };
  }

  async presentScene(context: PerspectiveContext, scene: ScenePackage): Promise<StoryPresentation> {
    const response = await this.#fetch(this.#endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(this.#timeoutMs),
      headers: { "content-type": "application/json", authorization: `Bearer ${this.#apiKey}` },
      body: JSON.stringify({
        model: this.#model,
        instructions: SCENE_RULES,
        input: JSON.stringify({ context, scene }),
        tools: [SCENE_TOOL],
        tool_choice: { type: "function", name: "present_scene" }
      })
    });
    if (!response.ok) throw new Error(`Campaign Master scene request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    const payload = await response.json() as { output?: Array<{ type?: string; name?: string; arguments?: string }> };
    const call = payload.output?.find((item) => item.type === "function_call" && item.name === "present_scene");
    if (!call?.arguments) throw new Error("Campaign Master did not present the scene");
    const value = JSON.parse(call.arguments) as { title?: unknown; narration?: unknown; suggestedActions?: unknown };
    if (typeof value.title !== "string" || typeof value.narration !== "string") throw new Error("Campaign Master returned invalid scene text");
    if (!Array.isArray(value.suggestedActions) || value.suggestedActions.length !== 2 || !value.suggestedActions.every((item) => typeof item === "string")) {
      throw new Error("Campaign Master must return exactly two scene actions");
    }
    return {
      sceneId: scene.id,
      title: value.title,
      narration: value.narration,
      suggestedActions: [value.suggestedActions[0] as string, value.suggestedActions[1] as string],
      source: "cloud"
    };
  }

  async assessAction(context: DirectorPlanningContext, playerInput: string): Promise<ActionAssessment> {
    const response = await this.#fetch(this.#endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(this.#timeoutMs),
      headers: { "content-type": "application/json", authorization: `Bearer ${this.#apiKey}` },
      body: JSON.stringify({
        model: this.#model,
        instructions: ACTION_ASSESSMENT_RULES,
        input: JSON.stringify({ context, playerInput }),
        tools: [ASSESS_ACTION_TOOL],
        tool_choice: { type: "function", name: "assess_player_action" }
      })
    });
    if (!response.ok) throw new Error(`Campaign Master action assessment failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    const payload = await response.json() as { output?: Array<{ type?: string; name?: string; arguments?: string }> };
    const call = payload.output?.find((item) => item.type === "function_call" && item.name === "assess_player_action");
    if (!call?.arguments) throw new Error("Campaign Master did not assess the player action");
    const value = JSON.parse(call.arguments) as Record<string, unknown>;
    if (value.resolution === "automatic" && typeof value.reason === "string") return { resolution: "automatic", reason: value.reason };
    if (value.resolution !== "check" || typeof value.category !== "string" || typeof value.ability !== "string" || typeof value.difficulty !== "string" || typeof value.mode !== "string" || typeof value.stakes !== "string" || typeof value.reason !== "string") {
      throw new Error("Campaign Master returned an invalid action assessment");
    }
    return {
      resolution: "check",
      category: value.category as Extract<ActionAssessment, { resolution: "check" }>["category"],
      ability: value.ability as Extract<ActionAssessment, { resolution: "check" }>["ability"],
      skill: value.skill as Extract<ActionAssessment, { resolution: "check" }>["skill"],
      difficulty: value.difficulty as Extract<ActionAssessment, { resolution: "check" }>["difficulty"],
      mode: value.mode as Extract<ActionAssessment, { resolution: "check" }>["mode"],
      stakes: value.stakes,
      reason: value.reason
    };
  }

  async planTurn(context: DirectorPlanningContext, playerInput: string, validationFeedback: string[] = [], actionResolution?: ActionResolution): Promise<DirectorTurnPlan> {
    const response = await this.#fetch(this.#endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(this.#timeoutMs),
      headers: { "content-type": "application/json", authorization: `Bearer ${this.#apiKey}` },
      body: JSON.stringify({
        model: this.#model,
        instructions: DIRECTOR_RULES,
        input: JSON.stringify({ context, playerInput, actionResolution: actionResolution ?? null, validationFeedback }),
        tools: [PLAN_TOOL],
        tool_choice: { type: "function", name: "submit_turn_plan" }
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Cloud Director request failed (${response.status}): ${body.slice(0, 300)}`);
    }
    const payload = await response.json() as {
      output?: Array<{ type?: string; name?: string; arguments?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
    };
    if (payload.usage) {
      this.lastUsage = {
        inputTokens: payload.usage.input_tokens ?? 0,
        outputTokens: payload.usage.output_tokens ?? 0,
        totalTokens: payload.usage.total_tokens ?? 0
      };
    }
    const call = payload.output?.find((item) => item.type === "function_call" && item.name === "submit_turn_plan");
    if (!call?.arguments) throw new Error("Cloud Director did not submit a turn plan");
    try {
      return parseSubmittedPlan(JSON.parse(call.arguments));
    } catch (error) {
      throw new Error(`Cloud Director returned an invalid turn plan: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export function cloudDirectorFromEnvironment(): CloudDirector {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set. Cloud turns are unavailable; offline commands still work.");
  return new CloudDirector({ apiKey, model: process.env.OPENAI_MODEL });
}
