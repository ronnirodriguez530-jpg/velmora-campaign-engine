export type CampaignStage = "opening" | "stabilization" | "escalation" | "resolution";

export type CampaignDefinition = {
  id: string;
  name: string;
  initialStage: CampaignStage;
  initialLocationId: string;
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
};

export type LocationDefinition = {
  id: string;
  name: string;
  district: string;
  connections: string[];
  perspectiveTags: string[];
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

export type VelmoraContent = {
  campaign: CampaignDefinition;
  stages: StageDefinition[];
  factions: FactionDefinition[];
  locations: LocationDefinition[];
  characters: CharacterDefinition[];
  truths: TruthDefinition[];
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
};

export type QuestState = "locked" | "available" | "active" | "changed" | "completed" | "failed";

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

export type ToolRequest = ChangeFactionConditionRequest | ChangeNpcReputationRequest | MovePlayerRequest | AdvanceFactionPathRequest | RecordLocationConsequenceRequest;

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
