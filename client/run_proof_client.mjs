import fetch from "node-fetch";
import { groth16 } from "snarkjs";
import fs from "fs/promises";
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
// const WASM = path.resolve("build/cookie_js/cookie.wasm");
// const ZKEY = path.resolve("build/cookie_final.zkey");

//
// STEP 1 — Fetch challenge from server
//
async function getChallenge(host, mask) {
  const url = `${SERVER}/zkp/challenge?host=${host}&mask=${mask}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.ok) throw new Error("Challenge error: " + JSON.stringify(json));
  return json;
}

//
// STEP 2 — Build witness input for fullProve
//
function buildInput(challenge, userSecret) {
  const input = {
    // nonce: challenge.nonce,
    nonce_input: challenge.nonce, 
    nonce_int: BigInt("0x" + challenge.nonce).toString(),   
    origin_id: challenge.origin_id,
    nowYear: challenge.nowYear,
    catMask: Number(challenge.catMask),

    // user secrets (private inputs)
    dobYear: userSecret.dobYear,
    interestsPacked: userSecret.interestsPacked,
    consentVer: userSecret.consentVer,
    salt_user: userSecret.salt_user
  };

//   if (!input.nonce.startsWith("0x")) {
//     input.nonce = "0x" + input.nonce;
//   }

  // origin_id is decimal → convert to hex
  if (!input.origin_id.startsWith("0x")) {
    input.origin_id = "0x" + BigInt(input.origin_id).toString(16);
  }

  // salt_user may be numeric or decimal → convert to hex to avoid BigInt parse errors
  if (!input.salt_user.toString().startsWith("0x")) {
    input.salt_user = "0x" + BigInt(input.salt_user).toString(16);
  }

  return input;
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
    body: JSON.stringify({ proof, publicSignals })
  });
  const json = await res.json();
  return json;
}

//
// MAIN FLOW
//
(async () => {
  try {
    console.log("=== Step 1: Requesting ZKP challenge ===");

    const challenge = await getChallenge("google.com", 5);
    console.log("Challenge received:", challenge);

    console.log("\n=== Step 2: Building circuit input ===");

    const input = buildInput(challenge, {
      dobYear: 2001,
      interestsPacked: 17,   // bits
      consentVer: 1,
      salt_user: "987654321"
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
  }
})();
