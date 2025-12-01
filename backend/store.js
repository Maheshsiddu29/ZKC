// Simple in-memory store for demo. Replace with Redis for production.
const nonces = new Map();      // nonce -> { issuedAt, originId, mask, used: bool }
const nullifiers = new Set();  // set of used nullifier strings
const sessions = new Map();    // sessionId -> { predicates, originId, iat, exp }

export function saveNonce(nonce, payload) { nonces.set(nonce, payload); }
export function getNonce(nonce) { return nonces.get(nonce); }
export function markNonceUsed(nonce) { if (nonces.has(nonce)) nonces.get(nonce).used = true; }
export function removeNonce(nonce) { nonces.delete(nonce); }

export function isNullifierSeen(n) { return nullifiers.has(n); }
export function addNullifier(n) { nullifiers.add(n); }

export function saveSession(id, payload) { sessions.set(id, payload); }
export function getSession(id) { return sessions.get(id); }

export { nonces, nullifiers, sessions };
