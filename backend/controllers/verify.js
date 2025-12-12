// backend/controllers/verify.js
import fs from "fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { groth16 } from "snarkjs";
import { consumeNonce, isNullifierSeen, addNullifier, saveSession } from "../store.js";
import {
  createSessionPayload,
  signSession,
  setZkSessionCookie,
} from "../server/zkSession.js";

// ✅ robust __dirname that decodes spaces etc.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ points to /.../ZKC/build/cookie_verification_key.json
const VK_PATH = path.resolve(
  __dirname,
  "../../build/cookie_verification_key.json",
);

// publicSignals index layout must match your circuit outputs
// 0: nonce      (field, decimal string)
// 1: origin     (field, decimal string for originToField(host))
// 2: nowYear    (year now, e.g. 2025)
// 3: mask       (category bitmask)
// 4: C          (commitment; not used here on server)
// 5: nullifier  (prevents replay of the same proof)
// 6: predAny    (1 if user has any interest bit set)
// 7: predAge18  (1 if user is >= 18)
const IDX = {
  nonce: 0,
  origin: 1,
  nowYear: 2,
  mask: 3,
  C: 4,
  nullifier: 5,
  predAny: 6,
  predAge18: 7,
};

let VK = null;

// Load verification key once at startup
(async () => {
  try {
    VK = JSON.parse(await fs.readFile(VK_PATH, "utf8"));
    console.log("VK loaded.");
  } catch (e) {
    console.error("Failed to load verification key:", e);
  }
})();

export async function postVerify(req, res) {
  try {
    if (!VK) {
      return res
        .status(503)
        .json({ ok: false, error: "verification-key-not-ready" });
    }

    const { proof, publicSignals } = req.body || {};
    if (!proof || !Array.isArray(publicSignals) || publicSignals.length < 8) {
      return res.status(400).json({ ok: false, error: "invalid_body" });
    }

    // --- 1) Bind to issued challenge (nonce single-use + TTL) ---
    const nonceDec = String(publicSignals[IDX.nonce]); // decimal field
    const meta = consumeNonce(nonceDec); // { exp, originId, mask } or undefined
    if (!meta) {
      return res.status(409).json({
        ok: false,
        error: "nonce_not_found_expired_or_used",
      });
    }

    // --- 2) Enforce origin & mask equality with what we issued ---
    const origin_pub = String(BigInt(publicSignals[IDX.origin]));
    const mask_pub = Number(publicSignals[IDX.mask]);
    if (origin_pub !== meta.originId) {
      return res.status(400).json({ ok: false, error: "origin_mismatch" });
    }
    if (mask_pub !== meta.mask) {
      return res.status(400).json({ ok: false, error: "mask_mismatch" });
    }

    // --- 3) Verify ZK proof ---
    const ok = await groth16.verify(VK, publicSignals, proof);
    if (!ok) {
      return res
        .status(400)
        .json({ ok: false, error: "zk_verification_failed" });
    }

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

    // --- 6) Create signed ZK session and set cookie ---
    const sessionPayload = createSessionPayload({
      origin: meta.originId,
      mask: meta.mask,
      predicates,
    });

    const signed = signSession(sessionPayload);

    // optional in-memory registry – helps debugging in your CLI scripts
    if (typeof saveSession === "function") {
      try {
        saveSession(signed, sessionPayload);
      } catch (e) {
        console.warn("saveSession threw:", e);
      }
    }

    // Set zk_session cookie with consistent flags
    setZkSessionCookie(res, signed);

    // Also return JSON (handy for your CLI test script and the demo UI)
    return res.json({
      ok: true,
      session: signed,
      predicates,
      origin: sessionPayload.origin,
      exp: sessionPayload.exp,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
