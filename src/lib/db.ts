import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { AI_DRAFT_CARD_PROFILES, aiDraftByNumber } from "@/lib/card-profile-drafts";
import { readDefaultCardProfiles } from "@/lib/card-profile-seed";
import { todayKey } from "@/lib/dates";
import { isPublishableOption, type LenormandCard } from "@/lib/lenormand";
import {
  DEFAULT_OPTION_COUNT,
  type OptionKey,
  optionKeysForCount,
  normalizeOptionCount
} from "@/lib/options";

export type ReadingStatus = "draft" | "published";

export type DailyReading = {
  date: string;
  topic: string;
  status: ReadingStatus;
  option_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReadingOption = {
  id: number;
  reading_date: string;
  option_key: OptionKey;
  option_title: string;
  cards_json: string;
  ai_draft_json: string | null;
  final_text: string;
  indicator_text: string;
  indicator_style: string;
  image_filename: string | null;
  image_mime_type: string | null;
  image_alt: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReadingWithOptions = DailyReading & {
  options: ReadingOption[];
};

export type TopicSuggestion = {
  id: number;
  suggestion_date: string;
  suggestions_json: string;
  selected_topic: string | null;
  created_at: string;
};

export type KnowledgeEntry = {
  id: number;
  type: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type CardProfile = {
  card_number: number;
  card_name: string;
  review_status: string;
  polarity: string;
  core_meaning: string;
  person_image: string;
  work: string;
  love: string;
  health: string;
  money: string;
  timing: string;
  advice: string;
  objects_places: string;
  review_notes: string;
  quiz_prompt: string;
  quiz_answer: string;
  created_at: string;
  updated_at: string;
};

export type TopicRequest = {
  id: number;
  nickname: string;
  suggestion: string;
  created_at: string;
};

let db: DatabaseSync | null = null;

function dbPath() {
  const configuredPath = process.env.LENORMAND_DB_PATH;
  if (!configuredPath) {
    return join(/*turbopackIgnore: true*/ process.cwd(), "data", "lenormand.sqlite");
  }
  return isAbsolute(configuredPath)
    ? configuredPath
    : join(/*turbopackIgnore: true*/ process.cwd(), configuredPath);
}

export function getDb() {
  if (!db) {
    const path = dbPath();
    mkdirSync(dirname(path), { recursive: true });
    db = new DatabaseSync(path);
    db.exec("PRAGMA foreign_keys = ON;");
    migrate(db);
  }
  return db;
}

export function resetDbForTests() {
  if (db) {
    db.close();
    db = null;
  }
}

function migrate(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS daily_readings (
      date TEXT PRIMARY KEY,
      topic TEXT NOT NULL DEFAULT '',
      option_count INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reading_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reading_date TEXT NOT NULL,
      option_key TEXT NOT NULL CHECK (option_key IN ('A', 'B', 'C', 'D')),
      option_title TEXT NOT NULL DEFAULT '',
      cards_json TEXT NOT NULL DEFAULT '[]',
      ai_draft_json TEXT,
      final_text TEXT NOT NULL DEFAULT '',
      indicator_text TEXT NOT NULL DEFAULT '',
      indicator_style TEXT NOT NULL DEFAULT '',
      image_filename TEXT,
      image_mime_type TEXT,
      image_alt TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(reading_date, option_key),
      FOREIGN KEY(reading_date) REFERENCES daily_readings(date) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS topic_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      suggestion_date TEXT NOT NULL,
      suggestions_json TEXT NOT NULL,
      selected_topic TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS knowledge_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS card_profiles (
      card_number INTEGER PRIMARY KEY CHECK (card_number BETWEEN 1 AND 42),
      card_name TEXT NOT NULL,
      review_status TEXT NOT NULL DEFAULT '待校对',
      polarity TEXT NOT NULL DEFAULT '',
      core_meaning TEXT NOT NULL DEFAULT '',
      person_image TEXT NOT NULL DEFAULT '',
      work TEXT NOT NULL DEFAULT '',
      love TEXT NOT NULL DEFAULT '',
      health TEXT NOT NULL DEFAULT '',
      money TEXT NOT NULL DEFAULT '',
      timing TEXT NOT NULL DEFAULT '',
      advice TEXT NOT NULL DEFAULT '',
      objects_places TEXT NOT NULL DEFAULT '',
      review_notes TEXT NOT NULL DEFAULT '',
      quiz_prompt TEXT NOT NULL DEFAULT '',
      quiz_answer TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS topic_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT NOT NULL DEFAULT '匿名来访者',
      suggestion TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  ensureDailyReadingsColumns(database);
  ensureReadingOptionsSchema(database);
  seedCardProfiles(database);
  ensureUsableCardProfiles(database);
}

function tableColumns(database: DatabaseSync, tableName: string) {
  return rows<{ name: string }>(database.prepare(`PRAGMA table_info(${tableName})`).all()).map(
    (column) => column.name
  );
}

function hasColumn(database: DatabaseSync, tableName: string, columnName: string) {
  return tableColumns(database, tableName).includes(columnName);
}

function ensureDailyReadingsColumns(database: DatabaseSync) {
  if (!hasColumn(database, "daily_readings", "option_count")) {
    database.exec("ALTER TABLE daily_readings ADD COLUMN option_count INTEGER NOT NULL DEFAULT 3;");
  }
}

function ensureReadingOptionsSchema(database: DatabaseSync) {
  const table = row<{ sql: string }>(
    database
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'reading_options'")
      .get()
  );
  const columns = tableColumns(database, "reading_options");
  const needsRebuild =
    !table?.sql.includes("'D'") ||
    !columns.includes("image_filename") ||
    !columns.includes("image_mime_type") ||
    !columns.includes("image_alt") ||
    !columns.includes("indicator_text") ||
    !columns.includes("indicator_style") ||
    !columns.includes("reviewed_at");

  if (!needsRebuild) {
    return;
  }

  const imageFilenameSelect = columns.includes("image_filename") ? "image_filename" : "NULL";
  const imageMimeTypeSelect = columns.includes("image_mime_type") ? "image_mime_type" : "NULL";
  const imageAltSelect = columns.includes("image_alt") ? "image_alt" : "NULL";
  const indicatorTextSelect = columns.includes("indicator_text") ? "indicator_text" : "''";
  const indicatorStyleSelect = columns.includes("indicator_style") ? "indicator_style" : "''";
  const reviewedAtSelect = columns.includes("reviewed_at") ? "reviewed_at" : "NULL";

  database.exec(`
    PRAGMA foreign_keys = OFF;

    CREATE TABLE reading_options_next (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reading_date TEXT NOT NULL,
      option_key TEXT NOT NULL CHECK (option_key IN ('A', 'B', 'C', 'D')),
      option_title TEXT NOT NULL DEFAULT '',
      cards_json TEXT NOT NULL DEFAULT '[]',
      ai_draft_json TEXT,
      final_text TEXT NOT NULL DEFAULT '',
      indicator_text TEXT NOT NULL DEFAULT '',
      indicator_style TEXT NOT NULL DEFAULT '',
      image_filename TEXT,
      image_mime_type TEXT,
      image_alt TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(reading_date, option_key),
      FOREIGN KEY(reading_date) REFERENCES daily_readings(date) ON DELETE CASCADE
    );

    INSERT INTO reading_options_next (
      id,
      reading_date,
      option_key,
      option_title,
      cards_json,
      ai_draft_json,
      final_text,
      indicator_text,
      indicator_style,
      image_filename,
      image_mime_type,
      image_alt,
      reviewed_at,
      created_at,
      updated_at
    )
    SELECT
      id,
      reading_date,
      option_key,
      option_title,
      cards_json,
      ai_draft_json,
      final_text,
      ${indicatorTextSelect},
      ${indicatorStyleSelect},
      ${imageFilenameSelect},
      ${imageMimeTypeSelect},
      ${imageAltSelect},
      ${reviewedAtSelect},
      created_at,
      updated_at
    FROM reading_options
    WHERE option_key IN ('A', 'B', 'C', 'D');

    DROP TABLE reading_options;
    ALTER TABLE reading_options_next RENAME TO reading_options;
    PRAGMA foreign_keys = ON;
  `);
}

function row<T>(value: unknown) {
  return value as T | undefined;
}

function rows<T>(value: unknown[]) {
  return value as T[];
}

export function ensureReading(date = todayKey()): ReadingWithOptions {
  const database = getDb();
  database
    .prepare(
      "INSERT OR IGNORE INTO daily_readings (date, topic, option_count, status) VALUES (?, '', ?, 'draft')"
    )
    .run(date, DEFAULT_OPTION_COUNT);

  const readingRow = row<DailyReading>(
    database.prepare("SELECT * FROM daily_readings WHERE date = ?").get(date)
  );
  ensureOptionRows(database, date, normalizeOptionCount(readingRow?.option_count));

  const reading = getReading(date);
  if (!reading) {
    throw new Error("初始化每日占卜失败。");
  }
  return reading;
}

function ensureOptionRows(database: DatabaseSync, date: string, optionCount: number) {
  optionKeysForCount(optionCount).forEach((key) => {
    database
      .prepare(
        `INSERT OR IGNORE INTO reading_options
          (reading_date, option_key, option_title, cards_json, final_text)
          VALUES (?, ?, ?, '[]', '')`
      )
      .run(date, key, `${key} 组选项`);
  });
}

export function getReading(date: string) {
  const database = getDb();
  const reading = row<DailyReading>(
    database.prepare("SELECT * FROM daily_readings WHERE date = ?").get(date)
  );

  if (!reading) {
    return null;
  }

  const optionKeys = new Set(optionKeysForCount(reading.option_count));
  const options = rows<ReadingOption>(
    database
      .prepare("SELECT * FROM reading_options WHERE reading_date = ? ORDER BY option_key")
      .all(date)
  ).filter((option) => optionKeys.has(option.option_key));

  return { ...reading, options };
}

export function getPublishedReading(date = todayKey()) {
  const reading = getReading(date);
  if (!reading || reading.status !== "published") {
    return null;
  }
  return reading;
}

export function getPublishedArchive() {
  return rows<DailyReading>(
    getDb()
      .prepare(
        "SELECT * FROM daily_readings WHERE status = 'published' ORDER BY date DESC LIMIT 100"
      )
      .all()
  );
}

export function getLatestTopicSuggestion(date = todayKey()) {
  return row<TopicSuggestion>(
    getDb()
      .prepare(
        "SELECT * FROM topic_suggestions WHERE suggestion_date = ? ORDER BY id DESC LIMIT 1"
      )
      .get(date)
  );
}

export function saveTopicSuggestions(date: string, topics: string[]) {
  getDb()
    .prepare(
      "INSERT INTO topic_suggestions (suggestion_date, suggestions_json) VALUES (?, ?)"
    )
    .run(date, JSON.stringify(topics));
}

export function setReadingTopic(date: string, topic: string) {
  ensureReading(date);
  const database = getDb();
  database
    .prepare(
      "UPDATE daily_readings SET topic = ?, status = 'draft', published_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE date = ?"
    )
    .run(topic, date);
  database
    .prepare(
      "UPDATE topic_suggestions SET selected_topic = ? WHERE suggestion_date = ? AND id = (SELECT id FROM topic_suggestions WHERE suggestion_date = ? ORDER BY id DESC LIMIT 1)"
    )
    .run(topic, date, date);
  clearOptionDrafts(database, date);
}

export function setReadingOptionCount(date: string, optionCount: number) {
  ensureReading(date);
  const normalizedCount = normalizeOptionCount(optionCount);
  const database = getDb();
  const existing = row<DailyReading>(
    database.prepare("SELECT * FROM daily_readings WHERE date = ?").get(date)
  );
  const keepKeys = optionKeysForCount(normalizedCount);
  const placeholders = keepKeys.map(() => "?").join(", ");

  database
    .prepare(
      "UPDATE daily_readings SET option_count = ?, status = 'draft', published_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE date = ?"
    )
    .run(normalizedCount, date);
  ensureOptionRows(database, date, normalizedCount);
  if (normalizeOptionCount(existing?.option_count) !== normalizedCount) {
    clearOptionReviews(database, date);
  }

  const removedOptions = rows<{ image_filename: string | null }>(
    database
      .prepare(
        `SELECT image_filename FROM reading_options
         WHERE reading_date = ? AND option_key NOT IN (${placeholders})`
      )
      .all(date, ...keepKeys)
  );

  database
    .prepare(
      `DELETE FROM reading_options
       WHERE reading_date = ? AND option_key NOT IN (${placeholders})`
    )
    .run(date, ...keepKeys);

  return removedOptions.map((option) => option.image_filename).filter(Boolean) as string[];
}

function setReadingDraft(database: DatabaseSync, date: string) {
  database
    .prepare(
      "UPDATE daily_readings SET status = 'draft', published_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE date = ?"
    )
    .run(date);
}

function clearOptionReviews(database: DatabaseSync, date: string) {
  database
    .prepare("UPDATE reading_options SET reviewed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE reading_date = ?")
    .run(date);
}

function clearOptionDrafts(database: DatabaseSync, date: string) {
  database
    .prepare(
      `UPDATE reading_options
        SET indicator_text = '',
            indicator_style = '',
            ai_draft_json = NULL,
            final_text = '',
            reviewed_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE reading_date = ?`
    )
    .run(date);
}

export function updateReadingOption(params: {
  date: string;
  optionKey: OptionKey;
  optionTitle: string;
  cards: LenormandCard[];
  finalText: string;
  imageFilename?: string | null;
  imageMimeType?: string | null;
  imageAlt?: string | null;
}) {
  ensureReading(params.date);
  const existing = getReading(params.date)?.options.find(
    (option) => option.option_key === params.optionKey
  );
  const database = getDb();
  database
    .prepare(
      `UPDATE reading_options
        SET option_title = ?,
            cards_json = ?,
            final_text = ?,
            image_filename = ?,
            image_mime_type = ?,
            image_alt = ?,
            reviewed_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE reading_date = ? AND option_key = ?`
    )
    .run(
      params.optionTitle,
      JSON.stringify(params.cards),
      params.finalText,
      params.imageFilename === undefined ? existing?.image_filename ?? null : params.imageFilename,
      params.imageMimeType === undefined ? existing?.image_mime_type ?? null : params.imageMimeType,
      params.imageAlt === undefined ? existing?.image_alt ?? null : params.imageAlt,
      params.date,
      params.optionKey
    );
  setReadingDraft(database, params.date);
}

export function saveReadingIndicators(params: {
  date: string;
  style: string;
  indicators: Array<{ optionKey: OptionKey; text: string }>;
}) {
  const reading = ensureReading(params.date);
  const allowedKeys = new Set(reading.options.map((option) => option.option_key));
  const database = getDb();
  const update = database.prepare(
    `UPDATE reading_options
      SET indicator_text = ?,
          indicator_style = ?,
          ai_draft_json = NULL,
          final_text = '',
          reviewed_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE reading_date = ? AND option_key = ?`
  );

  params.indicators.forEach((indicator) => {
    const text = indicator.text.trim();
    if (!allowedKeys.has(indicator.optionKey) || !text) {
      return;
    }
    update.run(text, params.style, params.date, indicator.optionKey);
  });

  setReadingDraft(database, params.date);
}

export function saveOptionDraft(params: {
  date: string;
  optionKey: OptionKey;
  draftJson: string;
  finalText: string;
}) {
  const database = getDb();
  database
    .prepare(
      `UPDATE reading_options
        SET ai_draft_json = ?, final_text = ?, reviewed_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE reading_date = ? AND option_key = ?`
    )
    .run(params.draftJson, params.finalText, params.date, params.optionKey);
  setReadingDraft(database, params.date);
}

export function markReadingOptionReviewed(date: string, optionKey: OptionKey) {
  const reading = getReading(date);
  const option = reading?.options.find((item) => item.option_key === optionKey);
  if (!option) {
    throw new Error("找不到要审核的组选项。");
  }
  if (!isPublishableOption(option.cards_json, option.final_text)) {
    throw new Error("审核前请先补齐这一组的牌面和解析。");
  }

  getDb()
    .prepare(
      "UPDATE reading_options SET reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE reading_date = ? AND option_key = ?"
    )
    .run(date, optionKey);
}

export function publishReading(date: string) {
  const reading = getReading(date);
  if (!reading) {
    throw new Error("找不到当天占卜。");
  }
  if (!reading.topic.trim()) {
    throw new Error("发布前需要先选择今日主题。");
  }
  const missing = reading.options.filter(
    (option) => !isPublishableOption(option.cards_json, option.final_text)
  );
  if (missing.length > 0) {
    throw new Error(`发布前请补齐 ${missing.map((option) => option.option_key).join("/")} 组牌面和解析。`);
  }
  const unreviewed = reading.options.filter((option) => !option.reviewed_at);
  if (unreviewed.length > 0) {
    throw new Error(`发布前请先审核通过 ${unreviewed.map((option) => option.option_key).join("/")} 组解析。`);
  }

  getDb()
    .prepare(
      "UPDATE daily_readings SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE date = ?"
    )
    .run(date);
}

export function unpublishReading(date: string) {
  getDb()
    .prepare(
      "UPDATE daily_readings SET status = 'draft', published_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE date = ?"
    )
    .run(date);
}

export function listKnowledgeEntries() {
  return rows<KnowledgeEntry>(
    getDb()
      .prepare("SELECT * FROM knowledge_entries ORDER BY updated_at DESC, id DESC")
      .all()
  );
}

export function createKnowledgeEntry(params: { type: string; title: string; body: string }) {
  getDb()
    .prepare("INSERT INTO knowledge_entries (type, title, body) VALUES (?, ?, ?)")
    .run(params.type, params.title, params.body);
}

export function deleteKnowledgeEntry(id: number) {
  getDb().prepare("DELETE FROM knowledge_entries WHERE id = ?").run(id);
}

function seedCardProfiles(database: DatabaseSync) {
  const count = row<{ count: number }>(
    database.prepare("SELECT COUNT(*) AS count FROM card_profiles").get()
  )?.count;
  if (count && count > 0) {
    return;
  }

  const insert = database.prepare(
    `INSERT OR IGNORE INTO card_profiles (
      card_number,
      card_name,
      review_status,
      polarity,
      core_meaning,
      person_image,
      work,
      love,
      health,
      money,
      timing,
      advice,
      objects_places,
      review_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  readDefaultCardProfiles().forEach((profile) => {
    insert.run(
      profile.cardNumber,
      profile.cardName,
      profile.reviewStatus,
      profile.polarity,
      profile.coreMeaning,
      profile.personImage,
      profile.work,
      profile.love,
      profile.health,
      profile.money,
      profile.timing,
      profile.advice,
      profile.objectsPlaces,
      profile.reviewNotes
    );
  });
}

function cardProfileHasCoreFields(profile: CardProfile) {
  return [
    profile.polarity,
    profile.core_meaning,
    profile.person_image,
    profile.work,
    profile.love,
    profile.health,
    profile.money,
    profile.timing,
    profile.advice,
    profile.objects_places
  ].every((value) => value.trim().length > 0 && !value.includes("待补充"));
}

function appendUniqueNote(existingNote: string, nextNote: string) {
  return existingNote.includes(nextNote)
    ? existingNote
    : [existingNote, nextNote].filter(Boolean).join("\n");
}

function ensureUsableCardProfiles(database: DatabaseSync) {
  const insertMissing = database.prepare(
    `INSERT OR IGNORE INTO card_profiles (
      card_number,
      card_name,
      review_status,
      polarity,
      core_meaning,
      person_image,
      work,
      love,
      health,
      money,
      timing,
      advice,
      objects_places,
      review_notes
    ) VALUES (?, ?, 'AI草稿', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  AI_DRAFT_CARD_PROFILES.forEach((draft) => {
    insertMissing.run(
      draft.cardNumber,
      draft.cardName,
      draft.polarity,
      draft.coreMeaning,
      draft.personImage,
      draft.work,
      draft.love,
      draft.health,
      draft.money,
      draft.timing,
      draft.advice,
      draft.objectsPlaces,
      "AI草稿：为先上线可用而自动补齐，后续可人工校对。"
    );
  });

  const profiles = rows<CardProfile>(
    database.prepare("SELECT * FROM card_profiles ORDER BY card_number").all()
  );

  profiles.forEach((profile) => {
    if (profile.review_status === "已确认" || profile.review_status === "暂不使用") {
      return;
    }
    if (profile.review_status === "AI草稿" && cardProfileHasCoreFields(profile)) {
      return;
    }

    const draft = aiDraftByNumber(profile.card_number);
    if (!draft) {
      if (profile.review_status.includes("已确认")) {
        database
          .prepare(
            "UPDATE card_profiles SET review_status = '已确认', updated_at = CURRENT_TIMESTAMP WHERE card_number = ?"
          )
          .run(profile.card_number);
      }
      return;
    }

    database
      .prepare(
        `UPDATE card_profiles
          SET card_name = ?,
              review_status = 'AI草稿',
              polarity = ?,
              core_meaning = ?,
              person_image = ?,
              work = ?,
              love = ?,
              health = ?,
              money = ?,
              timing = ?,
              advice = ?,
              objects_places = ?,
              review_notes = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE card_number = ?`
      )
      .run(
        draft.cardName,
        draft.polarity,
        draft.coreMeaning,
        draft.personImage,
        draft.work,
        draft.love,
        draft.health,
        draft.money,
        draft.timing,
        draft.advice,
        draft.objectsPlaces,
        appendUniqueNote(profile.review_notes, "AI草稿：为先上线可用而自动补齐，后续可人工校对。"),
        profile.card_number
      );
  });
}

export function listCardProfiles() {
  return rows<CardProfile>(
    getDb().prepare("SELECT * FROM card_profiles ORDER BY card_number").all()
  );
}

export function updateCardProfile(params: {
  cardNumber: number;
  cardName: string;
  reviewStatus: string;
  polarity: string;
  coreMeaning: string;
  personImage: string;
  work: string;
  love: string;
  health: string;
  money: string;
  timing: string;
  advice: string;
  objectsPlaces: string;
  reviewNotes: string;
  quizPrompt: string;
  quizAnswer: string;
}) {
  getDb()
    .prepare(
      `UPDATE card_profiles
        SET card_name = ?,
            review_status = ?,
            polarity = ?,
            core_meaning = ?,
            person_image = ?,
            work = ?,
            love = ?,
            health = ?,
            money = ?,
            timing = ?,
            advice = ?,
            objects_places = ?,
            review_notes = ?,
            quiz_prompt = ?,
            quiz_answer = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE card_number = ?`
    )
    .run(
      params.cardName,
      params.reviewStatus,
      params.polarity,
      params.coreMeaning,
      params.personImage,
      params.work,
      params.love,
      params.health,
      params.money,
      params.timing,
      params.advice,
      params.objectsPlaces,
      params.reviewNotes,
      params.quizPrompt,
      params.quizAnswer,
      params.cardNumber
    );
}

export function createTopicRequest(params: { nickname: string; suggestion: string }) {
  const nickname = params.nickname.trim() || "匿名来访者";
  getDb()
    .prepare("INSERT INTO topic_requests (nickname, suggestion) VALUES (?, ?)")
    .run(nickname.slice(0, 24), params.suggestion.trim().slice(0, 240));
}

export function listTopicRequests(limit = 30) {
  return rows<TopicRequest>(
    getDb()
      .prepare("SELECT * FROM topic_requests ORDER BY created_at DESC, id DESC LIMIT ?")
      .all(limit)
  );
}
