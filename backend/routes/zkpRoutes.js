// backend/routes/zkpRoutes.js
import { Router } from "express";
import { challenge } from "../controllers/challenge.js";
import { verify } from "../controllers/verify.js";

const r = Router();

r.get("/challenge", challenge);
r.post("/verify", verify);

export default r;
