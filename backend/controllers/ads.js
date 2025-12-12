// backend/controllers/ads.js
import { verifySession } from "../server/zkSession.js";
import db from "../server/db.js";

const FALLBACK_AD = {
  id: "generic",
  title: "Welcome to ZK-City",
  imageUrl: "/static/category-default.jpg",
  clickUrl: "https://example.com",
};

/**
 * Basic cookie parser (no external deps).
 */
export function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  const parts = header.split(";").map((c) => c.trim());
  for (const part of parts) {
    if (!part) continue;
    const [k, v] = part.split("=");
    if (decodeURIComponent(k) === name) {
      return decodeURIComponent(v || "");
    }
  }
  return null;
}

function tokenize(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter(Boolean),
  );
}

function isTrue(v) {
  if (v === true) return true;
  if (v === 1 || v === "1") return true;
  return false;
}

/**
 * Check whether a campaign's conditions are compatible with the user's
 * ZK predicates (from zk_session).
 *
 * conditions_json looks like: { any: true, age18: true }
 */
function matchesConditions(conditions, predicates) {
  if (!conditions || typeof conditions !== "object") return true;

  return Object.entries(conditions).every(([key, required]) => {
    if (required === undefined || required === null) return true;
    const actual = predicates?.[key];
    return isTrue(actual) === isTrue(required);
  });
}

/**
 * Build a text blob we use for keyword matching.
 * Dataset is noisy: the *real* title is in row.id, so we always include it.
 */
function getSearchText(row) {
  const parts = [];
  if (row.id) parts.push(String(row.id));

  // title is often "Untitled Product" – ignore those
  if (row.title && !/^untitled product$/i.test(String(row.title).trim())) {
    parts.push(String(row.title));
  }

  if (row.keywords) parts.push(String(row.keywords));

  return parts.join(" ");
}

/**
 * Heuristic category inference, used only to pick a category image.
 */
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

  if (has("printer", "thermal printer", "bluetooth printer")) return "gadgets";

  if (has("foot", "callus", "calluses", "pedicure", "manicure", "nail"))
    return "personal_care";

  return "generic";
}

/**
 * Map of category -> static image.
 * You provide one image per category under /static.
 */
const CATEGORY_IMAGES = {
  fitness_massage: "/static/cat-fitness_massage.jpg",
  fan_cooling: "/static/cat-fan_cooling.jpg",
  humidifier: "/static/cat-humidifier.jpg",
  oral_care: "/static/cat-oral_care.jpg",
  hair_removal: "/static/cat-hair_removal.jpg",
  beauty: "/static/cat-beauty.jpg",
  kitchen_tools: "/static/cat-kitchen_tools.jpg",
  laundry_cleaning: "/static/cat-laundry_cleaning.jpg",
  storage_org: "/static/cat-storage_org.jpg",
  personal_care: "/static/cat-personal_care.jpg",
  gadgets: "/static/cat-gadgets.jpg",
  pest_control: "/static/cat-pest_control.jpg",
  generic: "/static/category-default.jpg",
};

/**
 * Relevance scoring.
 * - heavy weight on query overlap with id/keywords
 * - small bonus if predicates.any && looks like gaming/tech
 * - bid is just a tiebreaker
 */
function scoreCampaign({ queryTokens, row, predicates }) {
  const text = getSearchText(row);
  const textTokens = tokenize(text);

  let overlap = 0;
  for (const t of queryTokens) {
    if (!t) continue;
    if (textTokens.has(t)) overlap++;
  }

  let relevanceScore = overlap;

  const lower = text.toLowerCase();
  const looksGaming = /game|gaming|console|xbox|ps5|nintendo/.test(lower);
  const looksTech = /keyboard|mouse|usb|bluetooth|printer|gadget|pc|laptop/.test(
    lower,
  );

  if (predicates.any && (looksGaming || looksTech)) {
    relevanceScore += 2;
  }

  const bid = row.bid || 1.0;

  return relevanceScore * 5 + bid;
}

/**
 * GET /ads?query=optional+search+text
 *
 * Reads zk_session, filters campaigns by conditions_json, ranks by score,
 * picks a PRIMARY ad, infers its category, then builds a slideshow
 * using only products from the same category.
 */
export function getAd(req, res) {
  try {
    const ttl = 60;

    // 1) Pull ZK predicates from zk_session cookie
    const token = getCookie(req, "zk_session");
    let payload = null;
    if (token) {
      payload = verifySession(token);
    }
    const predicates = payload?.predicates || {};

    // 2) Tokenize query text
    const qRaw = (req.query?.query || "").toString();
    const queryTokens = tokenize(qRaw);

    // 3) Load all active campaigns
    const rows = db
      .prepare(
        "SELECT id, title, image_url, click_url, conditions_json, keywords, active, bid FROM campaigns WHERE active = 1",
      )
      .all();

    const candidates = [];

    for (const row of rows) {
      let conditions = null;
      if (row.conditions_json) {
        try {
          conditions = JSON.parse(row.conditions_json);
        } catch (e) {
          console.error("Bad conditions_json for row", row.id, e);
        }
      }

      // ZK gating (age18, any, etc.)
      if (!matchesConditions(conditions, predicates)) continue;

      const score = scoreCampaign({ queryTokens, row, predicates });
      const category = inferCategory(row);
      candidates.push({ row, score, category });
    }

    let ad = FALLBACK_AD;
    let ads = [];

    if (candidates.length > 0) {
      // Sort all eligible candidates by score
      candidates.sort((a, b) => b.score - a.score);

      // Primary ad = best scoring candidate
      const primary = candidates[0];
      const primaryCategory = primary.category;

      // Restrict slideshow to SAME CATEGORY as primary
      let sameCat = candidates.filter(
        (c) => c.category === primaryCategory,
      );

      // Safety: if for some reason it's empty, fall back to top few overall
      if (!sameCat.length) {
        sameCat = candidates.slice(0, 5);
      } else {
        sameCat = sameCat.slice(0, 5);
      }

      ads = sameCat.map(({ row, category }) => {
        const imageUrl =
          CATEGORY_IMAGES[category] || row.image_url || FALLBACK_AD.imageUrl;

        return {
          id: row.id,
          // display id as title – it's the real human-readable string
          title: row.id,
          category,
          imageUrl,
          clickUrl: row.click_url || FALLBACK_AD.clickUrl,
        };
      });

      ad = ads[0];
    }

    return res.json({ ok: true, ad, ads, ttl });
  } catch (err) {
    console.error("getAd error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
