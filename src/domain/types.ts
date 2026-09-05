export type CampaignStage = "opening" | "stabilization" | "escalation" | "resolution";

export type CampaignDefinition = {
  id: string;
  name: string;
  initialStage: CampaignStage;
  initialLocationId: string;
  openingPremise: string;
  playableWorld: "Velmora";
  factionPathRequirement: number;
  allowTemporaryTearTravel: false;
};

export type StageDefinition = {
  id: string;
  key: CampaignStage;
  order: number;
  anchor: string;
  maxThreatLevel: number;
};

export type FactionDefinition = {
  id: string;
  name: string;
  initialCondition: number;
  service: string;
  hiddenStructure?: {
    publicFace: string;
    trueAuthority: string;
    leadershipRule: string;
    doctrine: string;
    methods: string[];
    publicAwareness: {
      unawarePercent: number;
      speculationPercent: number;
      suspicionPercent: number;
      knowsAndKeepsQuietPercent: number;
      speculationMeaning: string;
      suspicionMeaning: string;
      knowledgeMeaning: string;
    };
  };
  districtIdentity: {
    mapSector: string;
    colors: string[];
    environment: string;
    wayOfLife: string;
    landmark: string;
  };
};

export type LocationDefinition = {
  id: string;
  name: string;
  district: string;
  connections: string[];
  perspectiveTags: string[];
  mapPosition: string;
  environment: string;
};

export type CharacterDefinition = {
  id: string;
  role: string;
  factionId: string | null;
  status: string;
  initialReputation: number;
  initialLocationId: string;
};

export type TruthDefinition = {
  id: string;
  summary: string;
};

export type OpeningSpawnDefinition = {
  roll: number;
  id: string;
  locationId: string;
  spawnArea: string;
  entryReason: string;
  immediatePressure: string;
};

export type OpeningPressureDefinition = {
  id: string;
  title: string;
  summary: string;
  threatLevel: 1 | 2;
  tags: string[];
};

export type FactionPressureDefinition = {
  id: string;
  summary: string;
};

export type ClueRouteDefinition = {
  id: string;
  summary: string;
};

export type ReversalDefinition = {
  id: string;
  summary: string;
  minimumStage: Exclude<CampaignStage, "opening">;
};

export type StoryBlueprintPools = {
  version: number;
  openingPressures: OpeningPressureDefinition[];
  factionPressures: FactionPressureDefinition[];
  clueRoutes: ClueRouteDefinition[];
  reversals: ReversalDefinition[];
  clueRouteCount: number;
  endgameMinimumStage: "resolution";
};

export type VelmoraContent = {
  campaign: CampaignDefinition;
  stages: StageDefinition[];
  factions: FactionDefinition[];
  locations: LocationDefinition[];
  characters: CharacterDefinition[];
  truths: TruthDefinition[];
  openingSpawns: OpeningSpawnDefinition[];
  storyBlueprintPools: StoryBlueprintPools;
  powers: PowerDefinition[];
  items: ItemDefinition[];
  sceneTemplates: SceneTemplate[];
};

export type CampaignBlueprint = {
  campaignId: string;
  version: number;
  openingPressure: OpeningPressureDefinition;
  focalFactionIds: [string, string];
  factionPressure: FactionPressureDefinition;
  clueRoutes: ClueRouteDefinition[];
  reversal: ReversalDefinition;
  endgameMinimumStage: "resolution";
  createdTurn: 0;
};

export type SceneTemplate = {
  id: string;
  stages: CampaignStage[];
  conflictKey: string;
  objectiveKey: string;
  minThreatLevel: number;
  maxThreatLevel: number;
};

export type AbilityKey = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";

export type SkillKey = "acrobatics" | "animal_handling" | "arcana" | "athletics" | "deception" | "history" | "insight" | "intimidation" | "investigation" | "medicine" | "nature" | "perception" | "performance" | "persuasion" | "religion" | "sleight_of_hand" | "stealth" | "survival";

export type CheckDifficulty = "easy" | "standard" | "hard" | "extreme";
export type RollMode = "normal" | "advantage" | "disadvantage";
export type CheckCategory = "ability" | "skill" | "saving_throw";
export type RollOutcome = "critical_success" | "success" | "success_with_cost" | "failure" | "critical_failure";

export type ActionAssessment =
  | { resolution: "automatic"; reason: string }
  | {
      resolution: "check";
      category: CheckCategory;
      ability: AbilityKey;
      skill: SkillKey | null;
      difficulty: CheckDifficulty;
      mode: RollMode;
      stakes: string;
      reason: string;
    };

