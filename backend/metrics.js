// backend/metrics.js

const metrics = {
  // Requests
  totalAdRequests: 0,
  adRequestsWithSession: 0,
  adRequestsWithoutSession: 0,

  // Fill / personalization
  adImpressions: 0,
  fallbackImpressions: 0,
  personalizedImpressions: 0,

  // Segment matches
  verticalMatches: {
    gadgets: 0,
    fitness: 0,
    beauty: 0,
    home_kitchen: 0,
  },

  // Simple latency (ms)
  latencySamples: [],
};

export function recordAdRequest({ hasSession }) {
  metrics.totalAdRequests++;
  if (hasSession) metrics.adRequestsWithSession++;
  else metrics.adRequestsWithoutSession++;
}

export function recordAdImpression({
  isFallback,
  isPersonalized,
  category,
  predicates,
}) {
  metrics.adImpressions++;
  if (isFallback) metrics.fallbackImpressions++;
  if (isPersonalized) metrics.personalizedImpressions++;

  // rough vertical matching metric
  if (category === "fan_cooling" || category === "gadgets") {
    if (predicates?.int_gadgets) metrics.verticalMatches.gadgets++;
  }
  if (category === "fitness_massage") {
    if (predicates?.int_fitness) metrics.verticalMatches.fitness++;
  }
  if (category === "beauty") {
    if (predicates?.int_beauty) metrics.verticalMatches.beauty++;
  }
  if (
    category === "kitchen_tools" ||
    category === "storage_org" ||
    category === "laundry_cleaning"
  ) {
    if (predicates?.int_home_kitchen) metrics.verticalMatches.home_kitchen++;
  }
}

export function recordLatency(ms) {
  metrics.latencySamples.push(ms);
  if (metrics.latencySamples.length > 1000) {
    metrics.latencySamples.shift();
  }
}

export function getMetricsSnapshot() {
  const m = { ...metrics };
  const latencies = m.latencySamples.slice();

  let avgLatency = 0;
  if (latencies.length) {
    avgLatency =
      latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }

  return {
    ...m,
    avgLatencyMs: avgLatency,
    // derived ratios to compare w/ “real cookie” numbers
    personalizationRate:
      m.adImpressions > 0
        ? m.personalizedImpressions / m.adImpressions
        : 0,
    fillRate:
      m.totalAdRequests > 0
        ? m.adImpressions / m.totalAdRequests
        : 0,
    sessionAdShare:
      m.totalAdRequests > 0
        ? m.adRequestsWithSession / m.totalAdRequests
        : 0,
  };
}
