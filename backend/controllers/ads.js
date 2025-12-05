import { verifySession } from "../server/zkSession.js";
import db from "../server/db.js";

const FALLBACK_AD = {
  id: "generic",
  title: "Welcome to ZK-City",
  imageUrl: "/static/generic.jpg",
  clickUrl: "https://example.com",
};

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
    if (required === undefined || required === null) return true;
    const actual = predicates[key];
    return isTrue(actual) === isTrue(required);
  });
}

export function getAd(req, res) {
  const ttl = 60;

  const token = getCookie(req, "zk_session");
  let payload = null;
  if (token) {
    payload = verifySession(token);
  }

  const predicates = payload?.predicates || {};

  const rows = db.prepare(
    "SELECT * FROM campaigns WHERE active = 1"
  ).all();

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

  let ad;
  if (selected) {
    ad = {
      id: selected.id,
      title: selected.title,
      imageUrl: selected.image_url,
      clickUrl: selected.click_url,
    };
  } else {
    ad = FALLBACK_AD;
  }

  res.json({
    ok: true,
    ad,
    ttl,
  });
}
