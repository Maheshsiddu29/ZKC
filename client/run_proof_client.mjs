import fetch from "node-fetch";
import { groth16 } from "snarkjs";
import path from "node:path";
import { fileURLToPath } from "url";

//
// CONFIG
//
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WASM = path.join(__dirname, "../build/cookie_js/cookie.wasm");
const ZKEY = path.join(__dirname, "../build/cookie_final.zkey");
const SERVER = "http://localhost:4000";

//
// FIELD helper: hex → BN254 field decimal
//
const FIELD_P = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);
const hexToFieldDec = (hex) => (BigInt("0x" + hex) % FIELD_P).toString();

//
// STEP 1 — Fetch challenge from server
//
async function getChallenge(host, mask) {
  const url = `${SERVER}/zkp/challenge?host=${encodeURIComponent(host)}&mask=${mask}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.ok) throw new Error("Challenge error: " + JSON.stringify(json));
  return json;
}

//
// STEP 2 — Build witness input for fullProve
// (match circuit input names + types)
//
function buildInput(ch, user) {
  const nonceField = hexToFieldDec(ch.nonce); // field-reduced decimal

  return {
    // NEW names in your circuit:
    nonce_input: nonceField, // gets copied to nonce_pub
    nonce_int:   nonceField, // used inside Poseidon for nullifier

    origin_id: ch.origin_id,             // server already returns decimal field
    nowYear:   ch.nowYear,
    catMask:   Number(ch.catMask),

    // private attrs
    dobYear:         user.dobYear,
    interestsPacked: user.interestsPacked,
    consentVer:      user.consentVer,
    salt_user:       String(user.salt_user),
  };
}

//
// STEP 3 — Generate ZKP proof
//
async function prove(input) {
  console.log("Generating proof...");
  const { proof, publicSignals } = await groth16.fullProve(input, WASM, ZKEY);
  return { proof, publicSignals };
}

//
// STEP 4 — POST to /zkp/verify
//
async function verifyOnServer(proof, publicSignals) {
  const res = await fetch(`${SERVER}/zkp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proof, publicSignals }),
  });
  return await res.json();
}

//
// MAIN FLOW
//
(async () => {
  try {
    console.log("=== Step 1: Requesting ZKP challenge ===");
    const ch = await getChallenge("google.com", 5);
    console.log("Challenge received:", ch);

    console.log("\n=== Step 2: Building circuit input ===");
    const input = buildInput(ch, {
      dobYear: 2001,
      interestsPacked: 17,
      consentVer: 1,
      salt_user: "987654321",
    });
    console.log("Input to circuit:", input);

    console.log("\n=== Step 3: Proving using circom + snarkjs ===");
    const { proof, publicSignals } = await prove(input);
    console.log("Proof generated.");
    console.log("Public signals:", publicSignals);

    console.log("\n=== Step 4: Sending to /zkp/verify ===");
    const verifyResp = await verifyOnServer(proof, publicSignals);
    console.log("Server verify response:");
    console.log(JSON.stringify(verifyResp, null, 2));
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
