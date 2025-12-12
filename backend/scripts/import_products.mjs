// backend/scripts/import_products.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, "../ads.db");
const DATA_PATH = path.resolve(__dirname, "../data/transformed_products.json");

console.log("Using DB:", DB_PATH);
console.log("Loading JSON from:", DATA_PATH);

const raw = fs.readFileSync(DATA_PATH, "utf8");
const products = JSON.parse(raw);

const db = new Database(DB_PATH);

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

function getSearchText(row) {
  const parts = [];
  if (row.id) parts.push(String(row.id));
  if (row.title && !/^untitled product$/i.test(String(row.title).trim())) {
    parts.push(String(row.title));
  }
  if (row.keywords) parts.push(String(row.keywords));
  return parts.join(" ");
}

function inferCategory(row) {
  const text = getSearchText(row).toLowerCase();
  const has = (...words) => words.some((w) => text.includes(w));

  if (has("massage gun")) return "fitness_massage";

  if (has("humidifier", "mister", "diffuser", "aroma")) return "humidifier";

  if (has("fan")) return "fan_cooling";

  if (has("toothbrush", "flosser", "oral irrigator", "water flosser"))
    return "oral_care";

  if (
    has("epilator", "hair eraser", "hair removal", "trimmer", "shaver", "razor")
  )
    return "hair_removal";

  if (has("eyelash", "eyebrow", "makeup")) return "beauty";

  if (
    has(
      "garlic",
      "chopper",
      "kitchen",
      "baking",
      "fryer",
      "mold",
      "mould",
      "egg",
      "whisk",
      "frother",
      "coffee",
      "thermometer",
      "sealer",
      "juicer",
      "blender",
      "pan",
      "pot",
    )
  )
    return "kitchen_tools";

  if (has("laundry", "dishwashing", "dishwasher", "sponge"))
    return "laundry_cleaning";

  if (has("storage", "organizer", "holder", "rack", "container", "box", "tray"))
    return "storage_org";

  if (has("mosquito", "zapper", "insect")) return "pest_control";

  if (has("printer", "thermal printer", "bluetooth printer"))
    return "gadgets";

  if (has("foot", "callus", "calluses", "pedicure", "manicure", "nail"))
    return "personal_care";

  return "generic";
}

function categoryToInterestKey(category) {
  switch (category) {
    case "kitchen_tools":
    case "storage_org":
    case "laundry_cleaning":
      return "int_home_kitchen";

    case "hair_removal":
    case "oral_care":
    case "personal_care":
      return "int_personal_care";

    case "beauty":
      return "int_beauty";

    case "fitness_massage":
      return "int_fitness";

    case "gadgets":
    case "fan_cooling":
      return "int_gadgets";

    default:
      return null;
  }
}

const insertMany = db.transaction((rows) => {
  for (const row of rows) {
    const anyRequired = row.any_required ?? 1;
    const age18Required = row.age18_required ?? 0;

    const category = inferCategory(row);
    const interestKey = categoryToInterestKey(category);

    const conditions = {};
    if (anyRequired) conditions.any = true;
    if (age18Required) conditions.age18 = true;
    if (interestKey) conditions[interestKey] = true;

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
