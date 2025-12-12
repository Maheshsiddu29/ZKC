// backend/routes/eventsRoutes.js
import express from "express";
import { searchEvents } from "../controllers/events.js";

const router = express.Router();

// POST /api/events/search
router.post("/search", searchEvents);

export default router;
