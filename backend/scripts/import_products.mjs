// backend/scripts/import_products.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQLite DB path (must match backend/server/db.js)
const DB_PATH = path.resolve(__dirname, "../ads.db");
// JSON data path
const DATA_PATH = path.resolve(__dirname, "../data/transformed_products.json");

console.log("Using DB:", DB_PATH);
console.log("Loading JSON from:", DATA_PATH);

const raw = fs.readFileSync(DATA_PATH, "utf8");
const products = JSON.parse(raw);

const db = new Database(DB_PATH);

// Create campaigns table if it doesn't exist yet
db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    title TEXT,
    image_url TEXT,
    click_url TEXT,
    conditions_json TEXT,
    keywords TEXT,
    active INTEGER,
    bid REAL
  );
`);

// Upsert helper
const insertStmt = db.prepare(`
  INSERT INTO campaigns (id, title, image_url, click_url, conditions_json, keywords, active, bid)
  VALUES (@id, @title, @image_url, @click_url, @conditions_json, @keywords, @active, @bid)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    image_url = excluded.image_url,
    click_url = excluded.click_url,
    conditions_json = excluded.conditions_json,
    keywords = excluded.keywords,
    active = excluded.active,
    bid = excluded.bid;
`);

const insertMany = db.transaction((rows) => {
  for (const row of rows) {
    const anyRequired = row.any_required ?? 1;
    const age18Required = row.age18_required ?? 0;

    // Conditions: only include keys that are actually required.
    // any_required: 1 => requires "any" interest.
    // age18_required: 1 => requires "age18 === true".
    const conditions = {};
    if (anyRequired) conditions.any = true;
    if (age18Required) conditions.age18 = true;

    // Dataset is noisy: many "Untitled Product" titles.
    // We'll keep the scraped title, but in the frontend we will *display* row.id.
    let title = row.title || "";
    if (/^untitled product$/i.test(title.trim())) {
      title = "";
    }

    insertStmt.run({
      id: String(row.id),
      title,
      image_url: row.image_url || "/static/category-default.jpg",
      click_url: row.click_url || "https://example.com",
      conditions_json: JSON.stringify(conditions),
      keywords: row.keywords || "",
      active: row.active ?? 1,
      bid: row.bid ?? 0.1,
    });
  }
});

insertMany(products);

const count = db.prepare("SELECT COUNT(*) AS c FROM campaigns").get().c;
console.log(`✅ Imported/updated ${products.length} rows.`);
console.log(`📊 campaigns row count now: ${count}`);

db.close();
