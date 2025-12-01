import express from "express";
import bodyParser from "body-parser";
import zkpRoutes from "./routes/zkpRoutes.js";

const app = express();
app.use(bodyParser.json({ limit: "1mb" }));

app.use("/zkp", zkpRoutes);

// basic health
app.get("/health", (req, res) => res.json({ ok: true, now: Date.now() }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`ZKP backend listening on ${PORT}`));
