import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ScenePackage, StoryPresentation, TearArrival, VelmoraContent } from "../domain/types.ts";

export type CampaignRow = {
  id: string;
  name: string;
  seed: string;
  stage: "opening" | "stabilization" | "escalation" | "resolution";
  turn: number;
  currentLocationId: string;
};

export type StateSnapshot = {
  campaign: CampaignRow;
  factions: Array<{ factionId: string; condition: number }>;
  characters: Array<{ characterId: string; status: string; reputation: number; locationId: string; replacementCharacterId: string | null }>;
  factionPaths: Array<{ factionId: string; progress: number }>;
  quests: Array<{ questId: string; state: string }>;
};

export function openDatabase(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      seed TEXT NOT NULL,
      stage TEXT NOT NULL,
      turn INTEGER NOT NULL DEFAULT 0,
      current_location_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS faction_state (
      campaign_id TEXT NOT NULL,
      faction_id TEXT NOT NULL,
      condition INTEGER NOT NULL CHECK(condition BETWEEN 0 AND 4),
      PRIMARY KEY (campaign_id, faction_id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS character_state (
      campaign_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      status TEXT NOT NULL,
      reputation INTEGER NOT NULL CHECK(reputation BETWEEN -2 AND 2),
      location_id TEXT,
      replacement_character_id TEXT,
      PRIMARY KEY (campaign_id, character_id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS event_log (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT NOT NULL,
      turn INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT NOT NULL,
      source_turn INTEGER NOT NULL,
      target_turn INTEGER NOT NULL,
      phase TEXT NOT NULL CHECK(phase IN ('pre_turn', 'post_turn')),
      snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS scene_records (
      id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      turn INTEGER NOT NULL,
      stage TEXT NOT NULL,
      location_id TEXT NOT NULL,
      scene_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (campaign_id, id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS location_state (
      campaign_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      consequence TEXT NOT NULL,
      created_turn INTEGER NOT NULL,
      PRIMARY KEY (campaign_id, location_id, consequence),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quest_instances (
      campaign_id TEXT NOT NULL,
      quest_id TEXT NOT NULL,
      title TEXT NOT NULL,
      quest_type TEXT NOT NULL CHECK(quest_type IN ('main','faction','side','personal','dynamic','fragment')),
      state TEXT NOT NULL CHECK(state IN ('locked','available','active','changed','completed','failed')),
      is_turning_point INTEGER NOT NULL DEFAULT 0 CHECK(is_turning_point IN (0,1)),
      outcome_limit INTEGER NOT NULL CHECK(outcome_limit IN (2,3)),
      data_json TEXT NOT NULL,
      PRIMARY KEY (campaign_id, quest_id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );
  `);
  const characterColumns = db.prepare("PRAGMA table_info(character_state)").all() as Array<{ name: string }>;
  if (!characterColumns.some((column) => column.name === "location_id")) {
    db.exec("ALTER TABLE character_state ADD COLUMN location_id TEXT");
  }
  db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(1, ?)").run(new Date().toISOString());
  db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(2, ?)").run(new Date().toISOString());
  db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(3, ?)").run(new Date().toISOString());
  db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(4, ?)").run(new Date().toISOString());
  db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(5, ?)").run(new Date().toISOString());
  db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(6, ?)").run(new Date().toISOString());
  const migrationSeven = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 7").get() as { present: number } | undefined;
  if (!migrationSeven) {
    const questColumns = db.prepare("PRAGMA table_info(quest_instances)").all() as Array<{ name: string }>;
    if (questColumns.some((column) => column.name === "milestone")) {
      db.exec(`
        ALTER TABLE quest_instances RENAME TO quest_instances_invented;
        CREATE TABLE quest_instances (
          campaign_id TEXT NOT NULL,
          quest_id TEXT NOT NULL,
          title TEXT NOT NULL,
          quest_type TEXT NOT NULL CHECK(quest_type IN ('main','faction','side','personal','dynamic','fragment')),
          state TEXT NOT NULL CHECK(state IN ('locked','available','active','changed','completed','failed')),
          is_turning_point INTEGER NOT NULL DEFAULT 0 CHECK(is_turning_point IN (0,1)),
          outcome_limit INTEGER NOT NULL CHECK(outcome_limit IN (2,3)),
          data_json TEXT NOT NULL,
          PRIMARY KEY (campaign_id, quest_id),
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        );
        DROP TABLE quest_instances_invented;
      `);
    }
    db.exec("DROP TABLE IF EXISTS faction_path_state; DROP TABLE IF EXISTS tear_arrivals;");
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(7, ?)").run(new Date().toISOString());
  }
  const migrationEight = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 8").get() as { present: number } | undefined;
  if (!migrationEight) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS faction_path_state (
        campaign_id TEXT NOT NULL,
        faction_id TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 3),
        PRIMARY KEY (campaign_id, faction_id),
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS tear_arrivals (
        campaign_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        turn INTEGER NOT NULL,
        event_json TEXT NOT NULL,
        PRIMARY KEY (campaign_id, event_id),
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );
    `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(8, ?)").run(new Date().toISOString());
  }
  const migrationNine = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 9").get() as { present: number } | undefined;
  if (!migrationNine) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS story_records (
        campaign_id TEXT NOT NULL,
        scene_id TEXT NOT NULL,
        presentation_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (campaign_id, scene_id),
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );
    `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(9, ?)").run(new Date().toISOString());
  }
}

export function createCampaign(db: DatabaseSync, content: VelmoraContent, name: string, seed: string): string {
  const id = `SAVE-${name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`;
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`INSERT INTO campaigns(id, name, seed, stage, turn, current_location_id, created_at, updated_at)
      VALUES(?, ?, ?, ?, 0, ?, ?, ?)`)
      .run(id, name, seed, content.campaign.initialStage, content.campaign.initialLocationId, now, now);
    const insertFaction = db.prepare("INSERT INTO faction_state(campaign_id, faction_id, condition) VALUES(?, ?, ?)");
    const insertFactionPath = db.prepare("INSERT INTO faction_path_state(campaign_id, faction_id, progress) VALUES(?, ?, 0)");
    for (const faction of content.factions) {
      insertFaction.run(id, faction.id, faction.initialCondition);
      insertFactionPath.run(id, faction.id);
    }
    const insertCharacter = db.prepare("INSERT INTO character_state(campaign_id, character_id, status, reputation, location_id) VALUES(?, ?, ?, ?, ?)");
    for (const character of content.characters) {
      insertCharacter.run(id, character.id, character.status, character.initialReputation, character.initialLocationId);
    }
    db.prepare("INSERT INTO event_log(campaign_id, turn, event_type, payload_json, created_at) VALUES(?, 0, 'campaign_created', ?, ?)")
      .run(id, JSON.stringify({ seed }), now);
    db.exec("COMMIT");
    return id;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getCampaign(db: DatabaseSync, name: string): CampaignRow | undefined {
  return db.prepare("SELECT id, name, seed, stage, turn, current_location_id AS currentLocationId FROM campaigns WHERE name = ?")
    .get(name) as CampaignRow | undefined;
}

export function backfillAuthoredState(db: DatabaseSync, content: VelmoraContent): void {
  const updateLocation = db.prepare(`UPDATE character_state SET location_id = ?
    WHERE character_id = ? AND (location_id IS NULL OR location_id = '')`);
  for (const character of content.characters) updateLocation.run(character.initialLocationId, character.id);
  const insertFactionPath = db.prepare("INSERT OR IGNORE INTO faction_path_state(campaign_id, faction_id, progress) SELECT id, ?, 0 FROM campaigns");
  for (const faction of content.factions) insertFactionPath.run(faction.id);
}

export function captureSnapshot(db: DatabaseSync, campaignId: string): StateSnapshot {
  const campaign = db.prepare("SELECT id, name, seed, stage, turn, current_location_id AS currentLocationId FROM campaigns WHERE id = ?")
    .get(campaignId) as CampaignRow | undefined;
  if (!campaign) throw new Error(`Campaign ${campaignId} does not exist`);
  const factions = db.prepare("SELECT faction_id AS factionId, condition FROM faction_state WHERE campaign_id = ? ORDER BY faction_id")
    .all(campaignId) as StateSnapshot["factions"];
  const characters = db.prepare(`SELECT character_id AS characterId, status, reputation, location_id AS locationId,
      replacement_character_id AS replacementCharacterId
      FROM character_state WHERE campaign_id = ? ORDER BY character_id`)
    .all(campaignId) as StateSnapshot["characters"];
  const factionPaths = db.prepare("SELECT faction_id AS factionId, progress FROM faction_path_state WHERE campaign_id = ? ORDER BY faction_id")
    .all(campaignId) as StateSnapshot["factionPaths"];
  const quests = db.prepare("SELECT quest_id AS questId, state FROM quest_instances WHERE campaign_id = ? ORDER BY quest_id")
    .all(campaignId) as StateSnapshot["quests"];
  return { campaign, factions, characters, factionPaths, quests };
}

export function insertCheckpoint(
  db: DatabaseSync,
  campaignId: string,
  sourceTurn: number,
  targetTurn: number,
  phase: "pre_turn" | "post_turn",
  snapshot: StateSnapshot
): void {
  db.prepare(`INSERT INTO checkpoints(campaign_id, source_turn, target_turn, phase, snapshot_json, created_at)
    VALUES(?, ?, ?, ?, ?, ?)`)
    .run(campaignId, sourceTurn, targetTurn, phase, JSON.stringify(snapshot), new Date().toISOString());
}

export function appendEvent(
  db: DatabaseSync,
  campaignId: string,
  turn: number,
  eventType: string,
  payload: unknown
): void {
  db.prepare("INSERT INTO event_log(campaign_id, turn, event_type, payload_json, created_at) VALUES(?, ?, ?, ?, ?)")
    .run(campaignId, turn, eventType, JSON.stringify(payload), new Date().toISOString());
}

export function getFactionCondition(db: DatabaseSync, campaignId: string, factionId: string): number | undefined {
  const row = db.prepare("SELECT condition FROM faction_state WHERE campaign_id = ? AND faction_id = ?")
    .get(campaignId, factionId) as { condition: number } | undefined;
  return row?.condition;
}

export function getCharacterReputation(db: DatabaseSync, campaignId: string, characterId: string): number | undefined {
  const row = db.prepare("SELECT reputation FROM character_state WHERE campaign_id = ? AND character_id = ?")
    .get(campaignId, characterId) as { reputation: number } | undefined;
  return row?.reputation;
}

export function restorePreviousTurn(db: DatabaseSync, name: string): CampaignRow {
  const campaign = getCampaign(db, name);
  if (!campaign) throw new Error(`Campaign '${name}' does not exist`);
  if (campaign.turn === 0) throw new Error("Campaign is already at turn 0");
  const checkpoint = db.prepare(`SELECT snapshot_json AS snapshotJson FROM checkpoints
      WHERE campaign_id = ? AND target_turn = ? AND phase = 'pre_turn'
      ORDER BY id DESC LIMIT 1`)
    .get(campaign.id, campaign.turn) as { snapshotJson: string } | undefined;
  if (!checkpoint) throw new Error(`No rollback checkpoint exists for turn ${campaign.turn}`);
  const snapshot = JSON.parse(checkpoint.snapshotJson) as StateSnapshot;

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE campaigns SET stage = ?, turn = ?, current_location_id = ?, updated_at = ? WHERE id = ?")
      .run(snapshot.campaign.stage, snapshot.campaign.turn, snapshot.campaign.currentLocationId, new Date().toISOString(), campaign.id);
    const updateFaction = db.prepare("UPDATE faction_state SET condition = ? WHERE campaign_id = ? AND faction_id = ?");
    for (const faction of snapshot.factions) updateFaction.run(faction.condition, campaign.id, faction.factionId);
    const updateCharacter = db.prepare(`UPDATE character_state SET status = ?, reputation = ?, location_id = ?, replacement_character_id = ?
      WHERE campaign_id = ? AND character_id = ?`);
    for (const character of snapshot.characters) {
      updateCharacter.run(character.status, character.reputation, character.locationId, character.replacementCharacterId, campaign.id, character.characterId);
    }
    const updateFactionPath = db.prepare("UPDATE faction_path_state SET progress = ? WHERE campaign_id = ? AND faction_id = ?");
    for (const path of snapshot.factionPaths ?? []) updateFactionPath.run(path.progress, campaign.id, path.factionId);
    const updateQuest = db.prepare("UPDATE quest_instances SET state = ? WHERE campaign_id = ? AND quest_id = ?");
    for (const quest of snapshot.quests ?? []) updateQuest.run(quest.state, campaign.id, quest.questId);
    db.prepare("DELETE FROM scene_records WHERE campaign_id = ? AND turn > ?").run(campaign.id, snapshot.campaign.turn);
    db.prepare("DELETE FROM location_state WHERE campaign_id = ? AND created_turn > ?").run(campaign.id, snapshot.campaign.turn);
    db.prepare("DELETE FROM tear_arrivals WHERE campaign_id = ? AND turn > ?").run(campaign.id, snapshot.campaign.turn);
    appendEvent(db, campaign.id, snapshot.campaign.turn, "turn_rolled_back", { fromTurn: campaign.turn, toTurn: snapshot.campaign.turn });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getCampaign(db, name)!;
}

export function listEvents(db: DatabaseSync, campaignId: string): Array<Record<string, unknown>> {
  return db.prepare(`SELECT sequence, turn, event_type AS eventType, payload_json AS payloadJson, created_at AS createdAt
    FROM event_log WHERE campaign_id = ? ORDER BY sequence`)
    .all(campaignId) as Array<Record<string, unknown>>;
}

export function countCheckpoints(db: DatabaseSync, campaignId: string): number {
  const row = db.prepare("SELECT COUNT(*) AS count FROM checkpoints WHERE campaign_id = ?").get(campaignId) as { count: number };
  return row.count;
}

export function listCharactersAtLocation(db: DatabaseSync, campaignId: string, locationId: string): string[] {
  const rows = db.prepare(`SELECT character_id AS characterId FROM character_state
    WHERE campaign_id = ? AND location_id = ? AND status != 'unavailable' ORDER BY character_id`)
    .all(campaignId, locationId) as Array<{ characterId: string }>;
  return rows.map((row) => row.characterId);
}

export function listLocationConsequences(db: DatabaseSync, campaignId: string, locationId: string): string[] {
  const rows = db.prepare(`SELECT consequence FROM location_state
    WHERE campaign_id = ? AND location_id = ? ORDER BY created_turn, consequence`)
    .all(campaignId, locationId) as Array<{ consequence: string }>;
  return rows.map((row) => row.consequence);
}

export function getSceneForTurnAndLocation(
  db: DatabaseSync,
  campaignId: string,
  turn: number,
  locationId: string
): ScenePackage | undefined {
  const row = db.prepare(`SELECT scene_json AS sceneJson FROM scene_records
    WHERE campaign_id = ? AND turn = ? AND location_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(campaignId, turn, locationId) as { sceneJson: string } | undefined;
  return row ? JSON.parse(row.sceneJson) as ScenePackage : undefined;
}

export function persistScene(db: DatabaseSync, scene: ScenePackage): void {
  db.prepare(`INSERT INTO scene_records(id, campaign_id, turn, stage, location_id, scene_json, created_at)
    VALUES(?, ?, ?, ?, ?, ?, ?)`)
    .run(scene.id, scene.campaignId, scene.turn, scene.stage, scene.locationId, JSON.stringify(scene), new Date().toISOString());
  appendEvent(db, scene.campaignId, scene.turn, "scene_encountered", { sceneId: scene.id, locationId: scene.locationId });
}

export function getStoryPresentation(db: DatabaseSync, campaignId: string, sceneId: string): StoryPresentation | undefined {
  const row = db.prepare("SELECT presentation_json AS presentationJson FROM story_records WHERE campaign_id = ? AND scene_id = ?")
    .get(campaignId, sceneId) as { presentationJson: string } | undefined;
  return row ? JSON.parse(row.presentationJson) as StoryPresentation : undefined;
}

export function persistStoryPresentation(db: DatabaseSync, campaignId: string, turn: number, presentation: StoryPresentation): void {
  db.prepare("INSERT OR REPLACE INTO story_records(campaign_id, scene_id, presentation_json, created_at) VALUES(?, ?, ?, ?)")
    .run(campaignId, presentation.sceneId, JSON.stringify(presentation), new Date().toISOString());
  appendEvent(db, campaignId, turn, "story_presented", { sceneId: presentation.sceneId, source: presentation.source });
}

export function countScenes(db: DatabaseSync, campaignId: string): number {
  const row = db.prepare("SELECT COUNT(*) AS count FROM scene_records WHERE campaign_id = ?").get(campaignId) as { count: number };
  return row.count;
}

export function listFactionConditions(db: DatabaseSync, campaignId: string): Array<{ factionId: string; condition: number }> {
  return db.prepare("SELECT faction_id AS factionId, condition FROM faction_state WHERE campaign_id = ? ORDER BY faction_id")
    .all(campaignId) as Array<{ factionId: string; condition: number }>;
}

export function getFactionPathProgress(db: DatabaseSync, campaignId: string, factionId: string): number | undefined {
  const row = db.prepare("SELECT progress FROM faction_path_state WHERE campaign_id = ? AND faction_id = ?")
    .get(campaignId, factionId) as { progress: number } | undefined;
  return row?.progress;
}

export function listFactionPathProgress(db: DatabaseSync, campaignId: string): Array<{ factionId: string; progress: number }> {
  return db.prepare("SELECT faction_id AS factionId, progress FROM faction_path_state WHERE campaign_id = ? ORDER BY faction_id")
    .all(campaignId) as Array<{ factionId: string; progress: number }>;
}

export function persistTearArrival(db: DatabaseSync, campaignId: string, arrival: TearArrival): void {
  db.prepare("INSERT INTO tear_arrivals(campaign_id, event_id, turn, event_json) VALUES(?, ?, ?, ?)")
    .run(campaignId, arrival.id, arrival.turn, JSON.stringify(arrival));
  appendEvent(db, campaignId, arrival.turn, "tear_arrival", arrival);
}

export function listRecentTearArrivals(db: DatabaseSync, campaignId: string, limit = 3): TearArrival[] {
  const rows = db.prepare("SELECT event_json AS eventJson FROM tear_arrivals WHERE campaign_id = ? ORDER BY turn DESC LIMIT ?")
    .all(campaignId, limit) as Array<{ eventJson: string }>;
  return rows.map((row) => JSON.parse(row.eventJson) as TearArrival);
}

export function listPresentCharacterStates(db: DatabaseSync, campaignId: string, locationId: string): Array<{ characterId: string; status: string; reputation: number }> {
  return db.prepare(`SELECT character_id AS characterId, status, reputation FROM character_state
    WHERE campaign_id = ? AND location_id = ? AND status != 'unavailable' ORDER BY character_id`)
    .all(campaignId, locationId) as Array<{ characterId: string; status: string; reputation: number }>;
}
