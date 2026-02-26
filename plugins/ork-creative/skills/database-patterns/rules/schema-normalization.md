---
title: Apply normalization rules to eliminate data redundancy and update anomalies
category: schema
impact: HIGH
impactDescription: Proper normalization eliminates data redundancy and ensures integrity. Incorrect normalization leads to update anomalies, data inconsistency, and storage waste.
tags: [normalization, 1nf, 2nf, 3nf, denormalization, json, schema-design]
---

# Schema Normalization Patterns

## Normal Forms

### 1st Normal Form (1NF)
Each column contains atomic values, no repeating groups.

```sql
-- WRONG: Multiple values in one column
CREATE TABLE orders (
  id INT PRIMARY KEY,
  product_ids VARCHAR(255)  -- '101,102,103' (bad!)
);

-- CORRECT: Separate junction table
CREATE TABLE orders (id INT PRIMARY KEY, customer_id INT);
CREATE TABLE order_items (
  id INT PRIMARY KEY,
  order_id INT REFERENCES orders(id),
  product_id INT
);
```

### 2nd Normal Form (2NF)
All non-key columns depend on the entire primary key.

```sql
-- WRONG: order_date depends only on order_id
CREATE TABLE order_items (
  order_id UUID, product_id UUID,
  order_date TIMESTAMP,  -- Partial dependency!
  PRIMARY KEY (order_id, product_id)
);

-- CORRECT: Separate tables
CREATE TABLE orders (id UUID PRIMARY KEY, order_date TIMESTAMP NOT NULL);
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0)
);
```

### 3rd Normal Form (3NF)
No transitive dependencies (non-key columns depend only on primary key).

```sql
-- WRONG: country_name depends on country_code
CREATE TABLE users (id UUID PRIMARY KEY, country_code TEXT, country_name TEXT);

-- CORRECT: Extract to separate table
CREATE TABLE countries (code TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE users (id UUID PRIMARY KEY, country_code TEXT REFERENCES countries(code));
```

## When to Denormalize

Denormalize only after profiling shows bottlenecks.

```sql
-- Denormalized counter (faster reads)
CREATE TABLE analyses (
  id UUID PRIMARY KEY,
  artifact_count INTEGER DEFAULT 0  -- Maintained by trigger
);

CREATE FUNCTION update_artifact_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE analyses SET artifact_count = artifact_count + 1 WHERE id = NEW.analysis_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE analyses SET artifact_count = artifact_count - 1 WHERE id = OLD.analysis_id;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
```

## JSON vs Normalized Tables

| Use JSON When | Use Normalized When |
|---------------|---------------------|
| Schema is flexible/evolving | Need foreign key constraints |
| Data rarely queried individually | Frequent filtering/sorting |
| Structure varies per row | Complex queries (joins, aggregations) |

```sql
-- JSON: Flexible metadata
extraction_metadata JSONB  -- {"fetch_time_ms": 1234, "charset": "utf-8"}

-- Normalized: Structured queryable data
CREATE TABLE agent_findings (
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  findings JSONB NOT NULL  -- Hybrid: FK + JSONB
);
```

**Incorrect — Violating 1NF (repeating groups):**
```sql
-- Multiple values in one column
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  product_ids TEXT  -- '101,102,103' stored as CSV
);
```

**Correct — Junction table (1NF compliant):**
```sql
-- Atomic values, no repeating groups
CREATE TABLE orders (id UUID PRIMARY KEY);
CREATE TABLE order_items (
  order_id UUID REFERENCES orders(id),
  product_id UUID,
  PRIMARY KEY (order_id, product_id)
);
```

## Design Philosophy

1. **Model the domain, not the UI** - Schema reflects business entities
2. **Optimize for reads OR writes** - OLTP normalized, OLAP denormalized
3. **Data integrity over performance** - Constraints first, optimize later
4. **Plan for scale from day one** - Indexing, partitioning, caching strategy
