// backend/server/zkSession.js
import crypto from "crypto";

const SESSION_TTL_SECONDS = 300;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-key";

export function createSessionPayload({ origin, predicates, mask }) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_TTL_SECONDS;

  return {
    origin,
    mask,
    predicates,
    iat: now,
    exp,
  };
}

export function signSession(payload) {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, "utf8").toString("base64url");

  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(b64)
    .digest("base64url");

  return `${b64}.${sig}`;
}

export function verifySession(token) {
  try {
    const [b64, sig] = token.split(".");
    if (!b64 || !sig) return null;

    const expected = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(b64)
      .digest("base64url");

    if (sig !== expected) return null;

    const json = Buffer.from(b64, "base64url").toString("utf8");
    const payload = JSON.parse(json);

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) return null;

    return payload;
  } catch (e) {
    console.error("verifySession error:", e);
    return null;
  }
}

export function setZkSessionCookie(res, sessionString) {
  res.cookie("zk_session", sessionString, {
    httpOnly: true,
    secure: false, // true in prod / https
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}
