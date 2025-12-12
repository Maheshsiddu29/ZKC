// backend/controllers/events.js
import { verifySession } from "../server/zkSession.js";
import { getCookie, computeEffectivePredicates } from "./ads.js";

export function searchEvents(req, res) {
  try {
    const qRaw = (req.body?.query || "").toString();

    const token = getCookie(req, "zk_session");
    let payload = null;
    if (token) {
      payload = verifySession(token);
    }
    const basePreds = payload?.predicates || {};
    const predicates = computeEffectivePredicates({
      basePredicates: basePreds,
      qRaw,
    });

    return res.json({
      ok: true,
      query: qRaw,
      predicates,
      fromSession: !!payload,
    });
  } catch (err) {
    console.error("searchEvents error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
