// backend/routes/eventsRoutes.js
import express from "express";
import {
  createSessionPayload,
  signSession,
  setZkSessionCookie,
} from "../server/zkSession.js";

const router = express.Router();

function classifySearch(query) {
  const q = (query || "").toLowerCase();

  const predicates = {
    any: true,
    age18: true,
    tech: false,
    gaming: false,
  };

  if (
    q.includes("laptop") ||
    q.includes("gpu") ||
    q.includes("graphics") ||
    q.includes("pc") ||
    q.includes("processor") ||
    q.includes("monitor") ||
    q.includes("keyboard") ||
    q.includes("mouse")
  ) {
    predicates.tech = true;
  }

  if (
    q.includes("game") ||
    q.includes("gaming") ||
    q.includes("ps5") ||
    q.includes("xbox") ||
    q.includes("console")
  ) {
    predicates.gaming = true;
  }

  return predicates;
}

// POST /api/events/search
router.post("/search", (req, res) => {
  const { query } = req.body;

  const predicates = classifySearch(query);
  const origin = req.headers.host || "localhost:4000";
  const mask = 0b1111;

  const payload = createSessionPayload({ origin, predicates, mask });
  const sessionString = signSession(payload);

  setZkSessionCookie(res, sessionString);

  res.json({
    ok: true,
    predicates,
    origin,
  });
});

export default router;
