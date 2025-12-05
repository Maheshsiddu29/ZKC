import { Router } from "express";
import { challenge } from "../controllers/challenge.js";
import { postVerify } from "../controllers/verify.js";

const router = Router();

router.get("/challenge", challenge);
router.post("/verify", postVerify);

export default router;
