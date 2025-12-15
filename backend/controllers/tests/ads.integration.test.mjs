// backend/controllers/tests/ads.integration.test.mjs
import request from "supertest";
import app from "../../server.js";
import {
  createSessionPayload,
  signSession,
} from "../../server/zkSession.js";

describe("Ads integration", () => {
  test("GET /ads without zk_session returns fallback / generic ad", async () => {
    const res = await request(app).get("/ads");
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);

    const { ad } = res.body;
    expect(ad).toBeDefined();
    expect(ad.imageUrl).toBeDefined();
  });

  test("GET /ads with gadgets interest and fan query prefers fan/gadgets category", async () => {
    const predicates = {
      any: true,
      age18: true,
      int_gadgets: true,
    };
    const payload = createSessionPayload({
      origin: "123",
      mask: 5,
      predicates,
    });
    const token = signSession(payload);

    const res = await request(app)
      .get("/ads")
      .query({ query: "portable fan" })
      .set("Cookie", [`zk_session=${token}`]);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);

    const { ads } = res.body;
    expect(Array.isArray(ads)).toBe(true);
    expect(ads.length).toBeGreaterThan(0);

    const primary = ads[0];
    expect(["fan_cooling", "gadgets"]).toContain(primary.category);
  });

  test("Campaigns requiring age18 do not break when age18 is false", async () => {
    const predicates = {
      any: true,
      age18: false, // under-age user
      int_gadgets: true,
    };
    const payload = createSessionPayload({
      origin: "123",
      mask: 5,
      predicates,
    });
    const token = signSession(payload);

    const res = await request(app)
      .get("/ads")
      .query({ query: "gaming fan" })
      .set("Cookie", [`zk_session=${token}`]);

    expect(res.statusCode).toBe(200);
    const { ads } = res.body;
    expect(Array.isArray(ads)).toBe(true);
    expect(ads.length).toBeGreaterThan(0);
  });
});

describe("Events integration", () => {
  test("POST /api/events/search echoes predicates from zk_session", async () => {
    const predicates = { any: true, int_fitness: true };
    const payload = createSessionPayload({
      origin: "123",
      mask: 5,
      predicates,
    });
    const token = signSession(payload);

    const res = await request(app)
      .post("/api/events/search")
      .set("Cookie", [`zk_session=${token}`])
      .send({ query: "massage gun" });

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.fromSession).toBe(true);
    expect(res.body.predicates).toEqual(predicates);
  });
});