export type ActionRollResolution = {
  checkId: string;
  category: CheckCategory;
  ability: AbilityKey;
  skill: SkillKey | null;
  mode: RollMode;
  dice: number[];
  keptDie: number;
  modifier: number;
  total: number;
  outcome: RollOutcome;
  stakes: string;
};

export type ActionResolution =
  | { kind: "automatic"; reason: string }
  | { kind: "rolled"; roll: ActionRollResolution };

export type PendingActionCheckView = {
  checkId: string;
  category: CheckCategory;
  ability: AbilityKey;
  skill: SkillKey | null;
  mode: RollMode;
  modifier: number;
  proficiencyApplied: boolean;
  stakes: string;
};

export type PlayerCharacter = {
  campaignId: string;
  characterId: "PC-001";
  creationVersion: 1;
  name: string;
  identityNotes: string;
  abilityScores: Record<AbilityKey, number>;
  abilityModifiers: Record<AbilityKey, number>;
  skillProficiencies: SkillKey[];
  saveProficiencies: AbilityKey[];
  proficiencyBonus: 2;
  maxHp: number;
  currentHp: number;
  armorBonus: number;
  defense: number;
  createdTurn: number;
  updatedTurn: number;
};

export type PowerLevel = 1 | 2 | 3;
export type PowerUseType = "instant" | "fixed_duration" | "sustained";
export type PowerAcquisitionSource = "innate" | "invented" | "magic_tech" | "discovered" | "taken" | "taught" | "made" | "tear" | "void_rift";

export type PowerDefinition = {
  id: string;
  name: string;
  familyId: string;
  level: PowerLevel;
  useType: PowerUseType;
  summary: string;
  limits: string[];
  allowedSources: PowerAcquisitionSource[];
  requiresPlayerApproval: boolean;
};

export type PlayerPower = {
  campaignId: string;
  powerId: string;
  source: PowerAcquisitionSource;
  playerApproved: boolean;
  active: boolean;
  acquiredTurn: number;
  activatedTurn: number | null;
};

export type ItemCategory = "weapon" | "armor" | "shield" | "consumable" | "tool" | "relic" | "quest";
export type EquipmentSlot = "main_hand" | "off_hand" | "body" | "utility";
export type ItemAcquisitionSource = "starting" | "found" | "reward" | "purchased" | "crafted" | "given";

export type ItemDefinition = {
  id: string;
  name: string;
  category: ItemCategory;
  summary: string;
  stackable: boolean;
  maxStack: number;
  equipmentSlot: EquipmentSlot | null;
  defenseBonus: number;
  tags: string[];
  limits: string[];
};

export type PlayerInventoryItem = {
  campaignId: string;
  itemId: string;
  quantity: number;
  equippedSlot: EquipmentSlot | null;
  acquisitionSource: ItemAcquisitionSource;
  acquiredTurn: number;
  updatedTurn: number;
};

export type MilestoneBasisType = "quest" | "faction" | "story" | "discovery";

export type ProgressionMilestone = {
  campaignId: string;
  milestoneId: string;
  basisType: MilestoneBasisType;
  basisId: string;
  summary: string;
  awardedTurn: number;
};

export type PlayerProgression = {
  campaignId: string;
  earnedAdvancements: number;
  spentAdvancements: number;
  availableAdvancements: number;
  updatedTurn: number;
};

export type CharacterAdvancement = {
  campaignId: string;
  advancementId: string;
  kind: "ability_score" | "skill_proficiency";
  target: AbilityKey | SkillKey;
  previousValue: number | null;
  newValue: number | null;
  appliedTurn: number;
};

export type PerspectiveContext = {
  campaignId: string;
  seed: string;
  stage: CampaignStage;
  campaignOpeningPremise: string;
  stageAnchor: string;
  stageMaxThreatLevel: number;
  turn: number;
  currentLocation: LocationDefinition;
  connectedLocations: LocationDefinition[];
  presentCharacterIds: string[];
  persistentConsequences: string[];
  encounteredScene: ScenePackage | null;
  factionPathProgress: Array<{ factionId: string; progress: number }>;
  factionConditions: Array<{ factionId: string; condition: number }>;
  presentCharacters: Array<{ characterId: string; status: string; reputation: number; factionId: string | null }>;
  recentTearArrivals: TearArrival[];
  npcContext: NpcContextPackage;
  publicFacts: WorldFact[];
  playerCharacter: PlayerCharacter | null;
  playerPowers: Array<PlayerPower & { definition: PowerDefinition }>;
  playerInventory: Array<PlayerInventoryItem & { definition: ItemDefinition }>;
  playerProgression: PlayerProgression;
  playerQuests: QuestInstance[];
  playerKnownStoryThreads: StoryThread[];
  visibleOpeningPressure: OpeningPressureDefinition | null;
};

