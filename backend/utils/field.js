import crypto from "crypto";

export const SNARK_FIELD_PRIME = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

// SHA256(host) -> BigInt mod FIELD
export function originToField(host) {
  // canonicalize: eTLD+1 ideally, but for demo we accept host param; caller should pass eTLD+1
  const h = crypto.createHash("sha256").update(host).digest("hex");
  const v = BigInt("0x" + h);
  return v % SNARK_FIELD_PRIME;
}

// map mask (number) into field type (BigInt)
export function toField(n) { return BigInt(n) % SNARK_FIELD_PRIME; }
