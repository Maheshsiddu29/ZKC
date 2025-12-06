# API: ZKP Cookie Backend (spec)

## GET /zkp/challenge
Description: Issues a nonce + origin_id + nowYear + catMask to be used as public signals in the ZK proof.

Query parameters:
- host (string) — recommended: eTLD+1 (e.g. example.com). If omitted, uses request hostname.
- mask (integer) — bitmask of categories (0..65535 for NCATS=16).

Response 200:
{
  ok: true,
  nonce: "<hex nonce>",
  origin_id: "<decimal string field>",
  nowYear: 2025,
  catMask: <integer>,
  ttl_ms: 300000
}

Errors:
- 400 Invalid params
- 500 Server error

---

## POST /zkp/verify
Description: Accepts a SNARK proof and publicSignals, verifies them, enforces nonce TTL & single-use, uniqueness of nullifier, origin & mask equality, and returns a short-lived session.

Body:
{
  proof: { /* groth16 proof object */ },
  publicSignals: [ nonce, origin_pub, nowYear_pub, mask_pub, C, nullifier, predAny, predAge18, ... ]
}

Response 200:
{
  ok: true,
  session: "<signed_session_id>",
  predicates: { any: true|false, age18: true|false },
  origin: "<originFieldDecimal>",
  exp: <timestamp ms>
}

Errors:
- 400 malformed proof / mismatch checks (origin/mask)
- 409 nonce expired/used or nullifier replay
- 500 server error

---

Error codes:
- 400 : invalid input / verification failed
- 401 : (for session endpoints later) unauthorized / invalid session
- 403 : revoked
- 409 : replay / stale-nonce

---

Notes:
- Nonce TTL default: 5 minutes (configurable)
- Nullifier uniqueness: permanent (prevents proof replay across sessions)
- Session lifetime: short (5 minutes)
- Server must derive origin_id deterministically via `origin -> sha256 -> field mod p`.
