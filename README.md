Here’s an updated README you can drop in, with **Part 2** added for “run the server + type products in the browser”.

You can copy–paste this over your current `README.md` and tweak any wording if needed.

---

````markdown
# ZKC

Privacy-preserving ad targeting with **Zero-Knowledge Cookies (ZK-Cookie)**.  
Circom circuits + SnarkJS + Node/Express demo server that shows different ads based on zk-predicates (age, tech interest, etc.).

---

## 0) Global prerequisites

Install these **globally**:

- **Rust** (required to build Circom from source)
- **Circom 2.2** (or any 2.x, but 2.2+ recommended)

Check:

```bash
rustc --version
circom --version
````

Then install project dependencies (once per clone):

```bash
npm install
```

---

# Part 1 — Circuits-Only Onboarding

*Clone → Compile → Prove → Verify*

This section is for teammates (or anyone cloning the repo) to set up **only the Circom/SnarkJS part** of the project. No server required.

> Repo: `https://github.com/Maheshsiddu29/ZKC`
> Branch: **`ZKC-phase1`**
> Circuit: `circuits/cookie.circom`
> Build dir: `build/`

---

## 1) Prerequisites (Circuits)

* **Node.js** v18+ (or v20+). Check: `node -v`
* **circom** v2.x on PATH. Check: `circom --version`
* **git**

Optional but helpful:

* `jq` for pretty-printing JSON.

> If you don’t have `circom`, install a prebuilt binary for your OS or build from source (Circom v2).

---

## 2) Clone the repo & switch branch

```bash
git clone https://github.com/Maheshsiddu29/ZKC.git
cd ZKC
git fetch origin
git checkout ZKC-phase1
```

---

## 3) Install circuit dependencies

If they’re not already in `package.json`, install:

```bash
npm install --save-dev snarkjs circomlib
```

* **snarkjs**: CLI + JS library for Groth16.
* **circomlib**: standard circuit components (Poseidon, comparators, etc.).

(If `snarkjs` and `circomlib` are already present in `devDependencies`, you just need `npm install` from the repo root.)

---

## 4) Compile the circuit

```bash
mkdir -p build

# Compile cookie.circom; -l node_modules lets circom find circomlib includes
circom circuits/cookie.circom --r1cs --wasm --sym -o build -l node_modules

# sanity check
ls build/cookie.r1cs build/cookie_js/cookie.wasm
```

Artifacts:

* `build/cookie.r1cs` – constraints
* `build/cookie_js/cookie.wasm` – witness generator
* `build/cookie.sym` – symbols (debug)

Optional info:

```bash
snarkjs r1cs info build/cookie.r1cs
```

---

## 5) Create input & generate the witness

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

## 6) Groth16 trusted setup (Phase 1 + Phase 2)

You can reuse the same Powers-of-Tau (Phase 1) across circuits as long as it’s big enough.
This circuit has **~1530 constraints**, so **pot12** (4096) is sufficient.

### 6a) If you **don’t** already have `build/pot12_final.ptau` (run once)

```bash
snarkjs powersoftau new bn128 12 build/pot12_0000.ptau -v
snarkjs powersoftau contribute build/pot12_0000.ptau build/pot12_0001.ptau -v
snarkjs powersoftau prepare phase2 build/pot12_0001.ptau build/pot12_final.ptau -v
```

### 6b) Circuit-specific Phase 2 (run whenever the circuit changes)

```bash
snarkjs groth16 setup build/cookie.r1cs build/pot12_final.ptau build/cookie_0000.zkey
snarkjs zkey contribute build/cookie_0000.zkey build/cookie_final.zkey -v
snarkjs zkey export verificationkey build/cookie_final.zkey build/cookie_verification_key.json
```

Outputs:

* `build/cookie_final.zkey` – proving key
* `build/cookie_verification_key.json` – verification key (for verification step)

> **Redo Phase 2** if you change constraints or the number/order of public outputs.

---

## 7) Prove & Verify (no server needed)

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

## 8) Troubleshooting

* **P1014 include not found**
  → add `-l node_modules` to `circom` and ensure `npm i -D circomlib`.

* **ENOENT input/witness**
  → double-check paths (keep input JSON in `build/` as shown).

* **Powers-of-Tau too small**
  → create larger PoT (e.g., 15): use `bn128 15` and re-run Phase 1.

* **Changed circuit**
  → redo Phase 2 (`groth16 setup` + `zkey contribute` + export VK).

---

## 9) Keep heavy artifacts out of Git

Add to `.gitignore`:

```gitignore
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

## 10) One-command bootstrap (optional)

Run the provided script to compile, generate PoT if missing, do Phase 2, create witness, and prove/verify in one go:

```bash
bash scripts/bootstrap_circuits.sh
```

---

# Part 2 — Run the ZK-Cookie Demo Server

*Proof → Session cookie → Targeted ads in the browser*

This section takes you from **circuits** to a **running server** where you can type products and see dynamic ads.

> Server: Node.js / Express
> Default port: **4000**
> ZK session cookie: `zk_session`

---

## 11) Install server deps

If you haven’t already:

```bash
# from repo root
npm install
```

This installs:

* Express / HTTP server code
* Any middleware (cookies, JWT, etc.)
* Frontend assets for the demo page
* sqllite and all the required packages

---

## 12) Run the server 

Go root ZKC folder path and Run this command
node backend/server.js

and click on the http://localhost:4000 link , this should redirect you to our demo page

---

## 19) Branches

* **`ZKC-phase1`** — Circuits-only setup (this README’s Part 1).
* **`ZKC-ad-display`** — Ad-display / frontend + server integration (this README’s Part 2 is targeted at this branch).

When working on ad logic / dynamic product-based targeting, make sure you’re on:

```bash
git checkout ZKC-ad-display
```

---

```