export type StoryThreadKind = "main" | "faction" | "side" | "personal" | "mystery" | "dynamic";

export type StoryThreadStatus = "dormant" | "active" | "blocked" | "resolved" | "failed";

export type StoryThreadVisibility = "player" | "director";

export type StoryThreadOrigin = "blueprint" | "player_goal" | "witnessed_consequence" | "existing_thread_branch" | "faction_development" | "npc_commitment";

export type StoryThread = {
  campaignId: string;
  threadId: string;
  kind: StoryThreadKind;
  title: string;
  summary: string;
  status: StoryThreadStatus;
  visibility: StoryThreadVisibility;
  origin: StoryThreadOrigin;
  basisId: string | null;
  minimumStage: CampaignStage;
  maximumStage: CampaignStage;
  urgency: 0 | 1 | 2 | 3;
  locationIds: string[];
  factionIds: string[];
  npcIds: string[];
  recoveryPaths: string[];
  createdTurn: number;
  updatedTurn: number;
  lastUsedTurn: number | null;
};

export type DirectorPlanningContext = PerspectiveContext & {
  directorStoryThreads: StoryThread[];
  directorQuests: QuestInstance[];
  campaignBlueprint: CampaignBlueprint;
  recoveryEvidenceEvents: Array<{ sequence: number; turn: number; toolType: string; reason: string }>;
};

export type QuestType = "main" | "faction" | "side" | "personal" | "dynamic" | "fragment";
export type QuestState = "locked" | "available" | "active" | "changed" | "completed" | "failed";
export type QuestVisibility = "player" | "director";
export type QuestObjectiveState = "pending" | "active" | "completed" | "failed" | "skipped";
export type QuestFailureMode = "recoverable" | "warned_deadline" | "irreversible_choice" | "major_world_event";

export type QuestObjective = {
  objectiveId: string;
  summary: string;
  state: QuestObjectiveState;
  required: boolean;
  dependsOnObjectiveIds: string[];
  branchGroupId: string | null;
};

export type QuestOutcome = {
  outcomeId: string;
  summary: string;
  consequenceSeeds: string[];
};

export type QuestRelationshipType = "prerequisite" | "parallel" | "optional_branch" | "consequence";

export type QuestRelationship = {
  questId: string;
  type: QuestRelationshipType;
};

export type QuestRouteProfile = {
  approachKey: string;
  tradeoffKey: string;
  costKey: string;
};

export type QuestNeglectPolicy = {
  allowedTriggers: Array<"ignored_warning_after_deliberate_choice" | "recorded_world_event_advances_threat">;
  maximumEffect: "proportional_complication";
};

export type QuestWarningReceipt = {
  turn: number;
  method: "directly_witnessed_or_clearly_told" | "established_npc_message" | "obvious_environmental_warning";
  signal: string;
  sourceNpcId: string | null;
  reason: string;
};

export type QuestNeglectRecord = {
  turn: number;
  trigger: "ignored_warning_after_deliberate_choice" | "recorded_world_event_advances_threat";
  evidenceEventSequences: number[];
  complicationTool: "change_faction_condition" | "change_npc_reputation" | "record_location_consequence" | "manage_npc_turn" | "manage_story_thread";
  reason: string;
};

export type QuestInstance = {
  campaignId: string;
  questId: string;
  title: string;
  summary: string;
  questType: QuestType;
  state: QuestState;
  visibility: QuestVisibility;
  sourceThreadId: string;
  minimumStage: CampaignStage;
  maximumStage: CampaignStage;
  issuerId: string | null;
  locationIds: string[];
  factionIds: string[];
  npcIds: string[];
  objectives: QuestObjective[];
  stakes: string;
  outcomes: QuestOutcome[];
  failureMode: QuestFailureMode;
  warningSignals: string[];
  neglectTriggers: string[];
  recoveryPaths: string[];
  prerequisiteQuestIds: string[];
  linkedQuestIds: string[];
  relationships: QuestRelationship[];
  routeProfile: QuestRouteProfile;
  neglectPolicy: QuestNeglectPolicy;
  warningHistory: QuestWarningReceipt[];
  neglectHistory: QuestNeglectRecord[];
  recoveryOfQuestId: string | null;
  recoveryPathUsed: string | null;
  recoveryEvidenceEventSequences: number[];
  failureReason: string | null;
  failureEvidenceEventSequences: number[];
  truthEvidenceIds: string[];
  isTurningPoint: boolean;
  selectedOutcomeId: string | null;
  createdTurn: number;
  updatedTurn: number;
};

