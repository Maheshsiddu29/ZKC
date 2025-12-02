// backend/controllers/challenge.js
import crypto from "node:crypto";
import { originToField, hexToField } from "../utils/field.js";
import { saveNonce, NONCE_TTL_MS } from "../store.js";

export async function challenge(req, res) {
  try {
    const host = String(req.query.host || "");
    const mask = Number(req.query.mask || 0);
    if (!host) return res.json({ ok: false, error: "missing_host" });

    // random 16-byte hex nonce (for display/logging)
    const nonceHex = crypto.randomBytes(16).toString("hex");
    // store the **decimal field** form for verification
    const nonceDec = hexToField(nonceHex);

    const origin_id = originToField(host); // decimal field for circuit
    const nowYear = new Date().getFullYear();

    // Save decimal nonce with metadata
    saveNonce(nonceDec, { originId: origin_id, mask });

    return res.json({
      ok: true,
      nonce: nonceHex,   // hex for display
      origin_id,         // decimal field for circuit input
      nowYear,
      catMask: mask,
      ttl_ms: NONCE_TTL_MS,
    });
  } catch (e) {
    console.error(e);
    return res.json({ ok: false, error: "server_error" });
  }
}
