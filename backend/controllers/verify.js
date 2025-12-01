import fs from "fs/promises";
import { groth16 } from "snarkjs";
import { getNonce, markNonceUsed, isNullifierSeen, addNullifier, saveSession } from "../store.js";
import { SNARK_FIELD_PRIME } from "../utils/field.js";
import cookieSignature from "cookie-signature";
import crypto from "crypto";
import path from "node:path";


// adjust VK_PATH to your compiled artifacts
//const VK_PATH = "./build/cookie_verification_key.json";
const VK_PATH = path.resolve("../build/cookie_verification_key.json");

const SESSION_SIGN_SECRET = process.env.SESSION_SECRET || "dev_secret_change_in_prod";
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

let VK = null;
(async () => {
  VK = JSON.parse(await fs.readFile(VK_PATH, "utf8"));
  console.log("VK loaded.");
})();

// mapping of publicSignals index — must match circuit outputs
const IDX = { nonce:0, origin:1, nowYear:2, mask:3, C:4, nullifier:5, predAny:6, predAge18:7 };

function requireVKReady(res) {
  if (!VK) {
    res.status(503).json({ ok: false, error: "verification-key-not-ready" });
    return false;
  }
  return true;
}

export async function postVerify(req, res) {
  try {
    if (!requireVKReady(res)) return;

    const { proof, publicSignals } = req.body;
    if (!proof || !publicSignals) return res.status(400).json({ ok: false, error: "missing proof or publicSignals" });

    // 1) Basic format checks
    if (!Array.isArray(publicSignals) || publicSignals.length < 8) {
      return res.status(400).json({ ok: false, error: "invalid publicSignals length" });
    }

    // 2) check nonce metadata
    const nonce = publicSignals[IDX.nonce];
    const meta = getNonce(nonce);
    if (!meta) return res.status(409).json({ ok: false, error: "nonce_not_found_or_expired" });

    const now = Date.now();
    if (meta.expiresAt < now) {
      return res.status(409).json({ ok: false, error: "nonce_expired" });
    }
    if (meta.used) return res.status(409).json({ ok: false, error: "nonce_already_used" });

    // 3) verify the public mask and origin match our issued values
    const origin_pub = BigInt(publicSignals[IDX.origin]).toString();
    if (origin_pub !== meta.originFieldStr) {
      return res.status(400).json({ ok: false, error: "origin_mismatch" });
    }
    const mask_pub = Number(publicSignals[IDX.mask]);
    if (mask_pub !== meta.mask) {
      return res.status(400).json({ ok: false, error: "mask_mismatch" });
    }

    // 4) Verify the ZK proof using snarkjs
    const ok = await groth16.verify(VK, publicSignals, proof);
    if (!ok) return res.status(400).json({ ok: false, error: "zk_verification_failed" });

    // 5) Replay protection using nullifier
    const nullifier = publicSignals[IDX.nullifier].toString();
    if (isNullifierSeen(nullifier)) {
      return res.status(409).json({ ok: false, error: "nullifier_replay" });
    }

    // 6) Extract predicate bits
    const predAny  = Number(publicSignals[IDX.predAny]) === 1;
    const predAge18 = Number(publicSignals[IDX.predAge18]) === 1;

    // 7) Mark nonce used and record nullifier
    markNonceUsed(nonce);
    addNullifier(nullifier);

    // 8) Issue a short-lived session token (signed string)
    const sessionPayload = {
      origin: meta.originFieldStr,
      mask: meta.mask,
      predicates: { any: predAny, age18: predAge18 },
      iat: Date.now(),
      exp: Date.now() + SESSION_TTL_MS
    };
    // simple signed string using cookie-signature: "s:<payload>.<sig>"
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
    res.status(500).json({ ok: false, error: "server_error" });
  }
}
