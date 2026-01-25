---
name: database-schema-designer
description: SQL and NoSQL schema design with normalization, indexing, and migration patterns. Use when designing database schemas, creating tables, optimizing slow queries, or planning database migrations.
version: 2.0.0
author: AI Agent Hub
tags: [database, schema-design, sql, nosql, performance, migrations]
context: fork
agent: database-engineer
user-invocable: false
---

# Database Schema Designer
This skill provides comprehensive guidance for designing robust, scalable database schemas for both SQL and NoSQL databases. Whether building from scratch or evolving existing schemas, this framework ensures data integrity, performance, and maintainability.

## Overview
- Designing new database schemas
- Refactoring or migrating existing schemas
- Optimizing database performance
- Choosing between SQL and NoSQL approaches
- Creating database migrations
- Establishing indexing strategies
- Modeling complex relationships
- Planning data archival and partitioning

## Database Design Philosophy

### Core Principles

**1. Model the Domain, Not the UI**
- Schema reflects business entities and relationships
- Don't let UI requirements drive data structure
- Separate presentation concerns from data model

**2. Optimize for Reads or Writes (Not Both)**
- OLTP (transactional): Normalized, optimized for writes
- OLAP (analytical): Denormalized, optimized for reads
- Choose based on access patterns

**3. Plan for Scale From Day One**
- Indexing strategy
- Partitioning approach
- Caching layer
- Read replicas

**4. Data Integrity Over Performance**
- Use constraints, foreign keys, validation
- Performance issues can be optimized later
- Data corruption is costly to fix

---

## SQL Database Design

### Normalization

Database normalization reduces redundancy and ensures data integrity.

#### 1st Normal Form (1NF)
**Rule**: Each column contains atomic (indivisible) values, no repeating groups.

```sql
-- ❌ Violates 1NF (multiple values in one column)
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT,
  product_ids VARCHAR(255)  -- '101,102,103' (bad!)
);

-- ✅ Follows 1NF
CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT
);

CREATE TABLE order_items (
  id INT PRIMARY KEY,
  order_id INT,
  product_id INT,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

#### 2nd Normal Form (2NF)
**Rule**: Must be in 1NF + all non-key columns depend on the entire primary key.

#### 3rd Normal Form (3NF)
**Rule**: Must be in 2NF + no transitive dependencies (non-key columns depend only on primary key).

---

### Indexing Strategies

Indexes speed up reads but slow down writes. Use strategically.

#### When to Create Indexes

```sql
-- ✅ Index foreign keys
CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- ✅ Index frequently queried columns
CREATE INDEX idx_users_email ON users(email);

-- ✅ Index columns used in WHERE, ORDER BY, GROUP BY
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- ✅ Composite index for multi-column queries
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);
```

#### Composite Indexes (Column Order Matters)

```sql
-- ✅ Good: Index supports both queries
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);

-- Query 1: Uses index efficiently
SELECT * FROM orders WHERE customer_id = 123 AND status = 'pending';

-- Query 2: Uses index (customer_id only)
SELECT * FROM orders WHERE customer_id = 123;

-- ❌ Query 3: Doesn't use index (status is second column)
SELECT * FROM orders WHERE status = 'pending';
```

**Rule of Thumb**: Put most selective column first, or most frequently queried alone.

---

### Constraints

Use constraints to enforce data integrity at the database level.

```sql
CREATE TABLE products (
  id INT PRIMARY KEY,
  price DECIMAL(10, 2) CHECK (price >= 0),
  stock INT CHECK (stock >= 0),
  discount_percent INT CHECK (discount_percent BETWEEN 0 AND 100)
);
```

---

## Database Migrations

### Migration Best Practices

**1. Always Reversible**
```sql
-- Up migration
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- Down migration
ALTER TABLE users DROP COLUMN phone;
```

**2. Backward Compatible**
```sql
-- ✅ Good: Add nullable column
ALTER TABLE users ADD COLUMN middle_name VARCHAR(50);

-- ❌ Bad: Add required column (breaks existing code)
ALTER TABLE users ADD COLUMN middle_name VARCHAR(50) NOT NULL;
```

**3. Data Migrations Separate from Schema Changes**
```sql
-- Migration 1: Schema change
ALTER TABLE orders ADD COLUMN status VARCHAR(20) DEFAULT 'pending';

-- Migration 2: Data migration
UPDATE orders SET status = 'completed' WHERE completed_at IS NOT NULL;
```

---

## Quick Start Checklist

When designing a new schema:

- [ ] Identify entities and relationships
- [ ] Choose SQL or NoSQL based on requirements
- [ ] Normalize to 3NF (SQL) or decide embed/reference (NoSQL)
- [ ] Define primary keys (INT auto-increment or UUID)
- [ ] Add foreign key constraints
- [ ] Choose appropriate data types
- [ ] Add unique constraints where needed
- [ ] Plan indexing strategy (foreign keys, WHERE columns)
- [ ] Add NOT NULL constraints for required fields
- [ ] Create CHECK constraints for validation
- [ ] Plan for soft deletes (deleted_at column) if needed
- [ ] Add timestamps (created_at, updated_at)
- [ ] Design migration scripts (up and down)
- [ ] Test migrations on staging

---

## Related Skills

- `alembic-migrations` - Alembic-specific migration patterns for SQLAlchemy projects
- `zero-downtime-migration` - Safe schema changes without service interruption
- `database-versioning` - Version control strategies for database objects
- `caching-strategies` - Cache layer design to complement database performance

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Normalization target | 3NF for OLTP | Reduces redundancy while maintaining query performance |
| Primary key strategy | INT auto-increment or UUID | UUIDs for distributed systems, INT for single-database |
| Soft deletes | `deleted_at` timestamp column | Preserves audit trail, enables recovery, supports compliance |
| Composite index order | Most selective column first | Optimizes index usage for common query patterns |

---

**Skill Version**: 2.0.0
**Last Updated**: 2026-01-08
**Maintained by**: AI Agent Hub Team

## Capability Details

### schema-design
**Keywords:** schema, table, entity, relationship, erd
**Solves:**
- Design database schema
- Model relationships
- ERD creation

### normalization
**Keywords:** normalize, 1nf, 2nf, 3nf, denormalize
**Solves:**
- Normalization levels
- When to denormalize
- Reduce redundancy

### indexing
**Keywords:** index, b-tree, composite, query performance
**Solves:**
- Which columns to index
- Optimize slow queries
- Index types

### migrations
**Keywords:** migration, alter table, zero downtime, backward compatible
**Solves:**
- Write safe migrations
- Zero-downtime changes
- Reversible migrations