export type NpcCategory = "active" | "known" | "background";

export type NpcOrigin = "authored" | "generated";

export type NpcStatus = "available" | "injured" | "missing" | "detained" | "unavailable" | "dead" | "departed";

export type NpcLifecycleState = "current" | "archived";

export type FactTruthStatus = "established" | "disproven" | "unresolved";

export type FactVisibility = "public" | "restricted" | "secret";

export type KnowledgeMethod = "witnessed" | "told" | "inferred";

export type BelievedState = "true" | "false" | "uncertain";

export type RelationshipStanding = "hostile" | "unfriendly" | "neutral" | "friendly" | "loyal";

export type RelationshipQuality = "trusted" | "wary" | "afraid" | "indebted" | "respectful" | "attached";

export type RelationshipTargetType = "player" | "npc" | "faction";

export type NpcRecord = {
  campaignId: string;
  npcId: string;
  name: string;
  category: NpcCategory;
  origin: NpcOrigin;
  factionId: string | null;
  locationId: string | null;
  role: string;
  status: NpcStatus;
  lifecycleState: NpcLifecycleState;
  createdTurn: number;
  lastRelevantTurn: number;
};

export type WorldFact = {
  campaignId: string;
  factId: string;
  statement: string;
  truthStatus: FactTruthStatus;
  visibility: FactVisibility;
  establishedTurn: number;
};

export type NpcKnowledge = {
  campaignId: string;
  npcId: string;
  factId: string;
  method: KnowledgeMethod;
  confidence: number;
  believedState: BelievedState;
  sourceNpcId: string | null;
  learnedTurn: number;
  lastUpdatedTurn: number;
};

export type NpcMemory = {
  campaignId: string;
  npcId: string;
  memoryId: string;
  summary: string;
  emotionalImpact: string;
  importance: 1 | 2 | 3;
  unresolved: boolean;
  createdTurn: number;
  lastRecalledTurn: number;
};

export type NpcRelationship = {
  campaignId: string;
  sourceNpcId: string;
  targetType: RelationshipTargetType;
  targetId: string;
  standing: RelationshipStanding;
  qualities: RelationshipQuality[];
  updatedTurn: number;
};

export type NpcKnowledgeView = Omit<NpcKnowledge, "campaignId" | "npcId"> & {
  statement: string;
};

export type FullNpcContext = {
  detail: "full";
  npc: NpcRecord;
  design: NpcDesignProfile | null;
  knowledge: NpcKnowledgeView[];
  memories: NpcMemory[];
  relationships: NpcRelationship[];
};

export type SupportingNpcContext = {
  detail: "supporting";
  npc: NpcRecord;
  playerRelationship: NpcRelationship | null;
};

export type NpcContextPackage = {
  full: FullNpcContext[];
  supporting: SupportingNpcContext[];
  omittedCount: number;
  budgetUsed: number;
  budgetLimit: number;
};

export type NpcDesignProfile = {
  campaignId: string;
  npcId: string;
  desire: string;
  complication: string;
  changeLever: string;
  voiceCues: string[];
  appliedLessonIds: string[];
  fingerprint: string;
  generatedTurn: number;
};

export type TearArrival = {
  id: string;
  turn: number;
  rarity: 1 | 2 | 3;
  payloads: Array<"creature" | "raw_magic" | "world_fragment">;
};

export type ScenePackage = {
  id: string;
  campaignId: string;
  turn: number;
  stage: CampaignStage;
  locationId: string;
  participantIds: string[];
  factionIds: string[];
  questLinks: string[];
  conflictKey: string;
  objectiveKey: string;
  threatLevel: number;
  visibleFacts: string[];
  proposedConsequences: string[];
  suggestedActions: [string, string];
  allowsFreeText: true;
  templateId: string;
};

export type DirectorContext = {
  campaignId: string;
  stage: CampaignStage;
  turn: number;
  locationId: string;
};

export type DirectorPreview = {
  intent: "inspect";
  summary: string;
  suggestedActions: [string, string];
  allowsFreeText: true;
};

export type StoryPresentation = {
  sceneId: string;
  title: string;
  narration: string;
  suggestedActions: [string, string];
  source: "cloud" | "diagnostic";
};

export type ChangeFactionConditionRequest = {
  type: "change_faction_condition";
  factionId: string;
  delta: -1 | 1;
  reason: string;
};

