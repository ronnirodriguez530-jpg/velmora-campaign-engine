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

export type VelmoraContent = {
  campaign: CampaignDefinition;
  stages: StageDefinition[];
  factions: FactionDefinition[];
  locations: LocationDefinition[];
  characters: CharacterDefinition[];
  truths: TruthDefinition[];
  openingSpawns: OpeningSpawnDefinition[];
  sceneTemplates: SceneTemplate[];
};

export type SceneTemplate = {
  id: string;
  stages: CampaignStage[];
  conflictKey: string;
  objectiveKey: string;
  minThreatLevel: number;
  maxThreatLevel: number;
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
};

export type QuestState = "locked" | "available" | "active" | "changed" | "completed" | "failed";

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

export type ToolRequest = ChangeFactionConditionRequest | ChangeNpcReputationRequest | MovePlayerRequest | AdvanceFactionPathRequest | RecordLocationConsequenceRequest | RequestMinorNpcRequest | ManageNpcTurnRequest;

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
