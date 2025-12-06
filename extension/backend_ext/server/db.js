import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "ad_engine.db");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    conditions_json TEXT NOT NULL, -- JSON: {"age18":true,"gaming":true}
    bid REAL NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    click_url TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );
`);

export default db;
