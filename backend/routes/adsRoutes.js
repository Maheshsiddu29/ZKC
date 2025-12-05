import { Router } from "express";
import { getAd } from "../controllers/ads.js";
import { requireSession } from "../middleware/session.js";

const router = Router();
router.get("/", requireSession, getAd);  // GET /ads
export default router;
