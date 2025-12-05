import db from "../server/db.js";

const insert = db.prepare(`
  INSERT OR REPLACE INTO campaigns (
    id, name, conditions_json, bid, title, image_url, click_url, active
  ) VALUES (
    @id, @name, @conditions_json, @bid, @title, @image_url, @click_url, @active
  )
`);

insert.run({
  id: "m-rated-shooter",
  name: "Shooter 18+ Gamers",
  conditions_json: JSON.stringify({ age18: true, gaming: true }),
  bid: 2.0,
  title: "M-Rated Shooter",
  image_url: "/static/game18.jpg",
  click_url: "https://example.com/game18",
  active: 1,
});

insert.run({
  id: "tech-hardware",
  name: "Tech Hardware Deals",
  conditions_json: JSON.stringify({ tech: true }),
  bid: 1.5,
  title: "Insane Tech Deals",
  image_url: "/static/tech.jpg",
  click_url: "https://example.com/tech",
  active: 1,
});

console.log("Seeded campaigns into ad_engine.db");

db.close();
