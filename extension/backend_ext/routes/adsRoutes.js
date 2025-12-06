// backend/routes/adsRoutes.js
import express from "express";
import { getAd } from "../controllers/ads.js";

const router = express.Router();

// because server.js mounts it at app.use("/ads", adsRoutes)
router.get("/", getAd);

export default router;
