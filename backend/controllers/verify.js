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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust if your vk path is different
const VK_PATH = path.resolve(
  __dirname,
  "../../build/cookie_verification_key.json",
);

// --- Public signals layout ---
//
//  0: nonce
//  1: origin
//  2: nowYear
//  3: mask
//  4: C
//  5: nullifier
//
//  6: pred_any            (optional, legacy)
//  7: pred_age18          (>= 18)
//
//  8: pred_age25          (>= 25)
//  9: pred_age35          (>= 35)
//
// 10: int_home_kitchen
// 11: int_personal_care
// 12: int_beauty
// 13: int_fitness
// 14: int_gadgets
//
// 15: hi_intent_recent
// 16: cart_abandoner
// 17: recent_buyer
//
const IDX = {
  nonce: 0,
  origin: 1,
  nowYear: 2,
  mask: 3,
  C: 4,
  nullifier: 5,

  predAny: 6,
  predAge18: 7,
  predAge25: 8,
  predAge35: 9,

  intHomeKitchen: 10,
  intPersonalCare: 11,
  intBeauty: 12,
  intFitness: 13,
  intGadgets: 14,

  hiIntentRecent: 15,
  cartAbandoner: 16,
  recentBuyer: 17,
};

let VK = null;

// Load verification key once
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
    if (!proof || !Array.isArray(publicSignals) || publicSignals.length < 6) {
      // we need at least up to nullifier index
      return res.status(400).json({ ok: false, error: "invalid_body" });
    }

    const asString = (i) => String(publicSignals[i]);
    const asBool = (i) => Number(publicSignals[i] || 0) === 1;

    // --- 1) Bind to issued challenge (nonce single-use + TTL) ---
    const nonceDec = asString(IDX.nonce);
    const meta = consumeNonce(nonceDec); // { originId, mask, exp } or undefined
    if (!meta) {
      return res.status(409).json({
        ok: false,
        error: "nonce_not_found_expired_or_used",
      });
    }

    // --- 2) Enforce origin & mask equality with what we issued ---
    const origin_pub = String(BigInt(asString(IDX.origin)));
    const mask_pub = Number(publicSignals[IDX.mask] || 0);

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
    const nullifier = asString(IDX.nullifier);
    if (isNullifierSeen(nullifier)) {
      return res.status(409).json({ ok: false, error: "nullifier_replay" });
    }
    addNullifier(nullifier);

    // --- 5) Build rich predicates ---
    const age18 = asBool(IDX.predAge18);
    const age25 = asBool(IDX.predAge25);
    const age35 = asBool(IDX.predAge35);

    const int_home_kitchen  = asBool(IDX.intHomeKitchen);
    const int_personal_care = asBool(IDX.intPersonalCare);
    const int_beauty        = asBool(IDX.intBeauty);
    const int_fitness       = asBool(IDX.intFitness);
    const int_gadgets       = asBool(IDX.intGadgets);

    const hi_intent_recent  = asBool(IDX.hiIntentRecent);
    const cart_abandoner    = asBool(IDX.cartAbandoner);
    const recent_buyer      = asBool(IDX.recentBuyer);

    // "any" = OR of interest bits, plus legacy predAny if your circuit still outputs it
    const anyFromInterests =
      int_home_kitchen ||
      int_personal_care ||
      int_beauty ||
      int_fitness ||
      int_gadgets;

    const anyLegacy = asBool(IDX.predAny);
    const any = anyLegacy || anyFromInterests;

    const predicates = {
      // demographics
      age18,
      age25,
      age35,

      // interests
      int_home_kitchen,
      int_personal_care,
      int_beauty,
      int_fitness,
      int_gadgets,

      // intent
      hi_intent_recent,
      cart_abandoner,
      recent_buyer,

      // legacy / convenience
      any,
    };

    // --- 6) Create signed ZK session and set cookie ---
    const sessionPayload = createSessionPayload({
      origin: meta.originId,
      mask: meta.mask,
      predicates,
    });

    const signed = signSession(sessionPayload);

    if (typeof saveSession === "function") {
      try {
        saveSession(signed, sessionPayload);
      } catch (e) {
        console.warn("saveSession threw:", e);
      }
    }

    setZkSessionCookie(res, signed);

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
