# Zero-Knowledge Cookie (ZKC): A Privacy-Preserving Framework for Ad Personalization

## Abstract

This paper presents Zero-Knowledge Cookie (ZKC), a novel privacy-preserving framework for online advertising personalization that leverages zero-knowledge proofs (ZKPs) to enable targeted advertising without exposing user personal data. Unlike traditional cookie-based systems that require sharing sensitive user information with advertising servers, ZKC allows users to prove possession of certain attributes (age, interests, intent segments) without revealing the underlying data. The system implements Groth16 zk-SNARKs using Circom circuits to generate cryptographic proofs that can be verified by advertising servers, enabling personalized ad delivery while maintaining user privacy. Our implementation demonstrates that privacy-preserving ad targeting is feasible with acceptable performance overhead, providing a practical alternative to current privacy-invasive advertising models.

**Keywords:** Zero-Knowledge Proofs, Privacy-Preserving Advertising, zk-SNARKs, Groth16, Cookie Alternatives, User Privacy

---

## 1. Introduction

### 1.1 Background and Motivation

The digital advertising ecosystem has long relied on tracking technologies, most notably HTTP cookies, to deliver personalized advertisements to users. Traditional advertising systems collect and store extensive user profiles containing demographic information, browsing history, interests, and behavioral data. While this approach enables effective ad targeting and higher conversion rates, it raises significant privacy concerns:

1. **Data Exposure**: Users' personal information is transmitted to and stored by advertising servers, creating privacy risks and potential for data breaches.

2. **Cross-Site Tracking**: Third-party cookies enable tracking across multiple websites, building comprehensive user profiles without explicit consent.

3. **Regulatory Compliance**: Growing privacy regulations such as GDPR, CCPA, and others require explicit consent and limit data collection practices.

4. **User Trust**: Privacy-conscious users increasingly employ ad blockers and privacy tools, reducing the effectiveness of traditional advertising systems.

The advertising industry faces a fundamental tension: effective personalization requires user data, but users and regulators demand greater privacy protection. This challenge has led to the exploration of privacy-preserving technologies that can reconcile these competing interests.

### 1.2 Problem Statement

Current advertising systems face a critical limitation: they require users to reveal their personal attributes (age, interests, purchase intent) to advertising servers to receive personalized content. This creates a privacy-utility tradeoff where users must choose between privacy and personalization. The problem is further exacerbated by:

- **Information Asymmetry**: Users cannot verify how their data is used or stored
- **Data Proliferation**: User data is replicated across multiple advertising networks
- **Replay Attacks**: Traditional cookies can be stolen or replayed across sessions
- **Lack of Transparency**: Users have limited visibility into what data is collected and how it's used

### 1.3 Our Contribution

This work introduces Zero-Knowledge Cookie (ZKC), a cryptographic framework that enables privacy-preserving ad personalization through zero-knowledge proofs. Our system allows users to:

1. **Prove Attributes Without Revealing Them**: Users generate cryptographic proofs demonstrating possession of certain attributes (e.g., age ≥ 18, interest in specific product categories) without disclosing the underlying data.

2. **Maintain Session State Securely**: The system uses nullifiers to prevent proof replay attacks while maintaining user anonymity across sessions.

3. **Enable Fine-Grained Targeting**: Advertisers can target users based on demographic predicates (age ranges), interest categories, and intent segments (high-intent, cart abandoners, recent buyers) without accessing raw user data.

4. **Provide Cryptographic Guarantees**: The use of zk-SNARKs provides mathematical guarantees that proofs are valid without revealing private inputs.

### 1.4 System Overview

ZKC operates through a challenge-response protocol:

1. **Challenge Phase**: The advertising server issues a cryptographic challenge (nonce) along with public parameters (origin identifier, current year, category mask).

2. **Proof Generation**: The client generates a zero-knowledge proof using private user attributes (date of birth, interests, consent verification, salt) and the server's challenge.

3. **Proof Verification**: The server verifies the proof using a public verification key, ensuring:
   - The proof is cryptographically valid
   - The challenge nonce is fresh and unused
   - The nullifier hasn't been seen before (preventing replay attacks)
   - The origin and category mask match the issued challenge

4. **Session Establishment**: Upon successful verification, the server issues a short-lived session token containing only the verified predicates (not the underlying data), which is used for ad targeting.

### 1.5 Key Features

- **Privacy-Preserving**: User personal data never leaves the client device in plaintext
- **Selective Disclosure**: Users can prove specific attributes without revealing others
- **Replay Protection**: Nullifiers prevent proof reuse across sessions
- **Origin Binding**: Proofs are cryptographically bound to specific domains
- **Time-Limited Sessions**: Short-lived session tokens (5 minutes) limit exposure
- **Fine-Grained Predicates**: Support for age verification, interest categories, and intent segments

