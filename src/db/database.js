import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '../../data/melolo.db');

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

export default db;

