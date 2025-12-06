import express from "express";
import cors from "cors";
import zkpRoutes from "./routes/zkpRoutes.js";
import adsRoutes from "./routes/adsRoutes.js";
import eventsRoutes from "./routes/eventsRoutes.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Allow extension to access backend
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "5mb" }));

// serve circuit artifacts (wasm + zkey + vkey)
app.use("/zkp-static", express.static(path.join(__dirname, "..", "build")));

// serve snarkjs browser bundle
app.use(
  "/zkp-lib",
  express.static(path.join(__dirname, "..", "node_modules/snarkjs/build"))
);

// serve images (ads)
app.use("/static", express.static(path.join(__dirname, "static")));

// API routes
app.use("/api/events", eventsRoutes);
app.use("/zkp", zkpRoutes);
app.use("/ads", adsRoutes);

// health check
app.get("/health", (req, res) => res.json({ ok: true, now: Date.now() }));

// load verification key on startup
const vkPath = path.join(__dirname, "..", "..", "build", "cookie_verification_key.json");

if (fs.existsSync(vkPath)) {
  console.log("VK loaded.");
} else {
  console.log("❌ VK missing at:", vkPath);
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`ZKP backend listening on http://localhost:${PORT}`)
);
