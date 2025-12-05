// backend/server.js
import express from "express";
import zkpRoutes from "./routes/zkpRoutes.js";
import adsRoutes from "./routes/adsRoutes.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.use("/zkp", zkpRoutes);
app.get("/health", (req, res) => res.json({ ok: true, now: Date.now() }));
app.use("/ads", adsRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`ZKP backend listening on http://localhost:${PORT}`));
