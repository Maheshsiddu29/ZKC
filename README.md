# ZKC

Install these globally 
-> Rust
-> Circom 2.2

then Npm install 

# ZKC — Circuits-Only Onboarding (Clone → Compile → Prove → Verify)

This guide is for teammates (or anyone cloning the repo) to set up **only the Circom/SnarkJS part** of the project. No server required.

> Repo: `https://github.com/Maheshsiddu29/ZKC`  
> Branch: **`ZKC-phase1`**  
> Circuit: `circuits/cookie.circom`  
> Build dir: `build/`

---

## 0) Prerequisites

- **Node.js** v18+ (or v20+). Check: `node -v`
- **circom** v2.x on PATH. Check: `circom --version`
- **git**

Optional but helpful:
- `jq` for pretty-printing JSON.

> If you don’t have `circom`, install a prebuilt binary for your OS or build from source (Circom v2).

---

## 1) Clone the repo & switch branch

```bash
git clone https://github.com/Maheshsiddu29/ZKC.git
cd ZKC
git fetch origin
git checkout ZKC-phase1
```

---

## 2) Install project dependencies (circuits only)

```bash
npm install --save-dev snarkjs circomlib
```
- **snarkjs**: CLI + JS library for Groth16.
- **circomlib**: standard circuit components (Poseidon, comparators, etc.).

---

## 3) Compile the circuit

```bash
mkdir -p build

# Compile cookie.circom; -l node_modules lets circom find circomlib includes
circom circuits/cookie.circom --r1cs --wasm --sym -o build -l node_modules

# sanity check
ls build/cookie.r1cs build/cookie_js/cookie.wasm
```

Artifacts:
- `build/cookie.r1cs` – constraints
- `build/cookie_js/cookie.wasm` – witness generator
- `build/cookie.sym` – symbols (debug)

Optional info:
```bash
snarkjs r1cs info build/cookie.r1cs
```

---

## 4) Create input & generate the witness

```bash
cat > build/cookie_input.json << 'EOF'
{
  "nonce":        "111111",
  "origin_id":    "12345",
  "nowYear":      2025,
  "dobYear":      2001,
  "interestTech": 1,
  "consentVer":   1,
  "salt_user":    "987654321"
}
EOF

# Build witness
snarkjs wtns calculate build/cookie_js/cookie.wasm build/cookie_input.json build/cookie_witness.wtns

# (optional) export witness to JSON for inspection
snarkjs wtns export json build/cookie_witness.wtns build/cookie_witness.json
```

---

## 5) Groth16 trusted setup (Phase 1 + Phase 2)

You can reuse the same Powers-of-Tau (Phase 1) across circuits as long as it’s big enough.  
This circuit has **~1530 constraints**, so **pot12** (4096) is sufficient.

### 5a) If you **don’t** already have `build/pot12_final.ptau` (run once)
```bash
snarkjs powersoftau new bn128 12 build/pot12_0000.ptau -v
snarkjs powersoftau contribute build/pot12_0000.ptau build/pot12_0001.ptau -v
snarkjs powersoftau prepare phase2 build/pot12_0001.ptau build/pot12_final.ptau -v
```

### 5b) Circuit-specific Phase 2 (run whenever the circuit changes)
```bash
snarkjs groth16 setup build/cookie.r1cs build/pot12_final.ptau build/cookie_0000.zkey
snarkjs zkey contribute build/cookie_0000.zkey build/cookie_final.zkey -v
snarkjs zkey export verificationkey build/cookie_final.zkey build/cookie_verification_key.json
```

Outputs:
- `build/cookie_final.zkey` – proving key
- `build/cookie_verification_key.json` – verification key (for verification step)

> **Redo Phase 2** if you change constraints or the number/order of public outputs.

---

## 6) Prove & Verify (no server needed)

```bash
snarkjs groth16 prove  build/cookie_final.zkey build/cookie_witness.wtns build/cookie_proof.json build/cookie_public.json
snarkjs groth16 verify build/cookie_verification_key.json build/cookie_public.json build/cookie_proof.json
# Expect: OK
```

Inspect what the verifier sees:
```bash
cat build/cookie_public.json | sed 's/,/,\n/g' || cat build/cookie_public.json
```

**publicSignals order (from your circuit):**
1. `nonce_pub`  
2. `origin_pub`  
3. `nowYear_pub`  
4. `C`  
5. `nullifier`  
6. `predTech`  
7. `predAge18`

---

## 7) Troubleshooting

- **P1014 include not found** → add `-l node_modules` to `circom` and ensure `npm i -D circomlib`.
- **ENOENT input/witness** → double-check paths (keep input JSON in `build/` as shown).
- **Powers-of-Tau too small** → create larger PoT (e.g., 15): use `bn128 15` and re-run Phase 1.
- **Changed circuit** → redo Phase 2 (`groth16 setup` + `zkey contribute` + export VK).

---

## 8) Keep heavy artifacts out of Git

Add to `.gitignore`:
```
build/
*.ptau
*.zkey
*.wasm
witness.wtns
proof.json
public.json
node_modules/
.DS_Store
```

---

## 9) One-command bootstrap (optional)

Run the provided script to compile, generate PoT if missing, do Phase 2, create witness, and prove/verify in one go:

```bash
bash scripts/bootstrap_circuits.sh
```

