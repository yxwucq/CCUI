import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';

let db: Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  project_path TEXT NOT NULL,
  branch TEXT,
  worktree_path TEXT,
  agent_id TEXT,
  claude_session_id TEXT,
  status TEXT DEFAULT 'idle',
  created_at TEXT DEFAULT (datetime('now')),
  last_active_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  timestamp TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  system_prompt TEXT NOT NULL,
  allowed_tools TEXT DEFAULT '[]',
  max_turns INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_read INTEGER DEFAULT 0,
  cache_write INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  model TEXT DEFAULT '',
  timestamp TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
`;

export function initDB(projectPath: string): Database.Database {
  const dbDir = join(projectPath, '.ccui');
  mkdirSync(dbDir, { recursive: true });
  const dbPath = join(dbDir, 'data.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  // Migrate: add new columns if missing
  const cols = db.pragma('table_info(sessions)') as { name: string }[];
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has('name')) db.exec("ALTER TABLE sessions ADD COLUMN name TEXT DEFAULT ''");
  if (!colNames.has('branch')) db.exec('ALTER TABLE sessions ADD COLUMN branch TEXT');
  if (!colNames.has('worktree_path')) db.exec('ALTER TABLE sessions ADD COLUMN worktree_path TEXT');
  if (!colNames.has('claude_session_id')) db.exec('ALTER TABLE sessions ADD COLUMN claude_session_id TEXT');
  if (!colNames.has('skip_permissions')) db.exec('ALTER TABLE sessions ADD COLUMN skip_permissions INTEGER DEFAULT 0');
  if (!colNames.has('notes')) db.exec("ALTER TABLE sessions ADD COLUMN notes TEXT DEFAULT ''");
  if (!colNames.has('target_branch')) db.exec('ALTER TABLE sessions ADD COLUMN target_branch TEXT');
  if (!colNames.has('cleanup_status')) db.exec('ALTER TABLE sessions ADD COLUMN cleanup_status TEXT');
  if (!colNames.has('session_type')) db.exec("ALTER TABLE sessions ADD COLUMN session_type TEXT DEFAULT 'fork'");
  if (!colNames.has('worktree_owned')) db.exec('ALTER TABLE sessions ADD COLUMN worktree_owned INTEGER DEFAULT 1');

  return db;
}

export function getDB(): Database.Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}
