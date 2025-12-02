// backend/controllers/verify.js
import fs from "fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { groth16 } from "snarkjs";
import cookieSignature from "cookie-signature";

import { consumeNonce, isNullifierSeen, addNullifier, saveSession } from "../store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load VK relative to this file (stable no matter CWD)
const VK_PATH = path.join(__dirname, "../../build/cookie_verification_key.json");
const VK = JSON.parse(await fs.readFile(VK_PATH, "utf8"));

const SESSION_SIGN_SECRET = process.env.SESSION_SECRET || "dev_secret_change_in_prod";
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Support both 8-output (no predAll) and 9-output (with predAll)
function getIdx(len) {
  if (len === 9) {
    return { nonce:0, origin:1, nowYear:2, mask:3, C:4, nullifier:5, predAny:6, predAll:7, predAge18:8 };
  }
  return { nonce:0, origin:1, nowYear:2, mask:3, C:4, nullifier:5, predAny:6, predAge18:7 };
}

export async function verify(req, res) {
  try {
    const { proof, publicSignals } = req.body || {};
    if (!proof || !Array.isArray(publicSignals)) {
      return res.status(400).json({ ok:false, error:"missing proof or publicSignals" });
    }

    const idx = getIdx(publicSignals.length);

    // 1) Nonce single-use + TTL (decimal ↔ decimal)
    const nonce_dec = String(publicSignals[idx.nonce]); // circuit emits decimal field string
    const take = consumeNonce(nonce_dec);
    if (!take.ok) {
      return res.status(409).json({ ok:false, error: take.error || "nonce_not_found_or_expired" });
    }
    const { originId, mask } = take.data;

    // 2) Bindings: origin + mask must match the challenge we issued
    const origin_pub = String(publicSignals[idx.origin]); // decimal field
    const mask_pub   = Number(publicSignals[idx.mask]);   // small int
    if (origin_pub !== originId) return res.status(400).json({ ok:false, error:"bad_origin" });
    if (mask_pub !== mask)       return res.status(400).json({ ok:false, error:"bad_mask" });

    // 3) Cryptographic verify
    const ok = await groth16.verify(VK, publicSignals, proof);
    if (!ok) return res.status(400).json({ ok:false, error:"invalid_proof" });

    // 4) Nullifier replay protection
    const nullifier = String(publicSignals[idx.nullifier]);
    if (isNullifierSeen(nullifier)) {
      return res.status(409).json({ ok:false, error:"nullifier_replay" });
    }
    addNullifier(nullifier);

    // 5) Predicates for demo payload
    const predAny   = Number(publicSignals[idx.predAny]) === 1;
    const predAll   = (idx.predAll !== undefined) ? Number(publicSignals[idx.predAll]) === 1 : undefined;
    const predAge18 = Number(publicSignals[idx.predAge18]) === 1;

    // 6) Issue short-lived signed session token (demo)
    const sessionPayload = {
      origin: originId,
      mask,
      predicates: { any: predAny, all: predAll, age18: predAge18 },
      iat: Date.now(),
      exp: Date.now() + SESSION_TTL_MS
    };
    const payloadStr = JSON.stringify(sessionPayload);
    const sig = cookieSignature.sign(payloadStr, SESSION_SIGN_SECRET);
    const sessionId = Buffer.from(payloadStr).toString("base64") + "." + sig;

    saveSession(sessionId, sessionPayload);

    return res.json({
      ok: true,
      session: sessionId,
      predicates: sessionPayload.predicates,
      origin: sessionPayload.origin,
      exp: sessionPayload.exp
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok:false, error:"server_error" });
  }
}
