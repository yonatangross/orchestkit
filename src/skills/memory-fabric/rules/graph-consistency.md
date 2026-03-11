---
title: Validate graph integrity after mutations to prevent orphaned nodes and broken relations
impact: HIGH
impactDescription: "Unvalidated graph mutations create orphaned nodes, dangling relations, and inconsistent query results"
tags: [memory, graph, consistency, integrity, validation]
---

# Validate Graph Integrity After Mutations

## Why

Knowledge graph mutations (create, update, delete) can leave the graph in an inconsistent state: orphaned nodes with no relations, dangling edges pointing to deleted entities, or duplicate nodes with divergent metadata. Queries against inconsistent graphs return wrong results.

## Rule

After any graph mutation:
1. Verify the mutated node exists and has expected properties
2. Check that all relations reference valid nodes on both ends
3. Detect and flag orphaned nodes (no incoming or outgoing relations)
4. Run deduplication check if a new node was created

## Incorrect — mutate without validation

```javascript
// Create entity and relation, assume success
await mcp__memory__create_entities({
  entities: [{ name: "cursor-pagination", entityType: "pattern" }]
});

await mcp__memory__create_relations({
  relations: [{
    from: "database-engineer",
    to: "cursor-pagination",
    relationType: "recommends"
  }]
});

// No verification — what if "database-engineer" doesn't exist?
// Result: dangling relation with invalid "from" reference
```

## Correct — mutate then validate

```javascript
// 1. Create entity
await mcp__memory__create_entities({
  entities: [{ name: "cursor-pagination", entityType: "pattern" }]
});

// 2. Verify the target node exists before creating relation
const sourceCheck = await mcp__memory__search_nodes({
  query: "database-engineer"
});
if (!sourceCheck.nodes?.some(n => n.name === "database-engineer")) {
  // Source node missing — create it first
  await mcp__memory__create_entities({
    entities: [{ name: "database-engineer", entityType: "agent" }]
  });
}

// 3. Create relation with both ends validated
await mcp__memory__create_relations({
  relations: [{
    from: "database-engineer",
    to: "cursor-pagination",
    relationType: "recommends"
  }]
});

// 4. Verify relation was created
const verification = await mcp__memory__search_nodes({
  query: "cursor-pagination"
});
const node = verification.nodes?.find(n => n.name === "cursor-pagination");
if (!node) {
  console.error("Graph mutation failed: node not found after create");
}
```

## Integrity Checks

| Check | When | Action on Failure |
|-------|------|-------------------|
| Node exists after create | After every create | Retry once, then error |
| Both relation ends exist | Before create_relations | Create missing node first |
| No duplicate names | Before create_entities | Merge with existing node |
| Orphan detection | After delete operations | Log warning, queue cleanup |

## Deduplication on Create

```javascript
// Before creating, check for existing node
const existing = await mcp__memory__search_nodes({
  query: "cursor-pagination"
});

const match = existing.nodes?.find(
  n => n.name === "cursor-pagination" || n.name === "cursor_pagination"
);

if (match) {
  // Merge observations into existing node instead of creating duplicate
  await mcp__memory__add_observations({
    observations: [{ entityName: match.name, contents: ["New observation"] }]
  });
} else {
  await mcp__memory__create_entities({
    entities: [{ name: "cursor-pagination", entityType: "pattern" }]
  });
}
```
