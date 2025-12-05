// backend/controllers/ads.js
import { verifySession } from "../server/zkSession.js";

const ADS = {
  generic: {
    id: "generic",
    title: "Welcome to ZK-City",
    imageUrl: "/static/generic.jpg",
    clickUrl: "https://example.com",
  },
  gaming18: {
    id: "gaming-18",
    title: "M-Rated Shooter",
    imageUrl: "/static/game18.jpg",
    clickUrl: "https://example.com/game18",
  },
  tech: {
    id: "tech-deals",
    title: "Insane Tech Deals",
    imageUrl: "/static/tech.jpg",
    clickUrl: "https://example.com/tech",
  },
};

function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  const parts = header.split(";").map((c) => c.trim());
  for (const part of parts) {
    if (part.startsWith(name + "=")) {
      return decodeURIComponent(part.substring(name.length + 1));
    }
  }
  return null;
}

// helper so it works even if predicates are "true"/1 instead of true
const isTrue = (v) => v === true || v === "true" || v === 1 || v === "1";

export function getAd(req, res) {
  const ttl = 60;

  const token = getCookie(req, "zk_session");
  let payload = null;

  if (token) {
    payload = verifySession(token);
  }

  const predicates = payload?.predicates || {};

  let ad = ADS.generic;

  const age18 = isTrue(predicates.age18);
  const gaming = isTrue(predicates.gaming);
  const tech = isTrue(predicates.tech);

  // 🎯 Priority:
  // 1) Shooter only if age18 + gaming
  // 2) Tech ad if tech true (and not gaming 18+)
  // 3) Otherwise generic
  if (age18 && gaming) {
    ad = ADS.gaming18;
  } else if (tech) {
    ad = ADS.tech;
  } else {
    ad = ADS.generic;
  }

  res.json({
    ok: true,
    ad,
    ttl,
  });
}
