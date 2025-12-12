// backend/utils/field.js
import crypto from "node:crypto";

export const SNARK_FIELD_PRIME = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

/** Normalize many input types into a BN254 field **decimal string** */
export function toField(x) {
  if (typeof x === "bigint") return (x % SNARK_FIELD_PRIME).toString();
  if (typeof x === "number") return (BigInt(x) % SNARK_FIELD_PRIME).toString();
  if (typeof x === "string") {
    let s = x.trim();
    // accept hex (with/without 0x) or decimal
    if (s.startsWith("0x") || /^[0-9a-fA-F]+$/.test(s)) {
      if (!s.startsWith("0x")) s = "0x" + s;
      return (BigInt(s) % SNARK_FIELD_PRIME).toString();
    }
    return (BigInt(s) % SNARK_FIELD_PRIME).toString(); // decimal string
  }
  throw new Error("toField: unsupported input type");
}

/** hex (no 0x needed) -> field decimal string */
export function hexToField(hex) {
  return toField(hex.startsWith("0x") ? hex : "0x" + hex);
}

/** host -> sha256(hostname) -> field decimal string */
export function originToField(host) {
  const hostname = new URL(`http://${host}`).hostname;
  const h = crypto.createHash("sha256").update(hostname).digest("hex");
  return toField("0x" + h);
}
