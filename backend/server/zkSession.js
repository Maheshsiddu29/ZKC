// backend/server/zkSession.js
import crypto from "crypto";

const SESSION_TTL_SECONDS = 300; // 5 minutes
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-key";

export function createSessionPayload({ origin, mask, predicates }) {
  const now = Math.floor(Date.now() / 1000);
  return {
    origin,
    mask,
    predicates,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
}

export function signSession(payload) {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(b64)
    .digest("base64url");
  return `${b64}.${sig}`;
}

export function verifySession(token) {
  try {
    if (!token || typeof token !== "string") return null;
    const [b64, sig] = token.split(".");
    if (!b64 || !sig) return null;

    const expected = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(b64)
      .digest("base64url");

    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const json = Buffer.from(b64, "base64url").toString("utf8");
    const payload = JSON.parse(json);

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) {
      return null;
    }

    return payload;
  } catch (e) {
    console.error("verifySession error:", e);
    return null;
  }
}

export function setZkSessionCookie(res, sessionString) {
  res.cookie("zk_session", sessionString, {
    httpOnly: true,
    secure: false, 
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/",
  });
}