import { verifySession } from "../server/zkSession.js";
import db from "../server/db.js";

const FALLBACK_AD = {
  id: "generic",
  title: "Welcome to ZK-City",
  imageUrl: "/static/generic.jpg",
  clickUrl: "https://example.com",
};

// ---- Utility cookie reader ----
function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  const parts = header.split(";").map((c) => c.trim());
  for (const part of parts) {
    if (part.startsWith(name + "=")) {
      return decodeURIComponent(part.substring(name.length + 1));
    }
  }
  return null;
}

const isTrue = (v) => v === true || v === "true" || v === 1 || v === "1";

function matchesConditions(conditions, predicates) {
  if (!conditions) return true;
  return Object.entries(conditions).every(([key, required]) => {
    if (required == null) return true;
    const actual = predicates[key];
    return isTrue(actual) === isTrue(required);
  });
}

// ---- NEW: simple ad matching for search queries ----
function getAdForSearch(q) {
  if (!q) return null;

  const text = q.toLowerCase();

  if (text.includes("laptop") || text.includes("tech") || text.includes("computer")) {
    return {
      id: "tech",
      title: "Latest Laptops & Electronics",
      imageUrl: "/static/tech.jpg",
      clickUrl: "https://amazon.com/laptops"
    };
  }

  if (text.includes("game") || text.includes("controller") || text.includes("ps5")) {
    return {
      id: "game",
      title: "Top Gaming Gear Deals",
      imageUrl: "/static/game18.jpg",
      clickUrl: "https://amazon.com/gaming"
    };
  }

  if (text.includes("women") || text.includes("shoes") || text.includes("heels") || text.includes("fashion")) {
    return {
      id: "fashion",
      title: "Trending Women's Fashion",
      imageUrl: "/static/generic.jpg",   // replace with fashion.jpg if you add one
      clickUrl: "https://amazon.com/fashion"
    };
  }

  // no match → allow ZK personalization or fallback
  return null;
}

// ---- MAIN AD ROUTE ----
export function getAd(req, res) {
  const ttl = 60;

  // 1) Handle search query first (simple mode)
  const q = req.query.q || "";
  const searchAd = getAdForSearch(q);
  
  if (searchAd) {
    return res.json({
      ok: true,
      ad: searchAd,
      ttl
    });
  }

  // 2) If no search query matched → use ZK predicate ads

  const token = getCookie(req, "zk_session");
  let payload = null;
  
  if (token) {
    payload = verifySession(token);
  }

  const predicates = payload?.predicates || {};

  // Read all active campaigns
  const rows = db.prepare("SELECT * FROM campaigns WHERE active = 1").all();

  const eligible = [];
  for (const row of rows) {
    const conditions = JSON.parse(row.conditions_json || "{}");
    if (matchesConditions(conditions, predicates)) {
      eligible.push(row);
    }
  }

  let selected = null;
  if (eligible.length > 0) {
    selected = eligible.reduce((a, b) => (a.bid >= b.bid ? a : b));
  }

  const ad = selected ? {
    id: selected.id,
    title: selected.title,
    imageUrl: selected.image_url,
    clickUrl: selected.click_url
  } : FALLBACK_AD;

  return res.json({
    ok: true,
    ad,
    ttl
  });
}