export type ChangeNpcReputationRequest = {
  type: "change_npc_reputation";
  characterId: string;
  delta: -1 | 1;
  reason: string;
};

export type MovePlayerRequest = {
  type: "move_player";
  locationId: string;
  reason: string;
};

export type AdvanceFactionPathRequest = {
  type: "advance_faction_path";
  factionId: string;
  reason: string;
};

export type RecordLocationConsequenceRequest = {
  type: "record_location_consequence";
  locationId: string;
  consequence: string;
  reason: string;
};

export type RequestMinorNpcRequest = {
  type: "request_minor_npc";
  role: string;
  factionId: string | null;
  locationId: string;
  category: NpcCategory;
  reason: string;
};

export type ManageNpcTurnRequest = {
  type: "manage_npc_turn";
  npcId: string;
  involvement: "continues" | "ends";
  memory: {
    summary: string;
    emotionalImpact: string;
    importance: 1 | 2 | 3;
    unresolved: boolean;
  } | null;
  playerRelationship: {
    standing: RelationshipStanding;
    addQualities: RelationshipQuality[];
    removeQualities: RelationshipQuality[];
    reason: string;
  } | null;
  learnedFact: {
    factId: string;
    method: KnowledgeMethod;
    confidence: number;
    believedState: BelievedState;
  } | null;
  status: Exclude<NpcStatus, "dead"> | null;
  newLocationId: string | null;
  reason: string;
};

export type ManageStoryThreadRequest = {
  type: "manage_story_thread";
  threadId: string;
  action: "activate" | "advance" | "block" | "resolve" | "fail" | "replace";
  summary: string;
  urgency: 0 | 1 | 2 | 3;
  recoveryPathUsed: string | null;
  replacement: {
    threadId: string;
    title: string;
    summary: string;
    kind: StoryThreadKind;
    urgency: 0 | 1 | 2 | 3;
    locationIds: string[];
    factionIds: string[];
    npcIds: string[];
    recoveryPaths: string[];
  } | null;
  reason: string;
};

export type CreateStoryThreadRequest = {
  type: "create_story_thread";
  threadId: string;
  origin: Exclude<StoryThreadOrigin, "blueprint">;
  basisId: string;
  kind: Exclude<StoryThreadKind, "main">;
  title: string;
  summary: string;
  visibility: StoryThreadVisibility;
  maximumStage: CampaignStage;
  urgency: 0 | 1 | 2 | 3;
  locationIds: string[];
  factionIds: string[];
  npcIds: string[];
  recoveryPaths: string[];
  reason: string;
};

export type GenerateQuestRequest = {
  type: "generate_quest";
  sourceThreadId: string;
  relationships: QuestRelationship[];
  reason: string;
};

export type GenerateRecoveryQuestRequest = {
  type: "generate_recovery_quest";
  failedQuestId: string;
  recoveryPath: string;
  consequenceEventSequences: number[];
  reason: string;
};

export type ManageQuestRequest = {
  type: "manage_quest";
  questId: string;
  action: "make_available" | "activate" | "complete_objective" | "fail_objective" | "complete" | "fail_recoverably" | "fail_from_consequence" | "record_warning" | "apply_neglect_complication";
  objectiveId: string | null;
  outcomeId: string | null;
  consequenceEventSequences: number[];
  warningMethod: "directly_witnessed_or_clearly_told" | "established_npc_message" | "obvious_environmental_warning" | null;
  warningSignal: string | null;
  warningSourceNpcId: string | null;
  neglectTrigger: "ignored_warning_after_deliberate_choice" | "recorded_world_event_advances_threat" | null;
  neglectComplicationTool: "change_faction_condition" | "change_npc_reputation" | "record_location_consequence" | "manage_npc_turn" | "manage_story_thread" | null;
  reason: string;
};

export type ToolRequest = ChangeFactionConditionRequest | ChangeNpcReputationRequest | MovePlayerRequest | AdvanceFactionPathRequest | RecordLocationConsequenceRequest | RequestMinorNpcRequest | ManageNpcTurnRequest | ManageStoryThreadRequest | CreateStoryThreadRequest | GenerateQuestRequest | GenerateRecoveryQuestRequest | ManageQuestRequest;

export type DirectorTurnPlan = {
  summary: string;
  majorActionProposal: boolean;
  toolRequests: ToolRequest[];
  suggestedActions: [string, string];
  allowsFreeText: true;
};

export type TurnResult = {
  advanced: boolean;
  previousTurn: number;
  currentTurn: number;
  summary: string;
  appliedTools: number;
};
