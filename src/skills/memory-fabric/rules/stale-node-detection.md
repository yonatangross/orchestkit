---
title: Detect and prune stale graph nodes older than threshold to keep memory relevant
impact: MEDIUM
impactDescription: "Stale nodes degrade search relevance by returning outdated decisions and deprecated patterns as top results"
tags: [memory, graph, stale, pruning, recency]
---

# Detect and Prune Stale Nodes

## Why

Knowledge graphs accumulate nodes over time. Without staleness detection, queries return outdated decisions ("use MongoDB" from 6 months ago) alongside current ones ("migrated to Postgres last week"). The recency factor in ranking helps, but nodes beyond a threshold should be flagged or pruned.

## Rule

1. Define a staleness threshold (default: 90 days for decisions, 180 days for patterns)
2. When query results include old nodes, flag them as potentially stale
3. Before acting on stale data, verify it is still current
4. Prune nodes only after user confirmation, never automatically

## Incorrect — treat all graph results as current

```javascript
// Query returns a 6-month-old decision
const results = await mcp__memory__search_nodes({ query: "database choice" });

// Use first result without checking recency
const decision = results.nodes[0];
// decision: "Use MongoDB for user profiles" (from 6 months ago)
// Reality: team migrated to Postgres 3 months ago

console.log(`Current approach: ${decision.observations[0]}`);
// Gives outdated guidance with no warning
```

## Correct — flag stale results and verify

```javascript
const STALE_THRESHOLDS = {
  decision: 90,   // days
  pattern: 180,
  technology: 120,
  default: 90
};

function isStale(node, thresholds) {
  const nodeDate = new Date(node.timestamp || node.lastUpdated);
  const daysSince = (Date.now() - nodeDate.getTime()) / (1000 * 60 * 60 * 24);
  const threshold = thresholds[node.entityType] || thresholds.default;
  return { stale: daysSince > threshold, daysSince: Math.round(daysSince) };
}

const results = await mcp__memory__search_nodes({ query: "database choice" });

for (const node of results.nodes) {
  const { stale, daysSince } = isStale(node, STALE_THRESHOLDS);
  if (stale) {
    console.warn(
      `STALE NODE: "${node.name}" is ${daysSince} days old ` +
      `(threshold: ${STALE_THRESHOLDS[node.entityType] || STALE_THRESHOLDS.default}d). ` +
      `Verify before using.`
    );
  }
}
```

## Pruning Protocol

Never auto-delete. Follow this sequence:

```javascript
// 1. Identify stale candidates
const staleNodes = results.nodes.filter(n => isStale(n, STALE_THRESHOLDS).stale);

// 2. Present to user for review
const report = staleNodes.map(n => ({
  name: n.name,
  type: n.entityType,
  age: `${isStale(n, STALE_THRESHOLDS).daysSince} days`,
  lastObservation: n.observations?.slice(-1)[0] || "none"
}));
console.log("Stale nodes for review:", JSON.stringify(report, null, 2));

// 3. Only prune after explicit user confirmation
// await mcp__memory__delete_entities({ entityNames: confirmedDeletions });
```

## Staleness Thresholds

| Entity Type | Threshold | Rationale |
|-------------|-----------|-----------|
| decision | 90 days | Decisions get revisited quarterly |
| pattern | 180 days | Patterns are more stable |
| technology | 120 days | Tech stack changes seasonally |
| preference | 365 days | User preferences rarely change |
| agent | Never | Agent definitions are structural |
