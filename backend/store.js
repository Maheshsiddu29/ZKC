// backend/store.js — in-memory demo store (use Redis in prod)

// Nonces are keyed by the **decimal field string** from publicSignals[0]
export const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// nonceDec -> { exp, originId, mask }
const nonces = new Map();
const nullifiers = new Set(); // used nullifiers (string)
const sessions = new Map();   // sessionId -> { predicates, originId, iat, exp }

/** Save a fresh nonce (decimal field string) with metadata */
export function saveNonce(nonceDec, { originId, mask }) {
  nonces.set(String(nonceDec), {
    exp: Date.now() + NONCE_TTL_MS,
    originId: String(originId),
    mask: Number(mask),
  });
}

/** Consume a nonce once; enforces TTL and single use */
export function consumeNonce(nonceDec) {
  const key = String(nonceDec);
  const row = nonces.get(key);
  if (!row) return { ok: false, error: "nonce_not_found_or_expired" };
  if (Date.now() > row.exp) {
    nonces.delete(key);
    return { ok: false, error: "nonce_not_found_or_expired" };
  }
  nonces.delete(key); // single-use
  return { ok: true, data: row };
}

// Nullifier replay cache
export function isNullifierSeen(n) { return nullifiers.has(String(n)); }
export function addNullifier(n) { nullifiers.add(String(n)); }

// Sessions (for demo cookie)
export function saveSession(id, payload) { sessions.set(String(id), payload); }
export function getSession(id) { return sessions.get(String(id)); }

// Export raw stores if you need to inspect in tests
export { nonces, nullifiers, sessions };