### 1.6 Paper Organization

The remainder of this document is organized as follows:

- **Section 2**: Related Work and Background
- **Section 3**: System Architecture and Design
- **Section 4**: Cryptographic Protocols
- **Section 5**: Implementation Details
- **Section 6**: Security Analysis
- **Section 7**: Performance Evaluation
- **Section 8**: Use Cases and Applications
- **Section 9**: Limitations and Future Work
- **Section 10**: Conclusion

---

## 2. System Architecture

### 2.1 Components

The ZKC system consists of three main components:

1. **Client-Side Proof Generator**: Browser-based JavaScript application that generates zero-knowledge proofs using user's private attributes
2. **Backend Server**: Express.js server that issues challenges, verifies proofs, and serves personalized advertisements
3. **Zero-Knowledge Circuit**: Circom circuit that defines the proof logic and predicate computations

### 2.2 Technology Stack

- **Zero-Knowledge Proofs**: Groth16 zk-SNARKs via snarkjs
- **Circuit Language**: Circom 2.1.6
- **Backend**: Node.js with Express.js
- **Database**: SQLite for ad campaigns and session storage
- **Cryptography**: Poseidon hash function for commitments and nullifiers

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

## 5. Circuit Design

### 5.1 Private Inputs

- `dobYear`: User's year of birth
- `interestsPacked`: Bit-packed interest categories
- `consentVer`: Consent verification flag
- `salt_user`: User-specific salt for commitment

### 5.2 Public Inputs

- `origin_id`: Domain identifier
- `nowYear`: Current year
- `catMask`: Category bitmask
- `nonce_int`: Challenge nonce

### 5.3 Public Outputs

- `nonce_pub`: Public nonce
- `origin_pub`: Public origin
- `nowYear_pub`: Public year
- `mask_pub`: Public category mask
- `C`: User commitment (hash of private attributes)
- `nullifier`: Unique identifier preventing replay attacks
- `predAge18`, `predAge25`, `predAge35`: Age predicates
- `predAny`: Interest match predicate
- `intHomeKitchen`, `intPersonalCare`, `intBeauty`, `intFitness`, `intGadgets`: Interest predicates
- `hiIntentRecent`, `cartAbandoner`, `recentBuyer`: Intent segment predicates

### 5.4 Circuit Logic

The circuit performs the following computations:

1. **Age Verification**: Computes age predicates by comparing `dobYear + age` with `nowYear + 1`
2. **Interest Matching**: Performs bitwise AND between category mask and user interests
3. **Commitment Generation**: Creates a Poseidon hash of private attributes
4. **Nullifier Generation**: Creates a unique nullifier from commitment, nonce, origin, and mask

---

## 6. Security Properties

### 6.1 Privacy Guarantees

- **Zero-Knowledge**: The proof reveals nothing about private inputs beyond what is explicitly disclosed in public outputs
- **Selective Disclosure**: Users control which predicates are revealed
- **Unlinkability**: Different sessions cannot be linked to the same user (unless nullifier is reused)

### 6.2 Security Guarantees

- **Replay Protection**: Nullifiers prevent proof reuse
- **Nonce Freshness**: Time-limited nonces (5 minutes) prevent stale proof attacks
- **Origin Binding**: Proofs are cryptographically bound to specific domains
- **Session Integrity**: HMAC-signed session tokens prevent tampering

### 6.3 Threat Model

The system protects against:
- Passive adversaries attempting to learn user attributes
- Proof replay attacks
- Session token forgery
- Cross-origin proof reuse

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

## 8. Performance Considerations

### 8.1 Proof Generation

- Client-side proof generation typically takes 2-5 seconds
- Proof size: ~200 bytes (Groth16)
- Verification time: <10ms on server

### 8.2 Scalability

- Nonce storage: In-memory with TTL cleanup
- Nullifier storage: Persistent database for replay prevention
- Session storage: Ephemeral, expires after 5 minutes

---

## 9. Limitations and Future Work

### 9.1 Current Limitations

- Proof generation requires significant client-side computation
- Limited to 16 interest categories (extensible)
- Session lifetime is fixed at 5 minutes
- No support for dynamic predicate updates without new proof

### 9.2 Future Enhancements

- Support for more complex predicates (location, device type)
- Batch proof generation for multiple attributes
- Privacy-preserving analytics
- Integration with existing ad networks
- Mobile app support

---

## 10. License

See [LICENSE](LICENSE) file for details.

---

## 11. Citation


## 12. Contact

For questions, issues, or contributions, please open an issue on the project repository.

---

