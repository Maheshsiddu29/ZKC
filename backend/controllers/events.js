// backend/controllers/events.js
import { verifySession } from "../server/zkSession.js";
import { getCookie } from "./ads.js";

/**
 * POST /api/events/search
 * Body: { query: string }
 *
 * Debug endpoint: shows what predicates we infer from the search query
 * + what we already know from zk_session. Does NOT mutate the session.
 */
export function searchEvents(req, res) {
  try {
    const qRaw = (req.body?.query || "").toString();
    const q = qRaw.toLowerCase().trim();

    // Pull predicates from zk_session (ZK cookie)
    const token = getCookie(req, "zk_session");
    let payload = null;
    if (token) {
      payload = verifySession(token);
    }
    const sessionPreds = payload?.predicates || {};

    // Very rough heuristics from the query text itself
    const isGaming = /\b(game|gaming|console|xbox|ps5|playstation|nintendo)\b/i.test(
      q,
    );
    const isTech = /\b(laptop|keyboard|mouse|usb|printer|phone|monitor|pc)\b/i.test(
      q,
    );

    const predicates = {
      // any is "some interest" – either from query or from session
      any: isGaming || isTech || !!sessionPreds.any,
      gaming: isGaming,
      tech: isTech,

      // crucial: age18 comes only from ZK cookie, NOT guessed from query
      age18: !!sessionPreds.age18,
    };

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
