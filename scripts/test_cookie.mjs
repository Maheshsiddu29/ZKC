
import { groth16 } from "snarkjs";
import fs from "node:fs/promises";
import assert from "node:assert/strict";

const WASM = "build/cookie_js/cookie.wasm";
const ZKEY = "build/cookie_final.zkey";
const VK_PATH = "build/cookie_verification_key.json";

const vk = JSON.parse(await fs.readFile(VK_PATH, "utf8"));

const IDX = { nonce:0, origin:1, nowYear:2, C:3, nullifier:4, predTech:5, predAge18:6 };

async function proveAndVerify(input) {
  const { proof, publicSignals } = await groth16.fullProve(input, WASM, ZKEY);
  const ok = await groth16.verify(vk, publicSignals, proof);
  assert.ok(ok, "verification failed");
  const out = {
    nonce: publicSignals[IDX.nonce],
    origin: publicSignals[IDX.origin],
    nowYear: publicSignals[IDX.nowYear],
    C: publicSignals[IDX.C],
    nullifier: publicSignals[IDX.nullifier],
    predTech: Number(publicSignals[IDX.predTech]),
    predAge18: Number(publicSignals[IDX.predAge18]),
    publicSignals
  };
  return out;
}

function logCase(title, out) {
  console.log(`\n=== ${title} ===`);
  console.log(`nonce=${out.nonce} origin=${out.origin} nowYear=${out.nowYear}`);
  console.log(`C=${out.C}`);
  console.log(`nullifier=${out.nullifier}`);
  console.log(`predTech=${out.predTech} predAge18=${out.predAge18}`);
}

(async () => {
  
  const base = {
    nonce:        "111111",
    origin_id:    "12345",
    nowYear:      2025,
    dobYear:      2001,   
    interestTech: 1,
    consentVer:   1,
    salt_user:    "987654321"
  };
  const A = await proveAndVerify(base);
  logCase("A) baseline", A);

  const B = await proveAndVerify({ ...base, nonce: "222222" });
  logCase("B) different nonce", B);
  assert.equal(A.C, B.C, "C should be stable for same attrs+salt");
  assert.notEqual(A.nullifier, B.nullifier, "nullifier must change with nonce");
  assert.equal(A.predTech, B.predTech);
  assert.equal(A.predAge18, B.predAge18);

  const Cc = await proveAndVerify({ ...base, origin_id: "99999" });
  logCase("C) different origin", Cc);
  assert.equal(A.C, Cc.C, "C should remain same");
  assert.notEqual(A.nullifier, Cc.nullifier, "nullifier must change with origin");

  const D = await proveAndVerify({ ...base, interestTech: 0 });
  logCase("D) interestTech=0", D);
  assert.notEqual(A.C, D.C, "C must change when attrs change");
  assert.notEqual(A.nullifier, D.nullifier, "nullifier must change when C changes");
  assert.equal(D.predTech, 0);

  const E1 = await proveAndVerify({ ...base, dobYear: 2010 }); // 15 y/o → false
  logCase("E1) age check (dob=2010)", E1);
  assert.equal(E1.predAge18, 0);

  const E2 = await proveAndVerify({ ...base, dobYear: 2000 }); // 25 y/o → true
  logCase("E2) age check (dob=2000)", E2);
  assert.equal(E2.predAge18, 1);

  console.log("\n All checks passed.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
