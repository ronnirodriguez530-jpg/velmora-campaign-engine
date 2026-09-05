import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createInitialBlueprintThreads, generateCampaignBlueprint } from "../application/campaign-blueprint-generator.ts";
import type {
  BelievedState,
  CampaignBlueprint,
  FactTruthStatus,
  FactVisibility,
  KnowledgeMethod,
  NpcCategory,
  NpcKnowledge,
  NpcKnowledgeView,
  NpcDesignProfile,
  NpcLifecycleState,
  NpcMemory,
  NpcOrigin,
  NpcRecord,
  NpcStatus,
  PlayerPower,
  PlayerInventoryItem,
  PlayerProgression,
  ProgressionMilestone,
  CharacterAdvancement,
  QuestInstance,
  NpcRelationship,
  PlayerCharacter,
  RelationshipQuality,
  RelationshipStanding,
  RelationshipTargetType,
  ScenePackage,
  StoryPresentation,
  StoryThread,
  TearArrival,
  VelmoraContent,
  WorldFact
} from "../domain/types.ts";

export type CampaignRow = {
  id: string;
  name: string;
  seed: string;
  stage: "opening" | "stabilization" | "escalation" | "resolution";
  turn: number;
  stageEnteredTurn: number;
  currentLocationId: string;
};

