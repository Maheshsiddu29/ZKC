// scripts/test_cookie_multi.mjs
import { groth16 } from "snarkjs";
import fs from "node:fs/promises";
import assert from "node:assert/strict";


const WASM = "build/cookie_js/cookie.wasm";
const ZKEY = "build/cookie_final.zkey";
const VK_PATH = "build/cookie_verification_key.json";
const vk = JSON.parse(await fs.readFile(VK_PATH, "utf8"));
const IDX = { nonce:0, origin:1, nowYear:2, mask:3, C:4, nullifier:5, predAny:6, predAge18:7 };

async function proveAndVerify(input) {
  const { proof, publicSignals } = await groth16.fullProve(input, WASM, ZKEY);
  const ok = await groth16.verify(vk, publicSignals, proof);
  assert.ok(ok, "verification failed");

  const out = {
    nonce: publicSignals[IDX.nonce],
    origin: publicSignals[IDX.origin],
    nowYear: publicSignals[IDX.nowYear],
    mask: publicSignals[IDX.mask],
    C: publicSignals[IDX.C],
    nullifier: publicSignals[IDX.nullifier],
    predAny: Number(publicSignals[IDX.predAny]),
    predAge18: Number(publicSignals[IDX.predAge18]),
    publicSignals
  };
  return out;
}

function logCase(title, out) {
  console.log(`\n=== ${title} ===`);
  console.log(`nonce=${out.nonce} origin=${out.origin} nowYear=${out.nowYear} mask=${out.mask}`);
  console.log(`C=${out.C}`);
  console.log(`nullifier=${out.nullifier}`);
  console.log(`predAny=${out.predAny} predAge18=${out.predAge18}`);
}

(async () => {
  
  const base = {
    nonce:           "111111",
    origin_id:       "12345",
    nowYear:         2025,
    catMask:         5,     
    dobYear:         2001,
    interestsPacked: 17,    
    consentVer:      1,
    salt_user:       "987654321"
  };

  const A = await proveAndVerify(base);
  logCase("A) baseline", A);
  assert.equal(A.predAny, 1, "baseline predAny should be 1");
  assert.equal(A.predAge18, 1, "baseline predAge18 should be 1");

  const B = await proveAndVerify({ ...base, nonce: "222222" });
  logCase("B) different nonce", B);
  assert.equal(A.C, B.C, "C should be stable for same attrs+salt");
  assert.notEqual(A.nullifier, B.nullifier, "nullifier must change with nonce");
  assert.equal(A.predAny, B.predAny);
  assert.equal(A.predAge18, B.predAge18);

  const Cc = await proveAndVerify({ ...base, origin_id: "99999" });
  logCase("C) different origin", Cc);
  assert.equal(A.C, Cc.C, "C should remain same");
  assert.notEqual(A.nullifier, Cc.nullifier, "nullifier must change with origin");

  const D = await proveAndVerify({ ...base, catMask: 2 });
  logCase("D) mask with no intersection", D);
  assert.equal(D.predAny, 0, "predAny should be 0 when mask ∩ interests = ∅");
  assert.equal(A.C, D.C, "C must not change when only mask changes");
  assert.notEqual(A.nullifier, D.nullifier, "nullifier must change when mask changes");

  const E = await proveAndVerify({ ...base, interestsPacked: 16 });
  logCase("E) interests with no intersection", E);
  assert.equal(E.predAny, 0, "predAny should be 0 when interests don't match mask");
  assert.notEqual(A.C, E.C, "C must change when attributes change");
  assert.notEqual(A.nullifier, E.nullifier, "nullifier must change when C changes");

  const F1 = await proveAndVerify({ ...base, dobYear: 2010 }); 
  logCase("F1) age check (dob=2010)", F1);
  assert.equal(F1.predAge18, 0);

  const F2 = await proveAndVerify({ ...base, dobYear: 2000 }); 
  logCase("F2) age check (dob=2000)", F2);
  assert.equal(F2.predAge18, 1);

  console.log("\n All checks passed for multi-category circuit.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});