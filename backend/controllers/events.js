// backend/controllers/events.js
import {
  createSessionPayload,
  setZkSessionCookie,
  signSession,
  verifySession,
} from "../server/zkSession.js";
import { getCookie } from "./ads.js";

function inferInterestKeyFromQuery(q) {
  const s = String(q || "").toLowerCase();
  const has = (...words) => words.some((w) => s.includes(w));
  //choosing predicates from search action
  if (has("fan", "cooling", "ac", "air cooler")) return "int_gadgets";
  if (has("printer", "thermal", "bluetooth")) return "int_gadgets";
  if (has("massage gun", "foam roller", "yoga", "workout", "gym")) return "int_fitness";
  if (has("makeup", "eyelash", "eyebrow", "beauty", "skincare")) return "int_beauty";
  if (has("toothbrush", "water flosser", "flosser", "oral")) return "int_personal_care";
  if (has("hair removal", "epilator", "shaver", "razor", "trimmer")) return "int_personal_care";
  if (has("kitchen", "garlic", "chopper", "baking", "coffee", "pan", "pot", "juicer", "blender")) return "int_home_kitchen";
  if (has("storage", "organizer", "rack", "container")) return "int_home_kitchen";
  if (has("laundry", "dishwasher", "dishwashing")) return "int_home_kitchen";

  return null;
}

function recomputeAny(p) {
  return Boolean(
    p.int_home_kitchen || p.int_personal_care || p.int_beauty || p.int_fitness || p.int_gadgets
  );
}

export function searchEvents(req, res) {
  try {
    const qRaw = (req.body?.query || "").toString();

    const token = getCookie(req, "zk_session");
    const payload = token ? verifySession(token) : null;
    if (!payload) return res.status(401).json({ ok: false, error: "no_session" });

    const predicates = { ...(payload.predicates || {}) };

    const interestKey = inferInterestKeyFromQuery(qRaw);
    if (interestKey) {
      predicates[interestKey] = true;
      predicates.any = recomputeAny(predicates);

      
      predicates.hi_intent_recent = true;
    }

    const sessionPayload = createSessionPayload({
      origin: payload.origin,
      mask: payload.mask,
      predicates,
    });

    const signed = signSession(sessionPayload);
    setZkSessionCookie(res, signed);

    return res.json({ ok: true, query: qRaw, predicates, updated: !!interestKey, exp: sessionPayload.exp });
  } catch (e) {
    console.error("searchEvents error:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