export type StateSnapshot = {
  campaign: CampaignRow;
  factions: Array<{ factionId: string; condition: number }>;
  characters: Array<{ characterId: string; status: string; reputation: number; locationId: string; replacementCharacterId: string | null }>;
  factionPaths: Array<{ factionId: string; progress: number }>;
  quests: Array<QuestInstance | { questId: string; state: string }>;
  npcState?: {
    records: NpcRecord[];
    designs: NpcDesignProfile[];
    facts: WorldFact[];
    knowledge: NpcKnowledge[];
    memories: NpcMemory[];
    relationships: NpcRelationship[];
    novelty: Array<{ fingerprint: string; npcId: string; createdTurn: number }>;
  };
  storyThreads?: StoryThread[];
  playerCharacter?: PlayerCharacter | null;
  playerPowers?: PlayerPower[];
  playerInventory?: PlayerInventoryItem[];
  progression?: {
    state: PlayerProgression;
    milestones: ProgressionMilestone[];
    advancements: CharacterAdvancement[];
  };
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
  const migrationTen = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 10").get() as { present: number } | undefined;
  if (!migrationTen) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS npc_records (
        campaign_id TEXT NOT NULL,
        npc_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('active','known','background')),
        origin TEXT NOT NULL CHECK(origin IN ('authored','generated')),
        faction_id TEXT,
        location_id TEXT,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        created_turn INTEGER NOT NULL,
        last_relevant_turn INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (campaign_id, npc_id),
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS npc_records_category_idx
        ON npc_records(campaign_id, category, last_relevant_turn DESC);
      CREATE TABLE IF NOT EXISTS npc_category_history (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        npc_id TEXT NOT NULL,
        turn INTEGER NOT NULL,
        previous_category TEXT NOT NULL CHECK(previous_category IN ('active','known','background')),
        new_category TEXT NOT NULL CHECK(new_category IN ('active','known','background')),
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (campaign_id, npc_id) REFERENCES npc_records(campaign_id, npc_id) ON DELETE CASCADE
      );
    `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(10, ?)").run(new Date().toISOString());
  }
  const migrationEleven = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 11").get() as { present: number } | undefined;
  if (!migrationEleven) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS world_facts (
        campaign_id TEXT NOT NULL,
        fact_id TEXT NOT NULL,
        statement TEXT NOT NULL,
        truth_status TEXT NOT NULL CHECK(truth_status IN ('established','disproven','unresolved')),
        visibility TEXT NOT NULL CHECK(visibility IN ('public','restricted','secret')),
        established_turn INTEGER NOT NULL,
        PRIMARY KEY (campaign_id, fact_id),
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS npc_knowledge (
        campaign_id TEXT NOT NULL,
        npc_id TEXT NOT NULL,
        fact_id TEXT NOT NULL,
        method TEXT NOT NULL CHECK(method IN ('witnessed','told','inferred')),
        confidence INTEGER NOT NULL CHECK(confidence BETWEEN 0 AND 100),
        believed_state TEXT NOT NULL CHECK(believed_state IN ('true','false','uncertain')),
        source_npc_id TEXT,
        learned_turn INTEGER NOT NULL,
        last_updated_turn INTEGER NOT NULL,
        PRIMARY KEY (campaign_id, npc_id, fact_id),
        FOREIGN KEY (campaign_id, npc_id) REFERENCES npc_records(campaign_id, npc_id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id, fact_id) REFERENCES world_facts(campaign_id, fact_id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS npc_memories (
        campaign_id TEXT NOT NULL,
        npc_id TEXT NOT NULL,
        memory_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        emotional_impact TEXT NOT NULL,
        importance INTEGER NOT NULL CHECK(importance BETWEEN 1 AND 3),
        unresolved INTEGER NOT NULL CHECK(unresolved IN (0,1)),
        created_turn INTEGER NOT NULL,
        last_recalled_turn INTEGER NOT NULL,
        PRIMARY KEY (campaign_id, npc_id, memory_id),
        FOREIGN KEY (campaign_id, npc_id) REFERENCES npc_records(campaign_id, npc_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS npc_memories_relevance_idx
        ON npc_memories(campaign_id, npc_id, unresolved DESC, importance DESC, last_recalled_turn DESC);
    `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(11, ?)").run(new Date().toISOString());
  }
  const migrationTwelve = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 12").get() as { present: number } | undefined;
  if (!migrationTwelve) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS npc_relationships (
        campaign_id TEXT NOT NULL,
        source_npc_id TEXT NOT NULL,
        target_type TEXT NOT NULL CHECK(target_type IN ('player','npc','faction')),
        target_id TEXT NOT NULL,
        standing TEXT NOT NULL CHECK(standing IN ('hostile','unfriendly','neutral','friendly','loyal')),
        updated_turn INTEGER NOT NULL,
        PRIMARY KEY (campaign_id, source_npc_id, target_type, target_id),
        FOREIGN KEY (campaign_id, source_npc_id) REFERENCES npc_records(campaign_id, npc_id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS npc_relationship_qualities (
        campaign_id TEXT NOT NULL,
        source_npc_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        quality TEXT NOT NULL CHECK(quality IN ('trusted','wary','afraid','indebted','respectful','attached')),
        PRIMARY KEY (campaign_id, source_npc_id, target_type, target_id, quality),
        FOREIGN KEY (campaign_id, source_npc_id, target_type, target_id)
          REFERENCES npc_relationships(campaign_id, source_npc_id, target_type, target_id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS npc_relationship_history (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        source_npc_id TEXT NOT NULL,
        target_type TEXT NOT NULL CHECK(target_type IN ('player','npc','faction')),
        target_id TEXT NOT NULL,
        previous_standing TEXT CHECK(previous_standing IS NULL OR previous_standing IN ('hostile','unfriendly','neutral','friendly','loyal')),
        new_standing TEXT NOT NULL CHECK(new_standing IN ('hostile','unfriendly','neutral','friendly','loyal')),
        added_qualities_json TEXT NOT NULL,
        removed_qualities_json TEXT NOT NULL,
        reason TEXT NOT NULL,
        turn INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (campaign_id, source_npc_id) REFERENCES npc_records(campaign_id, npc_id) ON DELETE CASCADE
      );
    `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(12, ?)").run(new Date().toISOString());
  }
  const migrationThirteen = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 13").get() as { present: number } | undefined;
  if (!migrationThirteen) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS npc_design_profiles (
        campaign_id TEXT NOT NULL,
        npc_id TEXT NOT NULL,
        desire TEXT NOT NULL,
        complication TEXT NOT NULL,
        change_lever TEXT NOT NULL,
        voice_cues_json TEXT NOT NULL,
        applied_lesson_ids_json TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        generated_turn INTEGER NOT NULL,
        PRIMARY KEY (campaign_id, npc_id),
        FOREIGN KEY (campaign_id, npc_id) REFERENCES npc_records(campaign_id, npc_id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS npc_novelty_ledger (
        campaign_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        npc_id TEXT NOT NULL,
        created_turn INTEGER NOT NULL,
        PRIMARY KEY (campaign_id, fingerprint),
        FOREIGN KEY (campaign_id, npc_id) REFERENCES npc_records(campaign_id, npc_id) ON DELETE CASCADE
      );
    `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(13, ?)").run(new Date().toISOString());
  }
  const migrationFourteen = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 14").get() as { present: number } | undefined;
  if (!migrationFourteen) {
    db.exec(`
      ALTER TABLE npc_records ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'current'
        CHECK(lifecycle_state IN ('current','archived'));
      CREATE TABLE IF NOT EXISTS npc_lifecycle_history (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        npc_id TEXT NOT NULL,
        previous_status TEXT NOT NULL,
        new_status TEXT NOT NULL,
        previous_lifecycle_state TEXT NOT NULL CHECK(previous_lifecycle_state IN ('current','archived')),
        new_lifecycle_state TEXT NOT NULL CHECK(new_lifecycle_state IN ('current','archived')),
        reason TEXT NOT NULL,
        turn INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (campaign_id, npc_id) REFERENCES npc_records(campaign_id, npc_id) ON DELETE CASCADE
      );
    `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(14, ?)").run(new Date().toISOString());
  }
  const migrationFifteen = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 15").get() as { present: number } | undefined;
  if (!migrationFifteen) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS story_threads (
        campaign_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('main','faction','side','personal','mystery','dynamic')),
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('dormant','active','blocked','resolved','failed')),
        visibility TEXT NOT NULL CHECK(visibility IN ('player','director')),
        minimum_stage TEXT NOT NULL CHECK(minimum_stage IN ('opening','stabilization','escalation','resolution')),
        maximum_stage TEXT NOT NULL CHECK(maximum_stage IN ('opening','stabilization','escalation','resolution')),
        urgency INTEGER NOT NULL CHECK(urgency BETWEEN 0 AND 3),
        location_ids_json TEXT NOT NULL,
        faction_ids_json TEXT NOT NULL,
        npc_ids_json TEXT NOT NULL,
        recovery_paths_json TEXT NOT NULL,
        created_turn INTEGER NOT NULL,
        updated_turn INTEGER NOT NULL,
        last_used_turn INTEGER,
        PRIMARY KEY (campaign_id, thread_id),
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS story_threads_relevance_idx
        ON story_threads(campaign_id, status, urgency DESC, updated_turn DESC);
    `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(15, ?)").run(new Date().toISOString());
  }
  const migrationSixteen = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 16").get() as { present: number } | undefined;
  if (!migrationSixteen) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS campaign_blueprints (
        campaign_id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        blueprint_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );
    `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(16, ?)").run(new Date().toISOString());
  }
  const migrationSeventeen = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 17").get() as { present: number } | undefined;
  if (!migrationSeventeen) {
    const storyThreadColumns = db.prepare("PRAGMA table_info(story_threads)").all() as Array<{ name: string }>;
    if (!storyThreadColumns.some((column) => column.name === "origin")) {
      db.exec("ALTER TABLE story_threads ADD COLUMN origin TEXT NOT NULL DEFAULT 'blueprint'");
    }
    if (!storyThreadColumns.some((column) => column.name === "basis_id")) {
      db.exec("ALTER TABLE story_threads ADD COLUMN basis_id TEXT");
    }
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(17, ?)").run(new Date().toISOString());
  }
  const migrationEighteen = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 18").get() as { present: number } | undefined;
  if (!migrationEighteen) {
    const campaignColumns = db.prepare("PRAGMA table_info(campaigns)").all() as Array<{ name: string }>;
    if (!campaignColumns.some((column) => column.name === "stage_entered_turn")) {
      db.exec("ALTER TABLE campaigns ADD COLUMN stage_entered_turn INTEGER NOT NULL DEFAULT 0");
      db.exec("UPDATE campaigns SET stage_entered_turn = turn");
    }
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(18, ?)").run(new Date().toISOString());
  }
  const migrationNineteen = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 19").get() as { present: number } | undefined;
  if (!migrationNineteen) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_characters (
        campaign_id TEXT PRIMARY KEY,
        character_id TEXT NOT NULL DEFAULT 'PC-001' CHECK(character_id = 'PC-001'),
        creation_version INTEGER NOT NULL DEFAULT 1 CHECK(creation_version = 1),
        name TEXT NOT NULL,
        identity_notes TEXT NOT NULL DEFAULT '',
        strength INTEGER NOT NULL CHECK(strength BETWEEN 1 AND 30),
        dexterity INTEGER NOT NULL CHECK(dexterity BETWEEN 1 AND 30),
        constitution INTEGER NOT NULL CHECK(constitution BETWEEN 1 AND 30),
        intelligence INTEGER NOT NULL CHECK(intelligence BETWEEN 1 AND 30),
        wisdom INTEGER NOT NULL CHECK(wisdom BETWEEN 1 AND 30),
        charisma INTEGER NOT NULL CHECK(charisma BETWEEN 1 AND 30),
        proficiency_bonus INTEGER NOT NULL DEFAULT 2 CHECK(proficiency_bonus = 2),
        max_hp INTEGER NOT NULL CHECK(max_hp > 0),
        current_hp INTEGER NOT NULL CHECK(current_hp >= 0 AND current_hp <= max_hp),
        armor_bonus INTEGER NOT NULL DEFAULT 0 CHECK(armor_bonus BETWEEN 0 AND 4),
        created_turn INTEGER NOT NULL,
        updated_turn INTEGER NOT NULL,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS player_skill_proficiencies (
        campaign_id TEXT NOT NULL,
        skill_key TEXT NOT NULL,
        PRIMARY KEY (campaign_id, skill_key),
        FOREIGN KEY (campaign_id) REFERENCES player_characters(campaign_id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS player_save_proficiencies (
        campaign_id TEXT NOT NULL,
        ability_key TEXT NOT NULL,
        PRIMARY KEY (campaign_id, ability_key),
        FOREIGN KEY (campaign_id) REFERENCES player_characters(campaign_id) ON DELETE CASCADE
      );
    `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(19, ?)").run(new Date().toISOString());
  }
  const migrationTwenty = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 20").get() as { present: number } | undefined;
  if (!migrationTwenty) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pending_action_checks (
        campaign_id TEXT PRIMARY KEY,
        check_id TEXT NOT NULL UNIQUE,
        player_input TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('ability','skill','saving_throw')),
        ability TEXT NOT NULL,
        skill TEXT,
        difficulty TEXT NOT NULL CHECK(difficulty IN ('easy','standard','hard','extreme')),
        dc INTEGER NOT NULL CHECK(dc IN (8,12,16,20)),
        mode TEXT NOT NULL CHECK(mode IN ('normal','advantage','disadvantage')),
        stakes TEXT NOT NULL,
        modifier INTEGER NOT NULL,
        proficiency_applied INTEGER NOT NULL CHECK(proficiency_applied IN (0,1)),
        created_turn INTEGER NOT NULL,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS roll_records (
        campaign_id TEXT NOT NULL,
        roll_id TEXT NOT NULL,
        check_id TEXT NOT NULL UNIQUE,
        turn INTEGER NOT NULL,
        category TEXT NOT NULL,
        ability TEXT NOT NULL,
        skill TEXT,
        mode TEXT NOT NULL,
        dice_json TEXT NOT NULL,
        kept_die INTEGER NOT NULL CHECK(kept_die BETWEEN 1 AND 20),
        modifier INTEGER NOT NULL,
        total INTEGER NOT NULL,
        difficulty TEXT NOT NULL,
        dc INTEGER NOT NULL,
        outcome TEXT NOT NULL CHECK(outcome IN ('critical_success','success','success_with_cost','failure','critical_failure')),
        stakes TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (campaign_id, roll_id),
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );
    `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(20, ?)").run(new Date().toISOString());
  }
  const migrationTwentyOne = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 21").get() as { present: number } | undefined;
  if (!migrationTwentyOne) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_powers (
        campaign_id TEXT NOT NULL,
        power_id TEXT NOT NULL,
        source TEXT NOT NULL CHECK(source IN ('innate','invented','magic_tech','discovered','taken','taught','made','tear','void_rift')),
        player_approved INTEGER NOT NULL CHECK(player_approved IN (0,1)),
        active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
        acquired_turn INTEGER NOT NULL,
        activated_turn INTEGER,
        PRIMARY KEY (campaign_id, power_id),
        FOREIGN KEY (campaign_id) REFERENCES player_characters(campaign_id) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS player_one_active_sustained_power_idx
        ON player_powers(campaign_id) WHERE active = 1;
    `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(21, ?)").run(new Date().toISOString());
  }
  const migrationTwentyTwo = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 22").get() as { present: number } | undefined;
  if (!migrationTwentyTwo) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_inventory (
        campaign_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99),
        equipped_slot TEXT CHECK(equipped_slot IS NULL OR equipped_slot IN ('main_hand','off_hand','body','utility')),
        acquisition_source TEXT NOT NULL CHECK(acquisition_source IN ('starting','found','reward','purchased','crafted','given')),
        acquired_turn INTEGER NOT NULL,
        updated_turn INTEGER NOT NULL,
        PRIMARY KEY (campaign_id, item_id),
        FOREIGN KEY (campaign_id) REFERENCES player_characters(campaign_id) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS player_one_item_per_slot_idx
        ON player_inventory(campaign_id, equipped_slot) WHERE equipped_slot IS NOT NULL;
    `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(22, ?)").run(new Date().toISOString());
  }
  const migrationTwentyThree = db.prepare("SELECT 1 AS present FROM schema_migrations WHERE version = 23").get() as { present: number } | undefined;
  if (!migrationTwentyThree) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_progression (
        campaign_id TEXT PRIMARY KEY,
        earned_advancements INTEGER NOT NULL DEFAULT 0 CHECK(earned_advancements >= 0),
        spent_advancements INTEGER NOT NULL DEFAULT 0 CHECK(spent_advancements >= 0 AND spent_advancements <= earned_advancements),
        updated_turn INTEGER NOT NULL,
        FOREIGN KEY (campaign_id) REFERENCES player_characters(campaign_id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS progression_milestones (
        campaign_id TEXT NOT NULL,
        milestone_id TEXT NOT NULL,
        basis_type TEXT NOT NULL CHECK(basis_type IN ('quest','faction','story','discovery')),
        basis_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        awarded_turn INTEGER NOT NULL,
        PRIMARY KEY (campaign_id, milestone_id),
        UNIQUE (campaign_id, basis_type, basis_id),
        FOREIGN KEY (campaign_id) REFERENCES player_characters(campaign_id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS character_advancements (
        campaign_id TEXT NOT NULL,
        advancement_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('ability_score','skill_proficiency')),
        target TEXT NOT NULL,
        previous_value INTEGER,
        new_value INTEGER,
        applied_turn INTEGER NOT NULL,
        PRIMARY KEY (campaign_id, advancement_id),
        FOREIGN KEY (campaign_id) REFERENCES player_characters(campaign_id) ON DELETE CASCADE
      );
    `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(23, ?)").run(new Date().toISOString());
  }
}

const STAGE_ORDER = { opening: 0, stabilization: 1, escalation: 2, resolution: 3 } as const;

function storyThreadFromRow(row: Record<string, unknown>): StoryThread {
  return {
    campaignId: row.campaignId as string,
    threadId: row.threadId as string,
    kind: row.kind as StoryThread["kind"],
    title: row.title as string,
    summary: row.summary as string,
    status: row.status as StoryThread["status"],
    visibility: row.visibility as StoryThread["visibility"],
    origin: (row.origin as StoryThread["origin"] | undefined) ?? "blueprint",
    basisId: (row.basisId as string | null | undefined) ?? null,
    minimumStage: row.minimumStage as StoryThread["minimumStage"],
    maximumStage: row.maximumStage as StoryThread["maximumStage"],
    urgency: row.urgency as StoryThread["urgency"],
    locationIds: JSON.parse(row.locationIdsJson as string) as string[],
    factionIds: JSON.parse(row.factionIdsJson as string) as string[],
    npcIds: JSON.parse(row.npcIdsJson as string) as string[],
    recoveryPaths: JSON.parse(row.recoveryPathsJson as string) as string[],
    createdTurn: row.createdTurn as number,
    updatedTurn: row.updatedTurn as number,
    lastUsedTurn: row.lastUsedTurn as number | null
  };
}

export function persistStoryThread(db: DatabaseSync, thread: StoryThread): void {
  if (STAGE_ORDER[thread.minimumStage] > STAGE_ORDER[thread.maximumStage]) {
    throw new Error("Story thread minimum stage cannot follow its maximum stage");
  }
  if (!thread.title.trim() || !thread.summary.trim()) throw new Error("Story thread requires a title and summary");
  const origin = thread.origin ?? "blueprint";
  const basisId = thread.basisId ?? null;
  db.prepare(`INSERT INTO story_threads(
      campaign_id, thread_id, kind, title, summary, status, visibility,
      origin, basis_id, minimum_stage, maximum_stage, urgency, location_ids_json, faction_ids_json,
      npc_ids_json, recovery_paths_json, created_turn, updated_turn, last_used_turn
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(campaign_id, thread_id) DO UPDATE SET
      kind = excluded.kind, title = excluded.title, summary = excluded.summary,
      status = excluded.status, visibility = excluded.visibility,
      origin = excluded.origin, basis_id = excluded.basis_id,
      minimum_stage = excluded.minimum_stage, maximum_stage = excluded.maximum_stage,
      urgency = excluded.urgency, location_ids_json = excluded.location_ids_json,
      faction_ids_json = excluded.faction_ids_json, npc_ids_json = excluded.npc_ids_json,
      recovery_paths_json = excluded.recovery_paths_json, updated_turn = excluded.updated_turn,
      last_used_turn = excluded.last_used_turn`)
    .run(
      thread.campaignId, thread.threadId, thread.kind, thread.title, thread.summary,
      thread.status, thread.visibility, origin, basisId, thread.minimumStage, thread.maximumStage,
      thread.urgency, JSON.stringify(thread.locationIds), JSON.stringify(thread.factionIds),
      JSON.stringify(thread.npcIds), JSON.stringify(thread.recoveryPaths), thread.createdTurn,
      thread.updatedTurn, thread.lastUsedTurn
    );
}

export function listStoryThreads(db: DatabaseSync, campaignId: string): StoryThread[] {
  const rows = db.prepare(`SELECT campaign_id AS campaignId, thread_id AS threadId, kind, title, summary,
      status, visibility, origin, basis_id AS basisId, minimum_stage AS minimumStage, maximum_stage AS maximumStage,
      urgency, location_ids_json AS locationIdsJson, faction_ids_json AS factionIdsJson,
      npc_ids_json AS npcIdsJson, recovery_paths_json AS recoveryPathsJson,
      created_turn AS createdTurn, updated_turn AS updatedTurn, last_used_turn AS lastUsedTurn
    FROM story_threads WHERE campaign_id = ? ORDER BY thread_id`).all(campaignId) as Array<Record<string, unknown>>;
  return rows.map(storyThreadFromRow);
}

export function listRelevantStoryThreads(
  db: DatabaseSync,
  campaignId: string,
  stage: StoryThread["minimumStage"],
  locationId: string,
  visibility: StoryThread["visibility"],
  limit = 12
): StoryThread[] {
  return listStoryThreads(db, campaignId)
    .filter((thread) => thread.visibility === visibility)
    .filter((thread) => thread.status !== "resolved" && thread.status !== "failed")
    .filter((thread) => STAGE_ORDER[stage] >= STAGE_ORDER[thread.minimumStage] && STAGE_ORDER[stage] <= STAGE_ORDER[thread.maximumStage])
    .filter((thread) => thread.locationIds.length === 0 || thread.locationIds.includes(locationId))
    .sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || b.urgency - a.urgency || b.updatedTurn - a.updatedTurn)
    .slice(0, limit);
}

export function persistCampaignBlueprint(db: DatabaseSync, blueprint: CampaignBlueprint): void {
  db.prepare(`INSERT INTO campaign_blueprints(campaign_id, version, blueprint_json, created_at)
      VALUES(?, ?, ?, ?)
      ON CONFLICT(campaign_id) DO NOTHING`)
    .run(blueprint.campaignId, blueprint.version, JSON.stringify(blueprint), new Date().toISOString());
}

export function getCampaignBlueprint(db: DatabaseSync, campaignId: string): CampaignBlueprint | undefined {
  const row = db.prepare("SELECT blueprint_json AS blueprintJson FROM campaign_blueprints WHERE campaign_id = ?")
    .get(campaignId) as { blueprintJson: string } | undefined;
  return row ? JSON.parse(row.blueprintJson) as CampaignBlueprint : undefined;
}

function questFromRow(row: Record<string, unknown>): QuestInstance {
  const stored = JSON.parse(row.dataJson as string) as QuestInstance;
  const objectives = stored.objectives.map((objective, index, all) => ({
    ...objective,
    required: objective.required ?? true,
    dependsOnObjectiveIds: objective.dependsOnObjectiveIds ?? (index === 0 ? [] : [all[index - 1]!.objectiveId]),
    branchGroupId: objective.branchGroupId ?? null
  }));
  return {
    ...stored,
    campaignId: String(row.campaignId),
    questId: String(row.questId),
    title: String(row.title),
    questType: row.questType as QuestInstance["questType"],
    state: row.state as QuestInstance["state"],
    objectives,
    relationships: stored.relationships ?? [],
    isTurningPoint: Number(row.isTurningPoint) === 1,
    recoveryOfQuestId: stored.recoveryOfQuestId ?? null,
    recoveryPathUsed: stored.recoveryPathUsed ?? null,
    recoveryEvidenceEventSequences: stored.recoveryEvidenceEventSequences ?? [],
    failureReason: stored.failureReason ?? null,
    failureEvidenceEventSequences: stored.failureEvidenceEventSequences ?? []
  };
}

export function persistQuestInstance(db: DatabaseSync, quest: QuestInstance): void {
  db.prepare(`INSERT INTO quest_instances(
      campaign_id, quest_id, title, quest_type, state, is_turning_point, outcome_limit, data_json
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(campaign_id, quest_id) DO UPDATE SET
      title = excluded.title, quest_type = excluded.quest_type, state = excluded.state,
      is_turning_point = excluded.is_turning_point, outcome_limit = excluded.outcome_limit,
      data_json = excluded.data_json`)
    .run(
      quest.campaignId,
      quest.questId,
      quest.title,
      quest.questType,
      quest.state,
      quest.isTurningPoint ? 1 : 0,
      quest.outcomes.length,
      JSON.stringify(quest)
    );
}

export function listQuestInstances(db: DatabaseSync, campaignId: string): QuestInstance[] {
  const rows = db.prepare(`SELECT campaign_id AS campaignId, quest_id AS questId, title,
      quest_type AS questType, state, is_turning_point AS isTurningPoint,
      data_json AS dataJson
    FROM quest_instances WHERE campaign_id = ? ORDER BY quest_id`).all(campaignId) as Array<Record<string, unknown>>;
  return rows.map(questFromRow);
}

export function listRelevantQuestInstances(
  db: DatabaseSync,
  campaignId: string,
  stage: QuestInstance["minimumStage"],
  visibility: QuestInstance["visibility"]
): QuestInstance[] {
  return listQuestInstances(db, campaignId)
    .filter((quest) => quest.visibility === visibility)
    .filter((quest) => visibility === "director" || quest.state !== "locked")
    .filter((quest) => STAGE_ORDER[stage] >= STAGE_ORDER[quest.minimumStage] && STAGE_ORDER[stage] <= STAGE_ORDER[quest.maximumStage])
    .sort((left, right) => right.updatedTurn - left.updatedTurn || left.questId.localeCompare(right.questId))
    .slice(0, 12);
}

const PLAYER_ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function getPlayerCharacter(db: DatabaseSync, campaignId: string): PlayerCharacter | undefined {
  const row = db.prepare(`SELECT campaign_id AS campaignId, character_id AS characterId,
      creation_version AS creationVersion, name, identity_notes AS identityNotes,
      strength, dexterity, constitution, intelligence, wisdom, charisma,
      proficiency_bonus AS proficiencyBonus, max_hp AS maxHp, current_hp AS currentHp,
      armor_bonus AS armorBonus, created_turn AS createdTurn, updated_turn AS updatedTurn
    FROM player_characters WHERE campaign_id = ?`).get(campaignId) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  const abilityScores = Object.fromEntries(PLAYER_ABILITIES.map((ability) => [ability, Number(row[ability])])) as PlayerCharacter["abilityScores"];
  const abilityModifiers = Object.fromEntries(PLAYER_ABILITIES.map((ability) => [ability, abilityModifier(abilityScores[ability])])) as PlayerCharacter["abilityModifiers"];
  const skillProficiencies = db.prepare("SELECT skill_key AS skillKey FROM player_skill_proficiencies WHERE campaign_id = ? ORDER BY skill_key")
    .all(campaignId).map((entry) => (entry as { skillKey: PlayerCharacter["skillProficiencies"][number] }).skillKey);
  const saveProficiencies = db.prepare("SELECT ability_key AS abilityKey FROM player_save_proficiencies WHERE campaign_id = ? ORDER BY ability_key")
    .all(campaignId).map((entry) => (entry as { abilityKey: PlayerCharacter["saveProficiencies"][number] }).abilityKey);
  const armorBonus = Number(row.armorBonus);
  return {
    campaignId: String(row.campaignId),
    characterId: "PC-001",
    creationVersion: 1,
    name: String(row.name),
    identityNotes: String(row.identityNotes),
    abilityScores,
    abilityModifiers,
    skillProficiencies,
    saveProficiencies,
    proficiencyBonus: 2,
    maxHp: Number(row.maxHp),
    currentHp: Number(row.currentHp),
    armorBonus,
    defense: 10 + abilityModifiers.dexterity + armorBonus,
    createdTurn: Number(row.createdTurn),
    updatedTurn: Number(row.updatedTurn)
  };
}

export function persistPlayerCharacter(db: DatabaseSync, character: PlayerCharacter): void {
  const ownsTransaction = !db.isTransaction;
  if (ownsTransaction) db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`INSERT INTO player_characters(
        campaign_id, character_id, creation_version, name, identity_notes,
        strength, dexterity, constitution, intelligence, wisdom, charisma,
        proficiency_bonus, max_hp, current_hp, armor_bonus, created_turn, updated_turn
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(campaign_id) DO UPDATE SET
        character_id = excluded.character_id, creation_version = excluded.creation_version,
        name = excluded.name, identity_notes = excluded.identity_notes,
        strength = excluded.strength, dexterity = excluded.dexterity,
        constitution = excluded.constitution, intelligence = excluded.intelligence,
        wisdom = excluded.wisdom, charisma = excluded.charisma,
        proficiency_bonus = excluded.proficiency_bonus, max_hp = excluded.max_hp,
        current_hp = excluded.current_hp, armor_bonus = excluded.armor_bonus,
        created_turn = excluded.created_turn, updated_turn = excluded.updated_turn`)
      .run(
        character.campaignId,
        character.characterId,
        character.creationVersion,
        character.name,
        character.identityNotes,
        character.abilityScores.strength,
        character.abilityScores.dexterity,
        character.abilityScores.constitution,
        character.abilityScores.intelligence,
        character.abilityScores.wisdom,
        character.abilityScores.charisma,
        character.proficiencyBonus,
        character.maxHp,
        character.currentHp,
        character.armorBonus,
        character.createdTurn,
        character.updatedTurn
      );
    db.prepare("DELETE FROM player_skill_proficiencies WHERE campaign_id = ?").run(character.campaignId);
    db.prepare("DELETE FROM player_save_proficiencies WHERE campaign_id = ?").run(character.campaignId);
    const insertSkill = db.prepare("INSERT INTO player_skill_proficiencies(campaign_id, skill_key) VALUES(?, ?)");
    for (const skill of character.skillProficiencies) insertSkill.run(character.campaignId, skill);
    const insertSave = db.prepare("INSERT INTO player_save_proficiencies(campaign_id, ability_key) VALUES(?, ?)");
    for (const ability of character.saveProficiencies) insertSave.run(character.campaignId, ability);
    if (ownsTransaction) db.exec("COMMIT");
  } catch (error) {
    if (ownsTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

export function listPlayerPowers(db: DatabaseSync, campaignId: string): PlayerPower[] {
  const rows = db.prepare(`SELECT campaign_id AS campaignId, power_id AS powerId, source,
      player_approved AS playerApproved, active, acquired_turn AS acquiredTurn,
      activated_turn AS activatedTurn
    FROM player_powers WHERE campaign_id = ? ORDER BY power_id`).all(campaignId) as Array<{
      campaignId: string;
      powerId: string;
      source: PlayerPower["source"];
      playerApproved: number;
      active: number;
      acquiredTurn: number;
      activatedTurn: number | null;
    }>;
  return rows.map((row) => ({
    ...row,
    playerApproved: row.playerApproved === 1,
    active: row.active === 1
  }));
}

export function persistPlayerPower(db: DatabaseSync, power: PlayerPower): void {
  db.prepare(`INSERT INTO player_powers(
      campaign_id, power_id, source, player_approved, active, acquired_turn, activated_turn
    ) VALUES(?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(campaign_id, power_id) DO UPDATE SET
      source = excluded.source, player_approved = excluded.player_approved,
      active = excluded.active, acquired_turn = excluded.acquired_turn,
      activated_turn = excluded.activated_turn`)
    .run(
      power.campaignId,
      power.powerId,
      power.source,
      power.playerApproved ? 1 : 0,
      power.active ? 1 : 0,
      power.acquiredTurn,
      power.activatedTurn
    );
}

export function listPlayerInventory(db: DatabaseSync, campaignId: string): PlayerInventoryItem[] {
  return db.prepare(`SELECT campaign_id AS campaignId, item_id AS itemId, quantity,
      equipped_slot AS equippedSlot, acquisition_source AS acquisitionSource,
      acquired_turn AS acquiredTurn, updated_turn AS updatedTurn
    FROM player_inventory WHERE campaign_id = ? ORDER BY item_id`)
    .all(campaignId) as PlayerInventoryItem[];
}

export function persistPlayerInventoryItem(db: DatabaseSync, item: PlayerInventoryItem): void {
  db.prepare(`INSERT INTO player_inventory(
      campaign_id, item_id, quantity, equipped_slot, acquisition_source, acquired_turn, updated_turn
    ) VALUES(?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(campaign_id, item_id) DO UPDATE SET
      quantity = excluded.quantity, equipped_slot = excluded.equipped_slot,
      acquisition_source = excluded.acquisition_source, acquired_turn = excluded.acquired_turn,
      updated_turn = excluded.updated_turn`)
    .run(
      item.campaignId,
      item.itemId,
      item.quantity,
      item.equippedSlot,
      item.acquisitionSource,
      item.acquiredTurn,
      item.updatedTurn
    );
}

export function getPlayerProgression(db: DatabaseSync, campaignId: string): PlayerProgression {
  const row = db.prepare(`SELECT campaign_id AS campaignId, earned_advancements AS earnedAdvancements,
      spent_advancements AS spentAdvancements, updated_turn AS updatedTurn
    FROM player_progression WHERE campaign_id = ?`).get(campaignId) as Omit<PlayerProgression, "availableAdvancements"> | undefined;
  if (!row) return { campaignId, earnedAdvancements: 0, spentAdvancements: 0, availableAdvancements: 0, updatedTurn: 0 };
  return { ...row, availableAdvancements: row.earnedAdvancements - row.spentAdvancements };
}

export function persistPlayerProgression(db: DatabaseSync, progression: PlayerProgression): void {
  db.prepare(`INSERT INTO player_progression(campaign_id, earned_advancements, spent_advancements, updated_turn)
      VALUES(?, ?, ?, ?)
      ON CONFLICT(campaign_id) DO UPDATE SET
        earned_advancements = excluded.earned_advancements,
        spent_advancements = excluded.spent_advancements,
        updated_turn = excluded.updated_turn`)
    .run(progression.campaignId, progression.earnedAdvancements, progression.spentAdvancements, progression.updatedTurn);
}

export function listProgressionMilestones(db: DatabaseSync, campaignId: string): ProgressionMilestone[] {
  return db.prepare(`SELECT campaign_id AS campaignId, milestone_id AS milestoneId,
      basis_type AS basisType, basis_id AS basisId, summary, awarded_turn AS awardedTurn
    FROM progression_milestones WHERE campaign_id = ? ORDER BY awarded_turn, milestone_id`)
    .all(campaignId) as ProgressionMilestone[];
}

export function listCharacterAdvancements(db: DatabaseSync, campaignId: string): CharacterAdvancement[] {
  return db.prepare(`SELECT campaign_id AS campaignId, advancement_id AS advancementId,
      kind, target, previous_value AS previousValue, new_value AS newValue,
      applied_turn AS appliedTurn
    FROM character_advancements WHERE campaign_id = ? ORDER BY applied_turn, advancement_id`)
    .all(campaignId) as CharacterAdvancement[];
}

export function persistProgressionMilestone(db: DatabaseSync, milestone: ProgressionMilestone): void {
  db.prepare(`INSERT INTO progression_milestones(
      campaign_id, milestone_id, basis_type, basis_id, summary, awarded_turn
    ) VALUES(?, ?, ?, ?, ?, ?)`)
    .run(milestone.campaignId, milestone.milestoneId, milestone.basisType, milestone.basisId, milestone.summary, milestone.awardedTurn);
}

export function persistCharacterAdvancement(db: DatabaseSync, advancement: CharacterAdvancement): void {
  db.prepare(`INSERT INTO character_advancements(
      campaign_id, advancement_id, kind, target, previous_value, new_value, applied_turn
    ) VALUES(?, ?, ?, ?, ?, ?, ?)`)
    .run(
      advancement.campaignId,
      advancement.advancementId,
      advancement.kind,
      advancement.target,
      advancement.previousValue,
      advancement.newValue,
      advancement.appliedTurn
    );
}

export function persistNpc(
  db: DatabaseSync,
  npc: {
    campaignId: string;
    npcId: string;
    name: string;
    category: NpcCategory;
    origin: NpcOrigin;
    factionId?: string | null;
    locationId?: string | null;
    role: string;
    status?: NpcStatus;
    lifecycleState?: NpcLifecycleState;
    createdTurn: number;
    lastRelevantTurn?: number;
  }
): void {
  db.prepare(`INSERT INTO npc_records(
      campaign_id, npc_id, name, category, origin, faction_id, location_id, role,
      status, lifecycle_state, created_turn, last_relevant_turn, updated_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      npc.campaignId,
      npc.npcId,
      npc.name,
      npc.category,
      npc.origin,
      npc.factionId ?? null,
      npc.locationId ?? null,
      npc.role,
      npc.status ?? "available",
      npc.lifecycleState ?? "current",
      npc.createdTurn,
      npc.lastRelevantTurn ?? npc.createdTurn,
      new Date().toISOString()
    );
}

export function getNpc(db: DatabaseSync, campaignId: string, npcId: string): NpcRecord | undefined {
  return db.prepare(`SELECT
      campaign_id AS campaignId, npc_id AS npcId, name, category, origin,
      faction_id AS factionId, location_id AS locationId, role, status,
      lifecycle_state AS lifecycleState,
      created_turn AS createdTurn, last_relevant_turn AS lastRelevantTurn
    FROM npc_records WHERE campaign_id = ? AND npc_id = ?`)
    .get(campaignId, npcId) as NpcRecord | undefined;
}

export function listNpcsByCategory(db: DatabaseSync, campaignId: string, category: NpcCategory): NpcRecord[] {
  return db.prepare(`SELECT
      campaign_id AS campaignId, npc_id AS npcId, name, category, origin,
      faction_id AS factionId, location_id AS locationId, role, status,
      lifecycle_state AS lifecycleState,
      created_turn AS createdTurn, last_relevant_turn AS lastRelevantTurn
    FROM npc_records WHERE campaign_id = ? AND category = ?
    ORDER BY last_relevant_turn DESC, npc_id`)
    .all(campaignId, category) as NpcRecord[];
}

export function listNpcsAtLocation(db: DatabaseSync, campaignId: string, locationId: string): NpcRecord[] {
  return db.prepare(`SELECT
      campaign_id AS campaignId, npc_id AS npcId, name, category, origin,
      faction_id AS factionId, location_id AS locationId, role, status,
      lifecycle_state AS lifecycleState,
      created_turn AS createdTurn, last_relevant_turn AS lastRelevantTurn
    FROM npc_records WHERE campaign_id = ? AND location_id = ? AND status != 'unavailable' AND lifecycle_state = 'current'
    ORDER BY last_relevant_turn DESC, npc_id`)
    .all(campaignId, locationId) as NpcRecord[];
}

export function reclassifyNpc(
  db: DatabaseSync,
  campaignId: string,
  npcId: string,
  category: NpcCategory,
  turn: number,
  reason: string
): NpcRecord {
  const npc = getNpc(db, campaignId, npcId);
  if (!npc) throw new Error(`NPC ${npcId} does not exist in campaign ${campaignId}`);
  if (!reason.trim()) throw new Error("NPC category changes require a reason");
  if (npc.category === category) return npc;
  const now = new Date().toISOString();
  const ownsTransaction = !db.isTransaction;
  if (ownsTransaction) db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`UPDATE npc_records SET category = ?, last_relevant_turn = ?, updated_at = ?
      WHERE campaign_id = ? AND npc_id = ?`)
      .run(category, turn, now, campaignId, npcId);
    db.prepare(`INSERT INTO npc_category_history(
      campaign_id, npc_id, turn, previous_category, new_category, reason, created_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?)`)
      .run(campaignId, npcId, turn, npc.category, category, reason.trim(), now);
    appendEvent(db, campaignId, turn, "npc_reclassified", {
      npcId,
      previousCategory: npc.category,
      newCategory: category,
      reason: reason.trim()
    });
    if (ownsTransaction) db.exec("COMMIT");
  } catch (error) {
    if (ownsTransaction) db.exec("ROLLBACK");
    throw error;
  }
  return getNpc(db, campaignId, npcId)!;
}

const NPC_STATUSES = new Set<NpcStatus>([
  "available",
  "injured",
  "missing",
  "detained",
  "unavailable",
  "dead",
  "departed"
]);

export function changeNpcLifecycle(
  db: DatabaseSync,
  change: {
    campaignId: string;
    npcId: string;
    status: NpcStatus;
    locationId?: string | null;
    reason: string;
    turn: number;
  }
): NpcRecord {
  const npc = getNpc(db, change.campaignId, change.npcId);
  if (!npc) throw new Error(`NPC ${change.npcId} does not exist in campaign ${change.campaignId}`);
  if (!NPC_STATUSES.has(change.status)) throw new Error(`Unknown NPC status ${change.status}`);
  if (!change.reason.trim()) throw new Error("NPC lifecycle changes require a reason");
  if (npc.status === "dead" && change.status !== "dead") {
    throw new Error("Dead NPCs require a future explicitly approved resurrection rule");
  }
  const lifecycleState: NpcLifecycleState = change.status === "dead" || change.status === "departed"
    ? "archived"
    : "current";
  const category: NpcCategory = lifecycleState === "archived" ? "background" : npc.category;
  const locationId = lifecycleState === "archived" || change.status === "missing"
    ? null
    : (change.locationId === undefined ? npc.locationId : change.locationId);
  if (npc.status === change.status && npc.lifecycleState === lifecycleState && npc.locationId === locationId) return npc;

  const now = new Date().toISOString();
  const ownsTransaction = !db.isTransaction;
  if (ownsTransaction) db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`UPDATE npc_records SET status = ?, lifecycle_state = ?, category = ?,
      location_id = ?, last_relevant_turn = ?, updated_at = ?
      WHERE campaign_id = ? AND npc_id = ?`)
      .run(change.status, lifecycleState, category, locationId, change.turn, now, change.campaignId, change.npcId);
    db.prepare(`INSERT INTO npc_lifecycle_history(
      campaign_id, npc_id, previous_status, new_status, previous_lifecycle_state,
      new_lifecycle_state, reason, turn, created_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        change.campaignId,
        change.npcId,
        npc.status,
        change.status,
        npc.lifecycleState,
        lifecycleState,
        change.reason.trim(),
        change.turn,
        now
      );
    if (npc.category !== category) {
      db.prepare(`INSERT INTO npc_category_history(
        campaign_id, npc_id, turn, previous_category, new_category, reason, created_at
      ) VALUES(?, ?, ?, ?, ?, ?, ?)`)
        .run(change.campaignId, change.npcId, change.turn, npc.category, category, "NPC archived by lifecycle change", now);
    }
    appendEvent(db, change.campaignId, change.turn, "npc_lifecycle_changed", {
      npcId: change.npcId,
      previousStatus: npc.status,
      newStatus: change.status,
      lifecycleState,
      reason: change.reason.trim()
    });
    if (ownsTransaction) db.exec("COMMIT");
  } catch (error) {
    if (ownsTransaction) db.exec("ROLLBACK");
    throw error;
  }
  return getNpc(db, change.campaignId, change.npcId)!;
}

export function persistWorldFact(
  db: DatabaseSync,
  fact: {
    campaignId: string;
    factId: string;
    statement: string;
    truthStatus: FactTruthStatus;
    visibility: FactVisibility;
    establishedTurn: number;
  }
): void {
  if (!fact.statement.trim()) throw new Error("World facts require a statement");
  db.prepare(`INSERT INTO world_facts(
      campaign_id, fact_id, statement, truth_status, visibility, established_turn
    ) VALUES(?, ?, ?, ?, ?, ?)`)
    .run(
      fact.campaignId,
      fact.factId,
      fact.statement.trim(),
      fact.truthStatus,
      fact.visibility,
      fact.establishedTurn
    );
}

export function getWorldFact(db: DatabaseSync, campaignId: string, factId: string): WorldFact | undefined {
  return db.prepare(`SELECT campaign_id AS campaignId, fact_id AS factId, statement,
      truth_status AS truthStatus, visibility, established_turn AS establishedTurn
    FROM world_facts WHERE campaign_id = ? AND fact_id = ?`)
    .get(campaignId, factId) as WorldFact | undefined;
}

export function listPublicWorldFacts(db: DatabaseSync, campaignId: string): WorldFact[] {
  return db.prepare(`SELECT campaign_id AS campaignId, fact_id AS factId, statement,
      truth_status AS truthStatus, visibility, established_turn AS establishedTurn
    FROM world_facts WHERE campaign_id = ? AND visibility = 'public'
    ORDER BY established_turn DESC, fact_id`)
    .all(campaignId) as WorldFact[];
}

export function teachNpcFact(
  db: DatabaseSync,
  knowledge: {
    campaignId: string;
    npcId: string;
    factId: string;
    method: KnowledgeMethod;
    confidence: number;
    believedState: BelievedState;
    sourceNpcId?: string | null;
    learnedTurn: number;
  }
): void {
  if (!Number.isInteger(knowledge.confidence) || knowledge.confidence < 0 || knowledge.confidence > 100) {
    throw new Error("NPC knowledge confidence must be an integer from 0 to 100");
  }
  if (!getNpc(db, knowledge.campaignId, knowledge.npcId)) {
    throw new Error(`NPC ${knowledge.npcId} does not exist in campaign ${knowledge.campaignId}`);
  }
  if (!getWorldFact(db, knowledge.campaignId, knowledge.factId)) {
    throw new Error(`World fact ${knowledge.factId} does not exist in campaign ${knowledge.campaignId}`);
  }
  db.prepare(`INSERT INTO npc_knowledge(
      campaign_id, npc_id, fact_id, method, confidence, believed_state,
      source_npc_id, learned_turn, last_updated_turn
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(campaign_id, npc_id, fact_id) DO UPDATE SET
      method = excluded.method,
      confidence = excluded.confidence,
      believed_state = excluded.believed_state,
      source_npc_id = excluded.source_npc_id,
      last_updated_turn = excluded.last_updated_turn`)
    .run(
      knowledge.campaignId,
      knowledge.npcId,
      knowledge.factId,
      knowledge.method,
      knowledge.confidence,
      knowledge.believedState,
      knowledge.sourceNpcId ?? null,
      knowledge.learnedTurn,
      knowledge.learnedTurn
    );
  appendEvent(db, knowledge.campaignId, knowledge.learnedTurn, "npc_learned_fact", {
    npcId: knowledge.npcId,
    factId: knowledge.factId,
    method: knowledge.method
  });
}

export function getNpcKnowledge(
  db: DatabaseSync,
  campaignId: string,
  npcId: string,
  factId: string
): NpcKnowledge | undefined {
  return db.prepare(`SELECT campaign_id AS campaignId, npc_id AS npcId, fact_id AS factId,
      method, confidence, believed_state AS believedState, source_npc_id AS sourceNpcId,
      learned_turn AS learnedTurn, last_updated_turn AS lastUpdatedTurn
    FROM npc_knowledge WHERE campaign_id = ? AND npc_id = ? AND fact_id = ?`)
    .get(campaignId, npcId, factId) as NpcKnowledge | undefined;
}

export function listNpcKnowledgeForContext(db: DatabaseSync, campaignId: string, npcId: string): NpcKnowledgeView[] {
  return db.prepare(`SELECT k.fact_id AS factId, f.statement, k.method, k.confidence,
      k.believed_state AS believedState, k.source_npc_id AS sourceNpcId,
      k.learned_turn AS learnedTurn, k.last_updated_turn AS lastUpdatedTurn
    FROM npc_knowledge k
    JOIN world_facts f ON f.campaign_id = k.campaign_id AND f.fact_id = k.fact_id
    WHERE k.campaign_id = ? AND k.npc_id = ?
    ORDER BY k.confidence DESC, k.last_updated_turn DESC, k.fact_id`)
    .all(campaignId, npcId) as NpcKnowledgeView[];
}

export function recordNpcMemory(
  db: DatabaseSync,
  memory: {
    campaignId: string;
    npcId: string;
    memoryId: string;
    summary: string;
    emotionalImpact: string;
    importance: 1 | 2 | 3;
    unresolved: boolean;
    createdTurn: number;
  }
): void {
  const npc = getNpc(db, memory.campaignId, memory.npcId);
  if (!npc) throw new Error(`NPC ${memory.npcId} does not exist in campaign ${memory.campaignId}`);
  if (!memory.summary.trim()) throw new Error("NPC memories require a summary");
  db.prepare(`INSERT INTO npc_memories(
      campaign_id, npc_id, memory_id, summary, emotional_impact, importance,
      unresolved, created_turn, last_recalled_turn
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      memory.campaignId,
      memory.npcId,
      memory.memoryId,
      memory.summary.trim(),
      memory.emotionalImpact.trim(),
      memory.importance,
      memory.unresolved ? 1 : 0,
      memory.createdTurn,
      memory.createdTurn
    );
  appendEvent(db, memory.campaignId, memory.createdTurn, "npc_memory_recorded", {
    npcId: memory.npcId,
    memoryId: memory.memoryId,
    importance: memory.importance
  });
  if (npc.category === "background") {
    reclassifyNpc(db, memory.campaignId, memory.npcId, "known", memory.createdTurn, "NPC gained a meaningful personal memory");
  }
}

export function listRelevantNpcMemories(
  db: DatabaseSync,
  campaignId: string,
  npcId: string,
  limit = 5
): NpcMemory[] {
  return db.prepare(`SELECT campaign_id AS campaignId, npc_id AS npcId, memory_id AS memoryId,
      summary, emotional_impact AS emotionalImpact, importance, unresolved,
      created_turn AS createdTurn, last_recalled_turn AS lastRecalledTurn
    FROM npc_memories WHERE campaign_id = ? AND npc_id = ?
    ORDER BY unresolved DESC, importance DESC, last_recalled_turn DESC LIMIT ?`)
    .all(campaignId, npcId, limit)
    .map((row) => {
      const memory = row as Omit<NpcMemory, "unresolved"> & { unresolved: number };
      return { ...memory, unresolved: memory.unresolved === 1 };
    });
}

const RELATIONSHIP_QUALITIES = new Set<RelationshipQuality>([
  "trusted",
  "wary",
  "afraid",
  "indebted",
  "respectful",
  "attached"
]);

function assertRelationshipTarget(
  db: DatabaseSync,
  campaignId: string,
  targetType: RelationshipTargetType,
  targetId: string
): void {
  if (targetType === "player") {
    if (targetId !== "player") throw new Error("The V1 player relationship target ID must be 'player'");
    return;
  }
  if (targetType === "npc") {
    if (!getNpc(db, campaignId, targetId)) throw new Error(`Target NPC ${targetId} does not exist`);
    return;
  }
  const faction = db.prepare("SELECT 1 AS present FROM faction_state WHERE campaign_id = ? AND faction_id = ?")
    .get(campaignId, targetId) as { present: number } | undefined;
  if (!faction) throw new Error(`Target faction ${targetId} does not exist`);
}

export function getNpcRelationship(
  db: DatabaseSync,
  campaignId: string,
  sourceNpcId: string,
  targetType: RelationshipTargetType,
  targetId: string
): NpcRelationship | undefined {
  const row = db.prepare(`SELECT campaign_id AS campaignId, source_npc_id AS sourceNpcId,
      target_type AS targetType, target_id AS targetId, standing, updated_turn AS updatedTurn
    FROM npc_relationships
    WHERE campaign_id = ? AND source_npc_id = ? AND target_type = ? AND target_id = ?`)
    .get(campaignId, sourceNpcId, targetType, targetId) as Omit<NpcRelationship, "qualities"> | undefined;
  if (!row) return undefined;
  const qualities = db.prepare(`SELECT quality FROM npc_relationship_qualities
      WHERE campaign_id = ? AND source_npc_id = ? AND target_type = ? AND target_id = ?
      ORDER BY quality`)
    .all(campaignId, sourceNpcId, targetType, targetId) as Array<{ quality: RelationshipQuality }>;
  return { ...row, qualities: qualities.map((entry) => entry.quality) };
}

export function listNpcRelationships(db: DatabaseSync, campaignId: string, sourceNpcId: string): NpcRelationship[] {
  const rows = db.prepare(`SELECT campaign_id AS campaignId, source_npc_id AS sourceNpcId,
      target_type AS targetType, target_id AS targetId, standing, updated_turn AS updatedTurn
    FROM npc_relationships WHERE campaign_id = ? AND source_npc_id = ?
    ORDER BY updated_turn DESC, target_type, target_id`)
    .all(campaignId, sourceNpcId) as Array<Omit<NpcRelationship, "qualities">>;
  return rows.map((row) => getNpcRelationship(
    db,
    row.campaignId,
    row.sourceNpcId,
    row.targetType,
    row.targetId
  )!);
}

export function updateNpcRelationship(
  db: DatabaseSync,
  change: {
    campaignId: string;
    sourceNpcId: string;
    targetType: RelationshipTargetType;
    targetId: string;
    standing: RelationshipStanding;
    addQualities?: RelationshipQuality[];
    removeQualities?: RelationshipQuality[];
    reason: string;
    turn: number;
  }
): NpcRelationship {
  if (!getNpc(db, change.campaignId, change.sourceNpcId)) {
    throw new Error(`Source NPC ${change.sourceNpcId} does not exist`);
  }
  assertRelationshipTarget(db, change.campaignId, change.targetType, change.targetId);
  if (!change.reason.trim()) throw new Error("Relationship changes require a reason");
  const added = [...new Set(change.addQualities ?? [])];
  const removed = [...new Set(change.removeQualities ?? [])].filter((quality) => !added.includes(quality));
  for (const quality of [...added, ...removed]) {
    if (!RELATIONSHIP_QUALITIES.has(quality)) throw new Error(`Unknown relationship quality ${quality}`);
  }
  const previous = getNpcRelationship(
    db,
    change.campaignId,
    change.sourceNpcId,
    change.targetType,
    change.targetId
  );
  const now = new Date().toISOString();
  const ownsTransaction = !db.isTransaction;
  if (ownsTransaction) db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`INSERT INTO npc_relationships(
        campaign_id, source_npc_id, target_type, target_id, standing, updated_turn
      ) VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(campaign_id, source_npc_id, target_type, target_id) DO UPDATE SET
        standing = excluded.standing, updated_turn = excluded.updated_turn`)
      .run(
        change.campaignId,
        change.sourceNpcId,
        change.targetType,
        change.targetId,
        change.standing,
        change.turn
      );
    const insertQuality = db.prepare(`INSERT OR IGNORE INTO npc_relationship_qualities(
      campaign_id, source_npc_id, target_type, target_id, quality
    ) VALUES(?, ?, ?, ?, ?)`);
    for (const quality of added) {
      insertQuality.run(change.campaignId, change.sourceNpcId, change.targetType, change.targetId, quality);
    }
    const deleteQuality = db.prepare(`DELETE FROM npc_relationship_qualities
      WHERE campaign_id = ? AND source_npc_id = ? AND target_type = ? AND target_id = ? AND quality = ?`);
    for (const quality of removed) {
      deleteQuality.run(change.campaignId, change.sourceNpcId, change.targetType, change.targetId, quality);
    }
    db.prepare(`INSERT INTO npc_relationship_history(
      campaign_id, source_npc_id, target_type, target_id, previous_standing, new_standing,
      added_qualities_json, removed_qualities_json, reason, turn, created_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        change.campaignId,
        change.sourceNpcId,
        change.targetType,
        change.targetId,
        previous?.standing ?? null,
        change.standing,
        JSON.stringify(added),
        JSON.stringify(removed),
        change.reason.trim(),
        change.turn,
        now
      );
    appendEvent(db, change.campaignId, change.turn, "npc_relationship_changed", {
      sourceNpcId: change.sourceNpcId,
      targetType: change.targetType,
      targetId: change.targetId,
      standing: change.standing,
      reason: change.reason.trim()
    });
    if (ownsTransaction) db.exec("COMMIT");
  } catch (error) {
    if (ownsTransaction) db.exec("ROLLBACK");
    throw error;
  }
  return getNpcRelationship(db, change.campaignId, change.sourceNpcId, change.targetType, change.targetId)!;
}

export function listNpcDesignProfiles(db: DatabaseSync, campaignId: string): NpcDesignProfile[] {
  const rows = db.prepare(`SELECT campaign_id AS campaignId, npc_id AS npcId, desire,
      complication, change_lever AS changeLever, voice_cues_json AS voiceCuesJson,
      applied_lesson_ids_json AS appliedLessonIdsJson, fingerprint,
      generated_turn AS generatedTurn
    FROM npc_design_profiles WHERE campaign_id = ? ORDER BY generated_turn, npc_id`)
    .all(campaignId) as Array<Omit<NpcDesignProfile, "voiceCues" | "appliedLessonIds"> & {
      voiceCuesJson: string;
      appliedLessonIdsJson: string;
    }>;
  return rows.map(({ voiceCuesJson, appliedLessonIdsJson, ...row }) => ({
    ...row,
    voiceCues: JSON.parse(voiceCuesJson) as string[],
    appliedLessonIds: JSON.parse(appliedLessonIdsJson) as string[]
  }));
}

export function getNpcDesignProfile(db: DatabaseSync, campaignId: string, npcId: string): NpcDesignProfile | undefined {
  return listNpcDesignProfiles(db, campaignId).find((profile) => profile.npcId === npcId);
}

export function persistGeneratedNpc(
  db: DatabaseSync,
  npc: Parameters<typeof persistNpc>[1],
  design: Omit<NpcDesignProfile, "campaignId" | "npcId">
): void {
  if (npc.origin !== "generated") throw new Error("Generated NPC persistence requires generated origin");
  const duplicate = db.prepare("SELECT npc_id AS npcId FROM npc_novelty_ledger WHERE campaign_id = ? AND fingerprint = ?")
    .get(npc.campaignId, design.fingerprint) as { npcId: string } | undefined;
  if (duplicate) throw new Error(`NPC design fingerprint already belongs to ${duplicate.npcId}`);
  const ownsTransaction = !db.isTransaction;
  if (ownsTransaction) db.exec("BEGIN IMMEDIATE");
  try {
    persistNpc(db, npc);
    db.prepare(`INSERT INTO npc_design_profiles(
      campaign_id, npc_id, desire, complication, change_lever, voice_cues_json,
      applied_lesson_ids_json, fingerprint, generated_turn
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        npc.campaignId,
        npc.npcId,
        design.desire,
        design.complication,
        design.changeLever,
        JSON.stringify(design.voiceCues),
        JSON.stringify(design.appliedLessonIds),
        design.fingerprint,
        design.generatedTurn
      );
    db.prepare("INSERT INTO npc_novelty_ledger(campaign_id, fingerprint, npc_id, created_turn) VALUES(?, ?, ?, ?)")
      .run(npc.campaignId, design.fingerprint, npc.npcId, design.generatedTurn);
    appendEvent(db, npc.campaignId, design.generatedTurn, "npc_generated", {
      npcId: npc.npcId,
      role: npc.role,
      factionId: npc.factionId,
      locationId: npc.locationId
    });
    if (ownsTransaction) db.exec("COMMIT");
  } catch (error) {
    if (ownsTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

export function createCampaign(db: DatabaseSync, content: VelmoraContent, name: string, seed: string): string {
  const id = `SAVE-${name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`;
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`INSERT INTO campaigns(id, name, seed, stage, turn, stage_entered_turn, current_location_id, created_at, updated_at)
      VALUES(?, ?, ?, ?, 0, 0, ?, ?, ?)`)
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
    const blueprint = generateCampaignBlueprint(content, id, seed);
    persistCampaignBlueprint(db, blueprint);
    for (const thread of createInitialBlueprintThreads(blueprint)) persistStoryThread(db, thread);
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
  return db.prepare("SELECT id, name, seed, stage, turn, stage_entered_turn AS stageEnteredTurn, current_location_id AS currentLocationId FROM campaigns WHERE name = ?")
    .get(name) as CampaignRow | undefined;
}

export function backfillAuthoredState(db: DatabaseSync, content: VelmoraContent): void {
  const updateLocation = db.prepare(`UPDATE character_state SET location_id = ?
    WHERE character_id = ? AND (location_id IS NULL OR location_id = '')`);
  for (const character of content.characters) updateLocation.run(character.initialLocationId, character.id);
  const insertFactionPath = db.prepare("INSERT OR IGNORE INTO faction_path_state(campaign_id, faction_id, progress) SELECT id, ?, 0 FROM campaigns");
  for (const faction of content.factions) insertFactionPath.run(faction.id);
  const campaigns = db.prepare("SELECT id, seed FROM campaigns").all() as Array<{ id: string; seed: string }>;
  for (const campaign of campaigns) {
    if (!getCampaignBlueprint(db, campaign.id)) {
      const blueprint = generateCampaignBlueprint(content, campaign.id, campaign.seed);
      persistCampaignBlueprint(db, blueprint);
      for (const thread of createInitialBlueprintThreads(blueprint)) persistStoryThread(db, thread);
    }
  }
}

export function captureSnapshot(db: DatabaseSync, campaignId: string): StateSnapshot {
  const campaign = db.prepare("SELECT id, name, seed, stage, turn, stage_entered_turn AS stageEnteredTurn, current_location_id AS currentLocationId FROM campaigns WHERE id = ?")
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
  const quests = listQuestInstances(db, campaignId);
  const records = db.prepare(`SELECT campaign_id AS campaignId, npc_id AS npcId, name, category, origin,
      faction_id AS factionId, location_id AS locationId, role, status,
      lifecycle_state AS lifecycleState, created_turn AS createdTurn,
      last_relevant_turn AS lastRelevantTurn
    FROM npc_records WHERE campaign_id = ? ORDER BY npc_id`)
    .all(campaignId) as NpcRecord[];
  const designs = listNpcDesignProfiles(db, campaignId);
  const facts = db.prepare(`SELECT campaign_id AS campaignId, fact_id AS factId, statement,
      truth_status AS truthStatus, visibility, established_turn AS establishedTurn
    FROM world_facts WHERE campaign_id = ? ORDER BY fact_id`)
    .all(campaignId) as WorldFact[];
  const knowledge = db.prepare(`SELECT campaign_id AS campaignId, npc_id AS npcId, fact_id AS factId,
      method, confidence, believed_state AS believedState, source_npc_id AS sourceNpcId,
      learned_turn AS learnedTurn, last_updated_turn AS lastUpdatedTurn
    FROM npc_knowledge WHERE campaign_id = ? ORDER BY npc_id, fact_id`)
    .all(campaignId) as NpcKnowledge[];
  const memoryRows = db.prepare(`SELECT campaign_id AS campaignId, npc_id AS npcId, memory_id AS memoryId,
      summary, emotional_impact AS emotionalImpact, importance, unresolved,
      created_turn AS createdTurn, last_recalled_turn AS lastRecalledTurn
    FROM npc_memories WHERE campaign_id = ? ORDER BY npc_id, memory_id`)
    .all(campaignId) as Array<Omit<NpcMemory, "unresolved"> & { unresolved: number }>;
  const memories = memoryRows.map((memory) => ({ ...memory, unresolved: memory.unresolved === 1 }));
  const relationships = records.flatMap((npc) => listNpcRelationships(db, campaignId, npc.npcId));
  const novelty = db.prepare(`SELECT fingerprint, npc_id AS npcId, created_turn AS createdTurn
    FROM npc_novelty_ledger WHERE campaign_id = ? ORDER BY fingerprint`)
    .all(campaignId) as Array<{ fingerprint: string; npcId: string; createdTurn: number }>;
  const storyThreads = listStoryThreads(db, campaignId);
  const playerCharacter = getPlayerCharacter(db, campaignId) ?? null;
  const playerPowers = listPlayerPowers(db, campaignId);
  const playerInventory = listPlayerInventory(db, campaignId);
  const progression = playerCharacter
    ? {
        state: getPlayerProgression(db, campaignId),
        milestones: listProgressionMilestones(db, campaignId),
        advancements: listCharacterAdvancements(db, campaignId)
      }
    : undefined;
  return {
    campaign,
    factions,
    characters,
    factionPaths,
    quests,
    npcState: { records, designs, facts, knowledge, memories, relationships, novelty },
    storyThreads,
    playerCharacter,
    playerPowers,
    playerInventory,
    progression
  };
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
    db.prepare("UPDATE campaigns SET stage = ?, turn = ?, stage_entered_turn = ?, current_location_id = ?, updated_at = ? WHERE id = ?")
      .run(
        snapshot.campaign.stage,
        snapshot.campaign.turn,
        snapshot.campaign.stageEnteredTurn ?? snapshot.campaign.turn,
        snapshot.campaign.currentLocationId,
        new Date().toISOString(),
        campaign.id
      );
    const updateFaction = db.prepare("UPDATE faction_state SET condition = ? WHERE campaign_id = ? AND faction_id = ?");
    for (const faction of snapshot.factions) updateFaction.run(faction.condition, campaign.id, faction.factionId);
    const updateCharacter = db.prepare(`UPDATE character_state SET status = ?, reputation = ?, location_id = ?, replacement_character_id = ?
      WHERE campaign_id = ? AND character_id = ?`);
    for (const character of snapshot.characters) {
      updateCharacter.run(character.status, character.reputation, character.locationId, character.replacementCharacterId, campaign.id, character.characterId);
    }
    const updateFactionPath = db.prepare("UPDATE faction_path_state SET progress = ? WHERE campaign_id = ? AND faction_id = ?");
    for (const path of snapshot.factionPaths ?? []) updateFactionPath.run(path.progress, campaign.id, path.factionId);
    const snapshotQuests = snapshot.quests ?? [];
    if (snapshotQuests.every((quest) => "campaignId" in quest)) {
      db.prepare("DELETE FROM quest_instances WHERE campaign_id = ?").run(campaign.id);
      for (const quest of snapshotQuests) persistQuestInstance(db, quest as QuestInstance);
    } else {
      const updateQuest = db.prepare("UPDATE quest_instances SET state = ? WHERE campaign_id = ? AND quest_id = ?");
      for (const quest of snapshotQuests) updateQuest.run(quest.state, campaign.id, quest.questId);
    }
    db.prepare("DELETE FROM story_threads WHERE campaign_id = ?").run(campaign.id);
    for (const thread of snapshot.storyThreads ?? []) persistStoryThread(db, thread);
    if (snapshot.playerCharacter !== undefined) {
      if (snapshot.playerCharacter === null) {
        db.prepare("DELETE FROM player_characters WHERE campaign_id = ?").run(campaign.id);
      } else {
        persistPlayerCharacter(db, snapshot.playerCharacter);
      }
    }
    if (snapshot.playerPowers !== undefined) {
      db.prepare("DELETE FROM player_powers WHERE campaign_id = ?").run(campaign.id);
      for (const power of snapshot.playerPowers) persistPlayerPower(db, power);
    }
    if (snapshot.playerInventory !== undefined) {
      db.prepare("DELETE FROM player_inventory WHERE campaign_id = ?").run(campaign.id);
      for (const item of snapshot.playerInventory) persistPlayerInventoryItem(db, item);
    }
    if (snapshot.progression !== undefined) {
      db.prepare("DELETE FROM character_advancements WHERE campaign_id = ?").run(campaign.id);
      db.prepare("DELETE FROM progression_milestones WHERE campaign_id = ?").run(campaign.id);
      db.prepare("DELETE FROM player_progression WHERE campaign_id = ?").run(campaign.id);
      persistPlayerProgression(db, snapshot.progression.state);
      for (const milestone of snapshot.progression.milestones) persistProgressionMilestone(db, milestone);
      for (const advancement of snapshot.progression.advancements) persistCharacterAdvancement(db, advancement);
    }
    if (snapshot.npcState) {
      db.prepare("DELETE FROM npc_relationship_qualities WHERE campaign_id = ?").run(campaign.id);
      db.prepare("DELETE FROM npc_relationships WHERE campaign_id = ?").run(campaign.id);
      db.prepare("DELETE FROM npc_knowledge WHERE campaign_id = ?").run(campaign.id);
      db.prepare("DELETE FROM npc_memories WHERE campaign_id = ?").run(campaign.id);
      db.prepare("DELETE FROM npc_novelty_ledger WHERE campaign_id = ?").run(campaign.id);
      db.prepare("DELETE FROM npc_design_profiles WHERE campaign_id = ?").run(campaign.id);

      const snapshotNpcIds = new Set(snapshot.npcState.records.map((npc) => npc.npcId));
      const currentNpcIds = db.prepare("SELECT npc_id AS npcId FROM npc_records WHERE campaign_id = ?")
        .all(campaign.id) as Array<{ npcId: string }>;
      const deleteNpc = db.prepare("DELETE FROM npc_records WHERE campaign_id = ? AND npc_id = ?");
      for (const current of currentNpcIds) {
        if (!snapshotNpcIds.has(current.npcId)) deleteNpc.run(campaign.id, current.npcId);
      }

      const restoreNpc = db.prepare(`INSERT INTO npc_records(
          campaign_id, npc_id, name, category, origin, faction_id, location_id, role,
          status, lifecycle_state, created_turn, last_relevant_turn, updated_at
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(campaign_id, npc_id) DO UPDATE SET
          name = excluded.name, category = excluded.category, origin = excluded.origin,
          faction_id = excluded.faction_id, location_id = excluded.location_id, role = excluded.role,
          status = excluded.status, lifecycle_state = excluded.lifecycle_state,
          created_turn = excluded.created_turn, last_relevant_turn = excluded.last_relevant_turn,
          updated_at = excluded.updated_at`);
      for (const npc of snapshot.npcState.records) {
        restoreNpc.run(
          campaign.id,
          npc.npcId,
          npc.name,
          npc.category,
          npc.origin,
          npc.factionId,
          npc.locationId,
          npc.role,
          npc.status,
          npc.lifecycleState,
          npc.createdTurn,
          npc.lastRelevantTurn,
          new Date().toISOString()
        );
      }

      db.prepare("DELETE FROM world_facts WHERE campaign_id = ?").run(campaign.id);
      const restoreFact = db.prepare(`INSERT INTO world_facts(
        campaign_id, fact_id, statement, truth_status, visibility, established_turn
      ) VALUES(?, ?, ?, ?, ?, ?)`);
      for (const fact of snapshot.npcState.facts) {
        restoreFact.run(campaign.id, fact.factId, fact.statement, fact.truthStatus, fact.visibility, fact.establishedTurn);
      }

      const restoreDesign = db.prepare(`INSERT INTO npc_design_profiles(
        campaign_id, npc_id, desire, complication, change_lever, voice_cues_json,
        applied_lesson_ids_json, fingerprint, generated_turn
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const design of snapshot.npcState.designs) {
        restoreDesign.run(
          campaign.id,
          design.npcId,
          design.desire,
          design.complication,
          design.changeLever,
          JSON.stringify(design.voiceCues),
          JSON.stringify(design.appliedLessonIds),
          design.fingerprint,
          design.generatedTurn
        );
      }
      const restoreNovelty = db.prepare(`INSERT INTO npc_novelty_ledger(
        campaign_id, fingerprint, npc_id, created_turn
      ) VALUES(?, ?, ?, ?)`);
      for (const novelty of snapshot.npcState.novelty) {
        restoreNovelty.run(campaign.id, novelty.fingerprint, novelty.npcId, novelty.createdTurn);
      }
      const restoreKnowledge = db.prepare(`INSERT INTO npc_knowledge(
        campaign_id, npc_id, fact_id, method, confidence, believed_state,
        source_npc_id, learned_turn, last_updated_turn
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const knowledge of snapshot.npcState.knowledge) {
        restoreKnowledge.run(
          campaign.id,
          knowledge.npcId,
          knowledge.factId,
          knowledge.method,
          knowledge.confidence,
          knowledge.believedState,
          knowledge.sourceNpcId,
          knowledge.learnedTurn,
          knowledge.lastUpdatedTurn
        );
      }
      const restoreMemory = db.prepare(`INSERT INTO npc_memories(
        campaign_id, npc_id, memory_id, summary, emotional_impact, importance,
        unresolved, created_turn, last_recalled_turn
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const memory of snapshot.npcState.memories) {
        restoreMemory.run(
          campaign.id,
          memory.npcId,
          memory.memoryId,
          memory.summary,
          memory.emotionalImpact,
          memory.importance,
          memory.unresolved ? 1 : 0,
          memory.createdTurn,
          memory.lastRecalledTurn
        );
      }
      const restoreRelationship = db.prepare(`INSERT INTO npc_relationships(
        campaign_id, source_npc_id, target_type, target_id, standing, updated_turn
      ) VALUES(?, ?, ?, ?, ?, ?)`);
      const restoreQuality = db.prepare(`INSERT INTO npc_relationship_qualities(
        campaign_id, source_npc_id, target_type, target_id, quality
      ) VALUES(?, ?, ?, ?, ?)`);
      for (const relationship of snapshot.npcState.relationships) {
        restoreRelationship.run(
          campaign.id,
          relationship.sourceNpcId,
          relationship.targetType,
          relationship.targetId,
          relationship.standing,
          relationship.updatedTurn
        );
        for (const quality of relationship.qualities) {
          restoreQuality.run(
            campaign.id,
            relationship.sourceNpcId,
            relationship.targetType,
            relationship.targetId,
            quality
          );
        }
      }
    }
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
