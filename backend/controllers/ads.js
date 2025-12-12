// backend/controllers/ads.js
import { verifySession } from "../server/zkSession.js";
import db from "../server/db.js";

const FALLBACK_AD = {
  id: "generic",
  title: "Welcome to ZK-City",
  imageUrl: "/static/category-default.jpg",
  clickUrl: "https://example.com",
};

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

function matchesConditions(conditions, predicates) {
  if (!conditions || typeof conditions !== "object") return true;

  return Object.entries(conditions).every(([key, required]) => {
    if (required === undefined || required === null) return true;
    const actual = predicates?.[key];
    return isTrue(actual) === isTrue(required);
  });
}

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
    has(
      "epilator",
      "hair eraser",
      "hair removal",
      "trimmer",
      "shaver",
      "razor",
    )
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

// category -> interest predicate key
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

/**
 * Derive *ephemeral* interest from the current search query.
 * e.g. query "fan" -> category "fan_cooling" -> interestKey "int_gadgets".
 */
function deriveSearchInterestFromQuery(qRaw) {
  const text = (qRaw || "").toString().trim();
  if (!text) return {};
  const fakeRow = { id: text, title: "", keywords: "" };
  const category = inferCategory(fakeRow);
  const interestKey = categoryToInterestKey(category);
  const out = {};
  if (interestKey) {
    out[interestKey] = true;
  }
  return out;
}

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
 * Relevance scoring:
 * - query overlap
 * - bonus if user's interests align with product's interest
 * - extra bonus for hi_intent_recent / cart_abandoner in that vertical
 * - bid as tie-breaker
 */
function scoreCampaign({ queryTokens, row, predicates }) {
  const text = getSearchText(row);
  const textTokens = tokenize(text);

  let overlap = 0;
  for (const t of queryTokens) {
    if (!t) continue;
    if (textTokens.has(t)) overlap++;
  }

  let score = overlap * 5;

  const category = inferCategory(row);
  const interestKey = categoryToInterestKey(category);

  if (interestKey && predicates[interestKey]) {
    score += 3; // user is in the right vertical

    if (predicates.hi_intent_recent) {
      score += 4; // “high intent” users get more relevant ads
    }

    if (predicates.cart_abandoner) {
      score += 5; // simulate retargeting cart abandoners
    }

    if (predicates.recent_buyer) {
      // mild boost or penalty – tweak as you like
      score += 1;
    }
  }

  const bid = row.bid || 1.0;
  return score + bid;
}

/**
 * Combine:
 * - ZK predicates (stable profile)
 * - search-derived interests (ephemeral, per-query)
 *
 * This is what we actually use for targeting and what we return in debug.
 */
export function computeEffectivePredicates({ basePredicates = {}, qRaw }) {
  const base = basePredicates || {};
  const extra = deriveSearchInterestFromQuery(qRaw);

  const merged = { ...base };

  const anyBase = isTrue(base.any);
  const anyFromSearch = Object.keys(extra).length > 0;

  if (anyBase || anyFromSearch) {
    merged.any = true;
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value) {
      merged[key] = true;
    }
  }

  return merged;
}

/**
 * GET /ads?query=...
 */
export function getAd(req, res) {
  try {
    const ttl = 60;

    const qRaw = (req.query?.query || "").toString();

    const token = getCookie(req, "zk_session");
    let payload = null;
    if (token) {
      payload = verifySession(token);
    }
    const basePredicates = payload?.predicates || {};
    const predicates = computeEffectivePredicates({
      basePredicates,
      qRaw,
    });

    const queryTokens = tokenize(qRaw);

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

      // Use combined predicates (ZK + search intent)
      if (!matchesConditions(conditions, predicates)) continue;

      const category = inferCategory(row);
      const score = scoreCampaign({ queryTokens, row, predicates });

      candidates.push({ row, score, category });
    }

    let ad = FALLBACK_AD;
    let ads = [];

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);

      const primary = candidates[0];
      const primaryCategory = primary.category;

      // only same-category products in slideshow
      let sameCat = candidates.filter(
        (c) => c.category === primaryCategory,
      );

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
          title: row.id, // display real product text from id
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
