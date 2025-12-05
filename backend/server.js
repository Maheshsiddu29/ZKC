import express from "express";
import zkpRoutes from "./routes/zkpRoutes.js";
import adsRoutes from "./routes/adsRoutes.js";
import eventsRoutes from "./routes/eventsRoutes.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));

// Serve ad images (you may already have this)
app.use("/static", express.static(path.join(__dirname, "static")));

// Serve circuit artifacts (wasm + zkey + vkey if needed)
app.use("/zkp-static", express.static(path.join(__dirname, "..", "build")));

// Serve snarkjs browser bundle
app.use(
  "/zkp-lib",
  express.static(path.join(__dirname, "..", "node_modules/snarkjs/build"))
);


// serve images
app.use("/static", express.static(path.join(__dirname, "static")));

// API routes
app.use("/api/events", eventsRoutes);
app.use("/zkp", zkpRoutes);
app.use("/ads", adsRoutes);

// health + demo HTML
app.get("/health", (req, res) => res.json({ ok: true, now: Date.now() }));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "ad-demo.html"));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`ZKP backend listening on http://localhost:${PORT}`)
);
