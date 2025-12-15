import {
  inferCategory,
  categoryToInterestKey,
  matchesConditions,
  scoreCampaign,
} from "../ads.js";

describe("inferCategory", () => {
  test("classifies fan products as fan_cooling", () => {
    const row = { id: "1", title: "USB mini fan", keywords: "cooling fan" };
    expect(inferCategory(row)).toBe("fan_cooling");
  });

  test("classifies massage guns as fitness_massage", () => {
    const row = { id: "2", title: "Deep tissue massage gun", keywords: "" };
    expect(inferCategory(row)).toBe("fitness_massage");
  });

  test("defaults to generic", () => {
    const row = { id: "3", title: "Random product", keywords: "" };
    expect(inferCategory(row)).toBe("generic");
  });
});

describe("categoryToInterestKey", () => {
  test("maps fan_cooling to int_gadgets", () => {
    expect(categoryToInterestKey("fan_cooling")).toBe("int_gadgets");
  });

  test("maps fitness_massage to int_fitness", () => {
    expect(categoryToInterestKey("fitness_massage")).toBe("int_fitness");
  });

  test("maps beauty to int_beauty", () => {
    expect(categoryToInterestKey("beauty")).toBe("int_beauty");
  });

  test("generic has no interest key", () => {
    expect(categoryToInterestKey("generic")).toBeNull();
  });
});

describe("matchesConditions", () => {
  test("passes when predicates satisfy all required flags", () => {
    const conditions = { any: true, age18: true, int_gadgets: true };
    const predicates = { any: true, age18: true, int_gadgets: true };

    expect(matchesConditions(conditions, predicates)).toBe(true);
  });

  test("fails when age18 is required but false", () => {
    const conditions = { age18: true };
    const predicates = { age18: false };

    expect(matchesConditions(conditions, predicates)).toBe(false);
  });

  test("ignores undefined / null condition entries", () => {
    const conditions = { age18: undefined, int_gadgets: true };
    const predicates = { int_gadgets: true };

    expect(matchesConditions(conditions, predicates)).toBe(true);
  });
});

describe("scoreCampaign", () => {
  const baseRow = {
    id: "fan-1",
    title: "USB desk fan",
    keywords: "mini fan cooling",
    bid: 1.0,
  };

  test("adds overlap score for matching query tokens", () => {
    const queryTokens = new Set(["usb", "fan"]);
    const predicates = {};
    const score = scoreCampaign({ queryTokens, row: baseRow, predicates });
    const scoreNoQuery = scoreCampaign({
      queryTokens: new Set(),
      row: baseRow,
      predicates,
    });

    expect(score).toBeGreaterThan(scoreNoQuery);
  });

  test("adds interest score when user matches category interest", () => {
    const queryTokens = new Set(["fan"]);
    const predicatesNoInterest = {};
    const predicatesWithInterest = { int_gadgets: true };

    const scoreNoInterest = scoreCampaign({
      queryTokens,
      row: baseRow,
      predicates: predicatesNoInterest,
    });
    const scoreWithInterest = scoreCampaign({
      queryTokens,
      row: baseRow,
      predicates: predicatesWithInterest,
    });

    expect(scoreWithInterest).toBeGreaterThan(scoreNoInterest);
  });

  test("adds extra boost for high intent / cart abandoner", () => {
    const queryTokens = new Set(["fan"]);
    const predicatesBase = { int_gadgets: true };
    const predicatesIntent = {
      int_gadgets: true,
      hi_intent_recent: true,
      cart_abandoner: true,
    };

    const scoreBase = scoreCampaign({
      queryTokens,
      row: baseRow,
      predicates: predicatesBase,
    });
    const scoreIntent = scoreCampaign({
      queryTokens,
      row: baseRow,
      predicates: predicatesIntent,
    });

    expect(scoreIntent).toBeGreaterThan(scoreBase);
  });
});
