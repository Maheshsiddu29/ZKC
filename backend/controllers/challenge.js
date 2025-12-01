import crypto from "crypto";
import { originToField, toField } from "../utils/field.js";
import { saveNonce } from "../store.js";

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getChallenge(req, res) {
  try {
    // Required params: host (eTLD+1 recommended), mask (number)
    const host = req.query.host || req.headers["x-forwarded-host"] || req.hostname;
    const maskRaw = req.query.mask;
    if (!host || typeof maskRaw === "undefined") {
      return res.status(400).json({ ok: false, error: "Missing host or mask parameter" });
    }

    // sanitize mask: ensure integer and within allowed width (e.g., 16 bits)
    const mask = Number(maskRaw);
    if (!Number.isInteger(mask) || mask < 0 || mask >= (1 << 16)) {
      return res.status(400).json({ ok: false, error: "Invalid mask (must be 0..65535)" });
    }

    // make nonce (cryptographically random)
    const nonce = crypto.randomBytes(16).toString("hex"); // 32 hex chars
    const nowYear = new Date().getFullYear();

    // derive origin_id -> field integer (client will use as origin_id public signal)
    const originField = originToField(host);

    // Save nonce metadata server-side for TTL & single-use checks
    saveNonce(nonce, {
      issuedAt: Date.now(),
      expiresAt: Date.now() + NONCE_TTL_MS,
      originFieldStr: originField.toString(),
      originHost: host,
      mask
    });

    return res.json({
      ok: true,
      nonce,
      origin_id: originField.toString(), // public field integer as decimal string
      nowYear,
      catMask: mask,
      ttl_ms: NONCE_TTL_MS
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}
