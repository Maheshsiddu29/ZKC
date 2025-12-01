import { Router } from "express";
import { getChallenge } from "../controllers/challenge.js";
import { postVerify } from "../controllers/verify.js";

const router = Router();

router.get("/challenge", getChallenge);   // GET ?host=...&mask=...
router.post("/verify", postVerify);

export default router;
