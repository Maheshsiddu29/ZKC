// backend/scripts/initAdDb.js
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "..", "server", "ad_engine.db");
const db = new Database(dbPath);

db.exec(`
  DROP TABLE IF EXISTS campaigns;
  CREATE TABLE campaigns (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    click_url TEXT NOT NULL,
    conditions_json TEXT NOT NULL,
    bid REAL NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );
`);

const insert = db.prepare(`
  INSERT INTO campaigns (id, title, image_url, click_url, conditions_json, bid, active)
  VALUES (@id, @title, @image_url, @click_url, @conditions_json, @bid, 1)
`);

// Only gaming-18 is "adults-only". age18:true is required.
const campaigns = [
  {
    id: "gaming-18",
    title: "M-Rated Shooter",
    image_url: "/static/game18.jpg",
    click_url: "https://example.com/game18",
    conditions_json: JSON.stringify({ any: true, age18: true }),
    bid: 5.0,
  },
  {
    id: "gaming-safe",
    title: "Family-Friendly Co-op Game",
    image_url: "/static/generic.jpg",
    click_url: "https://example.com/game-family",
    conditions_json: JSON.stringify({ any: true }),
    bid: 4.0,
  },
  {
    id: "tech-1",
    title: "RGB Mechanical Keyboard",
    image_url: "/static/tech.jpg",
    click_url: "https://example.com/keyboard",
    conditions_json: JSON.stringify({}),
    bid: 3.0,
  },
  {
    id: "generic-1",
    title: "Welcome to ZK-City",
    image_url: "/static/generic.jpg",
    click_url: "https://example.com",
    conditions_json: JSON.stringify({}),
    bid: 1.0,
  },
];

for (const c of campaigns) {
  insert.run(c);
}

console.log("✅ ad_engine.db seeded with campaigns.");
db.close();
