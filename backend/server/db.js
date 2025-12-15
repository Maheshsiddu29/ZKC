// backend/server/db.js
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// single SQLite file for ads
const DB_PATH = path.resolve(__dirname, "../ads.db");

const db = new Database(DB_PATH);

// optional 
db.pragma("journal_mode = WAL");

export default db;