// Tiny demo inventory (mask bits must match your categories)
const INVENTORY = [
  { id: "tech-1", title: "Next-Gen GPU Deals", img: "/static/tech1.jpg", click: "https://example.com/tech",  categoryMask: 1 << 0, ageRestricted: false },
  { id: "sports-1", title: "Pro League Jerseys", img: "/static/sports1.jpg", click: "https://example.com/sports", categoryMask: 1 << 1, ageRestricted: false },
  { id: "gaming-18", title: "M-Rated Shooter", img: "/static/game18.jpg", click: "https://example.com/game18", categoryMask: 1 << 2, ageRestricted: true },
  { id: "generic", title: "Welcome Offer", img: "/static/generic.jpg", click: "https://example.com", categoryMask: 0, ageRestricted: false },
];

export function getAd(req, res) {
  const { predicates, mask } = req.zk || {};
  if (!predicates) return res.status(401).json({ ok: false, error: "no_predicates" });

  // 1) filter by age
  let pool = INVENTORY.filter(x => !x.ageRestricted || predicates.age18);

  // 2) category match if user proved "any"
  if (predicates.any) {
    pool = pool.filter(x => x.categoryMask === 0 || ((x.categoryMask & mask) !== 0));
  }

  // fallback to generic if empty
  if (pool.length === 0) pool = INVENTORY.filter(x => x.id === "generic");

  // naive pick
  const ad = pool[Math.floor(Math.random() * pool.length)];

  res.json({
    ok: true,
    ad: {
      id: ad.id,
      title: ad.title,
      imageUrl: ad.img,
      clickUrl: ad.click,
    },
    ttl: 60, // seconds
  });
}
