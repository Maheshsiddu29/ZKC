// middleware/session.js

import cookieSignature from "cookie-signature";

const SESSION_SIGN_SECRET = process.env.SESSION_SECRET || "dev_secret_change_in_prod";

function parseCookieHeader(h) {
  const out = {};
  if (!h) return out;
  for (const part of h.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

export function requireSession(req, res, next) {
  try {
    const cookies = parseCookieHeader(req.headers.cookie || "");
    const signed = cookies["zk_session"];
    if (!signed) return res.status(401).json({ ok: false, error: "no_session" });

    const val = cookieSignature.unsign(signed, SESSION_SIGN_SECRET);
    if (!val) return res.status(401).json({ ok: false, error: "bad_session_sig" });

    let payload;
    try {
      payload = JSON.parse(Buffer.from(val, "base64url").toString("utf8"));
    } catch {
      return res.status(401).json({ ok: false, error: "bad_session_payload" });
    }

    if (payload.exp <= Date.now()) {
      return res.status(401).json({ ok: false, error: "session_expired" });
    }

    
    req.zk = {
      origin: payload.origin,
      mask: payload.mask,
      predicates: payload.predicates,
      exp: payload.exp,
    };
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "session_check_error" });
  }
}