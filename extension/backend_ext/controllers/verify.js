import fs from "fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { groth16 } from "snarkjs";
import cookieSignature from "cookie-signature";
import { consumeNonce, isNullifierSeen, addNullifier, saveSession } from "../store.js";

// ✅ robust __dirname that decodes spaces etc.
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ✅ points to /.../ZKC/build/cookie_verification_key.json
const VK_PATH = path.resolve(__dirname, "../../build/cookie_verification_key.json");


const SESSION_SIGN_SECRET = process.env.SESSION_SECRET || "dev_secret_change_in_prod";
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const IS_SECURE = process.env.NODE_ENV === "production";

// publicSignals index layout must match your circuit outputs
const IDX = { nonce:0, origin:1, nowYear:2, mask:3, C:4, nullifier:5, predAny:6, predAge18:7 };

let VK = null;
(async () => {
  VK = JSON.parse(await fs.readFile(VK_PATH, "utf8"));
  console.log("VK loaded.");
})();

function cookieSerialize(name, value, { maxAge, httpOnly = true, sameSite = "Lax", path = "/", secure = IS_SECURE } = {}) {
  const parts = [`${name}=${value}`];
  if (maxAge != null) parts.push(`Max-Age=${Math.floor(maxAge / 1000)}`);
  if (path) parts.push(`Path=${path}`);
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  if (secure) parts.push(`Secure`);
  if (httpOnly) parts.push(`HttpOnly`);
  return parts.join("; ");
}

export async function postVerify(req, res) {
  try {
    if (!VK) return res.status(503).json({ ok: false, error: "verification-key-not-ready" });

    const { proof, publicSignals } = req.body || {};
    if (!proof || !Array.isArray(publicSignals) || publicSignals.length < 8) {
      return res.status(400).json({ ok: false, error: "invalid_body" });
    }

    // --- 1) Bind to issued challenge (nonce single-use + TTL) ---
    const nonceDec = String(publicSignals[IDX.nonce]); // decimal field
    const meta = consumeNonce(nonceDec);               // { exp, originId, mask } or undefined
    if (!meta) {
      return res.status(409).json({ ok: false, error: "nonce_not_found_expired_or_used" });
    }

    // --- 2) Enforce origin & mask equality with what we issued ---
    const origin_pub = String(BigInt(publicSignals[IDX.origin]));
    const mask_pub = Number(publicSignals[IDX.mask]);
    if (origin_pub !== meta.originId) return res.status(400).json({ ok: false, error: "origin_mismatch" });
    if (mask_pub !== meta.mask) return res.status(400).json({ ok: false, error: "mask_mismatch" });

    // --- 3) Verify ZK proof ---
    const ok = await groth16.verify(VK, publicSignals, proof);
    if (!ok) return res.status(400).json({ ok: false, error: "zk_verification_failed" });

    // --- 4) Nullifier replay protection ---
    const nullifier = String(publicSignals[IDX.nullifier]);
    if (isNullifierSeen(nullifier)) {
      return res.status(409).json({ ok: false, error: "nullifier_replay" });
    }
    addNullifier(nullifier);

    // --- 5) Extract predicates ---
    const predicates = {
      any: Number(publicSignals[IDX.predAny]) === 1,
      age18: Number(publicSignals[IDX.predAge18]) === 1,
    };

    // --- 6) Create signed session and set cookie ---
    const sessionPayload = {
      origin: meta.originId,
      mask: meta.mask,
      predicates,
      iat: Date.now(),
      exp: Date.now() + SESSION_TTL_MS,
    };

    const payloadB64 = Buffer.from(JSON.stringify(sessionPayload)).toString("base64url");
    const signed = cookieSignature.sign(payloadB64, SESSION_SIGN_SECRET); // "val.sig"

    // optional in-memory registry
    saveSession(signed, sessionPayload);

    // Set-Cookie header
    const cookie = cookieSerialize("zk_session", signed, {
      maxAge: SESSION_TTL_MS,
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      secure: IS_SECURE,
    });
    res.setHeader("Set-Cookie", cookie);

    // Also return JSON (handy for your CLI test script)
    return res.json({ ok: true, session: signed, predicates, origin: sessionPayload.origin, exp: sessionPayload.exp });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
