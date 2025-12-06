// backend/store.js — in-memory demo store (use Redis in prod)

// Nonces are keyed by the **decimal field string** (publicSignals[0])
export const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Maps/Sets
const nonces = new Map();      // nonceDec -> { exp, originId, mask, used }
const nullifiers = new Set();  // seen nullifier strings
const sessions = new Map();    // sessionId -> payload

/** Save a fresh nonce (decimal field string) with metadata */
export function saveNonce(nonceDec, { originId, mask }) {
  nonces.set(String(nonceDec), {
    exp: Date.now() + NONCE_TTL_MS,
    originId: String(originId),
    mask: Number(mask),
    used: false,
  });
}

/** Consume a nonce once; enforces TTL and single use */
export function consumeNonce(nonceDec) {
  const key = String(nonceDec);
  const entry = nonces.get(key);
  if (!entry) return undefined;
  if (entry.used) return undefined;
  if (entry.exp <= Date.now()) {
    nonces.delete(key);
    return undefined;
  }
  entry.used = true;
  return entry; // { exp, originId, mask, used:true }
}

// Nullifiers
export function isNullifierSeen(n) {
  return nullifiers.has(String(n));
}
export function addNullifier(n) {
  nullifiers.add(String(n));
}

// Sessions (optional debug/admin)
export function saveSession(id, payload) {
  sessions.set(String(id), payload);
}
export function getSession(id) {
  return sessions.get(String(id));
}

// Export raw stores if you need them elsewhere (debug)
export { nonces, nullifiers, sessions };
