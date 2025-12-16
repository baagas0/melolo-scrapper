import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '../../data/melolo.db');

// Ensure data directory exists
const dataDir = join(__dirname, '../../data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Create series table
db.exec(`
  CREATE TABLE IF NOT EXISTS series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    melolo_series_id TEXT UNIQUE NOT NULL,
    cover_url TEXT,
    intro TEXT,
    title TEXT NOT NULL,
    episode_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create episodes table
db.exec(`
  CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id INTEGER NOT NULL,
    melolo_vid_id TEXT UNIQUE NOT NULL,
    cover TEXT,
    title TEXT,
    index_sequence INTEGER NOT NULL,
    duration INTEGER,
    path TEXT,
    video_height INTEGER,
    video_weight INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
    UNIQUE(series_id, index_sequence)
  )
`);

// Create indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_episodes_series_id ON episodes(series_id);
  CREATE INDEX IF NOT EXISTS idx_episodes_melolo_vid_id ON episodes(melolo_vid_id);
  CREATE INDEX IF NOT EXISTS idx_episodes_path ON episodes(path);
`);

console.log('Database migration completed successfully!');
db.close();

