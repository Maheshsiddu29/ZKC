# Zero-Knowledge Cookie (ZKC): A Privacy-Preserving Framework for Ad Personalization

## Abstract

rivacy concerns around online advertising are inevitable
since tracking cookies and user profiling are needed to serve
targeted advertisements. We present a novel approach to
this space, Zero-Knowledge Cookies (ZKC), to enable per-
sonalized advertising with privacy preservation via zero-
knowledge proofs. Our scheme allows users to prove they
have certain attributes (age group, interests) without reveal-
ing their confidential data. We construct ZKC based on a
Groth16 zk-SNARK, allowing a browser to obtain a signed
“zero-knowledge cookie” with ad-targeting predicates (inter-
est segments, age verifications) that occur from a user’s local
profile and reveal only what’s needed without the profile.
This cookie allows the ad server to personalize its response as
only the needed predicates are revealed to prevent receiving
and being chosen for interest irrelevance scoring. We show
that ZKC works as a first step towards privacy-preserving
personalized advertising in the wild. We achieved the results
with metrics that cn be compared to real world traditional
cookie systems, like like keeping the cookie size limit below
4kb , generating and proving the proofs with in 300-350 ms ,
fetching and displaying ads in 2-5 ms.

**Keywords:** Zero-knowledge proofs, privacy-preserving ad-
vertising, zk-SNARKs, Groth16, ad targeting predicates

---

## 1. Introduction

Today, digital advertising is driven by user data collection, cookie storage, and behavioral profiling. The Ad Industry heavily relies on personalized ads. It uses user data to show relevant products, content and services. Due to this data-driven targeting approach, ads are more relevant, and hence generate a high return on investment for advertisers. They have higher click-through and conversion rates as wasting impressions on uninterested users is avoided. 

However,this efficiency in ad targeting comes at the price of user privacy. Personalization requires collecting detailed behavioral data, such as browsing history, searches, location, and even device fingerprints. In this system, the user's sensitive information is leaked to multiple parties. Persistent identifiers like cookies can link activity across multiple sites. This is called cross site tracking, and it can build a comprehensive picture of a user’s behavior without their consent. Centralized storage of behavioral profiles or cookies can be hacked, exposing user’s private information. This leaked information can be used for identity theft or phishing attacks. So, even though users benefit from personalized experiences, each increment in personalization comes at the cost of privacy exposure.

In this paper, we propose a new system, that not only provides personalized ad experience to users, but also preserves the users privacy, and does so without breaking the ad market. Our approach enables targeted ad delivery, without revealing raw user data. 

Academic proposals such as Adnostic and Privad have explored client-side profiling. In this approach, the browser builds a behavioral profile locally. These systems are effective and do significantly limit the leakage of personal data. However, they do not use formal cryptographic proofs, and rely on trusting the client software.

A notable recent concept called Zero-Knowledge Advertising (ZKA) has recently been introduced in this domain. Our work explores similar concepts and provides a concrete implementation in the form of Zero-Knowledge Cookies.

---


## 3. Installation and Setup

### 3.1 Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager
- Circom compiler (for circuit compilation)

### 3.2 Installation

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install client dependencies
cd ../client
npm install
```

### 3.3 Circuit Compilation

The zero-knowledge circuits must be compiled before use:

```bash
# Compile cookie circuit
circom Circuits/cookie.circom --r1cs --wasm --sym -o build/

# Generate trusted setup (powers of tau)
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

# Generate proving and verification keys
snarkjs groth16 setup build/cookie.r1cs pot12_final.ptau build/cookie_0000.zkey
snarkjs zkey contribute build/cookie_0000.zkey build/cookie_0001.zkey --name="1st Contributor Name" -v
snarkjs zkey export verificationkey build/cookie_0001.zkey build/cookie_verification_key.json
snarkjs zkey export bellman build/cookie_0001.zkey build/cookie_final.zkey
```

### 3.4 Database Initialization

```bash
cd backend
node scripts/initAdDb.js
node scripts/import_products.mjs
```

### 3.5 Running the Server

```bash
cd backend
node server.js
```

The server will start on `http://localhost:4000` by default.

---

## 4. API Documentation

### 4.1 Challenge Endpoint

**GET** `/zkp/challenge`

Issues a cryptographic challenge for proof generation.

**Query Parameters:**
- `host` (string, required): Domain identifier (e.g., "example.com")
- `mask` (integer, optional): Category bitmask (0-65535 for 16 categories)

**Response:**
```json
{
  "ok": true,
  "nonce": "<hex nonce>",
  "origin_id": "<decimal field>",
  "nowYear": 2025,
  "catMask": 5,
  "ttl_ms": 300000
}
```

### 4.2 Verification Endpoint

**POST** `/zkp/verify`

Verifies a zero-knowledge proof and establishes a session.

**Request Body:**
```json
{
  "proof": { /* proof object */ },
  "publicSignals": [
    "nonce",
    "origin_pub",
    "nowYear_pub",
    "mask_pub",
    "C",
    "nullifier",
    "predAny",
    "predAge18",
    "predAge25",
    "predAge35",
    "intHomeKitchen",
    "intPersonalCare",
    "intBeauty",
    "intFitness",
    "intGadgets",
    "hiIntentRecent",
    "cartAbandoner",
    "recentBuyer"
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "session": "<signed_session_token>",
  "predicates": {
    "age18": true,
    "age25": false,
    "age35": false,
    "int_home_kitchen": true,
    "int_personal_care": false,
    "int_beauty": false,
    "int_fitness": true,
    "int_gadgets": false,
    "hi_intent_recent": false,
    "cart_abandoner": false,
    "recent_buyer": false,
    "any": true
  },
  "origin": "<origin_field>",
  "exp": 1234567890
}
```

### 4.3 Ad Serving Endpoint

**GET** `/ads`

Retrieves personalized advertisements based on session predicates.

**Query Parameters:**
- `query` (string, optional): Search query for contextual targeting

**Response:**
```json
{
  "ok": true,
  "ad": {
    "id": "product_123",
    "title": "Product Name",
    "imageUrl": "/static/cat-fitness_massage.jpg",
    "clickUrl": "https://example.com/product"
  },
  "ads": [ /* array ads */ ],
  "ttl": 60
}
```

---



## 7. Testing

Run the test suite:

```bash
cd backend
npm test
```

Test files:
- `controllers/tests/ads.integration.test.mjs`: Integration tests for ad serving
- `controllers/tests/ads.unit.test.mjs`: Unit tests for ad logic
- `controllers/tests/zkSession.test.mjs`: Session management tests

---



## 10. License

See [LICENSE](LICENSE) file for details.

---



## 12. Contact

For questions, issues, or contributions, please open an issue on the project repository.

---

