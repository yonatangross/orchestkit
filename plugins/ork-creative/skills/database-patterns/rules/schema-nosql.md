---
title: Design NoSQL schemas with embed vs reference trade-offs for query performance
category: schema
impact: HIGH
impactDescription: NoSQL schema decisions are hard to change after data is in production. Embed vs reference choices directly determine query performance and data consistency.
tags: [nosql, mongodb, document-design, sharding, embed-reference]
---

# NoSQL Schema Design Patterns

## SQL vs NoSQL Decision

| Factor | SQL (PostgreSQL) | NoSQL (MongoDB) |
|--------|------------------|-----------------|
| Data relationships | Complex, many-to-many | Simple, hierarchical |
| Query patterns | Ad-hoc, complex joins | Known access patterns |
| Consistency | Strong (ACID) | Eventual (configurable) |
| Schema | Rigid, enforced | Flexible, evolving |
| Scale | Vertical + read replicas | Horizontal sharding |

## Embed vs Reference

### Embed When:
- Data is always accessed together
- Relationship is 1:1 or 1:few
- Embedded data rarely changes independently

```json
{
  "_id": "user-123",
  "name": "Alice",
  "address": {
    "street": "123 Main St",
    "city": "Portland",
    "state": "OR"
  }
}
```

### Reference When:
- Data is accessed independently
- Relationship is 1:many or many:many
- Referenced data changes frequently

```json
// users collection
{ "_id": "user-123", "name": "Alice", "org_id": "org-456" }

// organizations collection
{ "_id": "org-456", "name": "Acme Corp", "plan": "enterprise" }
```

## Document Size Limits

| Database | Max Document Size | Recommendation |
|----------|-------------------|----------------|
| MongoDB | 16 MB | Keep under 1 MB for performance |
| DynamoDB | 400 KB | Split large items across multiple records |
| Firestore | 1 MB | Use subcollections for large data |

## Sharding Strategy

Choose a shard key that ensures even distribution:

```javascript
// Good: High cardinality, even distribution
db.orders.createIndex({ customer_id: 1, created_at: 1 });
sh.shardCollection("mydb.orders", { customer_id: "hashed" });

// Bad: Low cardinality (hot shard)
sh.shardCollection("mydb.orders", { status: 1 });  // Only 3-5 values!
```

## Schema Validation (MongoDB)

```javascript
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "created_at"],
      properties: {
        name: { bsonType: "string", minLength: 1 },
        email: { bsonType: "string", pattern: "^.+@.+\\..+$" },
        status: { enum: ["active", "inactive", "suspended"] },
        created_at: { bsonType: "date" }
      }
    }
  }
});
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Embed vs reference | Based on access patterns | Co-located reads are faster |
| Sharding key | High cardinality, hashed | Even data distribution |
| Consistency level | Start with strong, relax if needed | Data integrity first |
| Schema validation | Always define for core collections | Catches bugs early |

**Incorrect — Unbounded embedded array:**
```json
{
  "_id": "user-123",
  "orders": [
    {"id": "order-1", "total": 100},
    {"id": "order-2", "total": 200}
  ]
}
```

**Correct — Reference pattern for 1:many:**
```json
// users collection
{"_id": "user-123", "name": "Alice"}

// orders collection (separate)
{"_id": "order-1", "user_id": "user-123", "total": 100}
{"_id": "order-2", "user_id": "user-123", "total": 200}
```

## Common Mistakes

- Embedding unbounded arrays (document grows forever)
- Using sequential shard keys (hot partition)
- Not defining schema validation (schema chaos)
- Treating NoSQL as "no schema" (still needs design)
