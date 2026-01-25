---
name: zero-downtime-migration
description: Safe database schema changes without downtime using expand-contract pattern and online schema changes. Use when deploying schema changes to production without service interruption.
context: fork
agent: database-engineer
version: 2.0.0
tags: [database, migration, zero-downtime, expand-contract, pgroll, 2026]
allowed-tools: [Read, Write, Bash, Grep, Glob]
author: OrchestKit
user-invocable: false
---

# Zero-Downtime Migration (2026)

Database migration patterns that ensure continuous service availability during schema changes.

## Overview

- Deploying schema changes to production systems with uptime requirements
- Renaming or removing columns without breaking existing application code
- Adding NOT NULL constraints to existing columns with data
- Creating indexes on large tables without locking
- Migrating data between columns or tables during live traffic
- Using pgroll for automated expand-contract migrations

## Quick Reference

### Expand-Contract Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     EXPAND-CONTRACT PATTERN                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Phase 1: EXPAND              Phase 2: MIGRATE           Phase 3: CONTRACT│
│  ─────────────────           ──────────────────         ────────────────  │
│  Add new column              Backfill data              Remove old column │
│  (nullable)                  Update app to use new      (after app migrated)│
│                              Both versions work                           │
│                                                                          │
│  ┌─────────┐                 ┌─────────┐                ┌─────────┐      │
│  │old_col  │ ───────────────>│old_col  │ ─────────────> │new_col  │      │
│  │         │                 │new_col  │                │         │      │
│  └─────────┘                 └─────────┘                └─────────┘      │
│                                                                          │
│  Rollback: Drop new          Rollback: Use old          Rollback: N/A    │
│                              (dual-write in app)        (commit)         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### pgroll: Automated Expand-Contract

```bash
# Install pgroll (2026 recommended tool)
brew install xataio/pgroll/pgroll
# or
go install github.com/xataio/pgroll@latest

# Initialize pgroll in your database
pgroll init --postgres-url "postgres://user:pass@localhost/db"

# Create a migration file (migrations/001_add_email_verified.json)
```

```json
{
  "name": "001_add_email_verified",
  "operations": [
    {
      "add_column": {
        "table": "users",
        "column": {
          "name": "email_verified",
          "type": "boolean",
          "default": "false",
          "nullable": false
        },
        "up": "false"
      }
    }
  ]
}
```

```bash
# Start migration (creates versioned schema)
pgroll start migrations/001_add_email_verified.json

# App v1 uses: schema "public_001_add_email_verified"
# App v2 uses: schema "public" (new version)

# After verification, complete migration
pgroll complete

# Rollback if issues
pgroll rollback
```

### Manual Expand Phase (Add New)

```sql
-- Step 1: Add new column (nullable, no default constraint yet)
ALTER TABLE users ADD COLUMN display_name VARCHAR(200);

-- Step 2: Create trigger for dual-write (if app can't dual-write)
CREATE OR REPLACE FUNCTION sync_display_name() RETURNS TRIGGER AS $$
BEGIN
  NEW.display_name := CONCAT(NEW.first_name, ' ', NEW.last_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_display_name
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION sync_display_name();

-- Step 3: Backfill existing data (in batches)
UPDATE users SET display_name = CONCAT(first_name, ' ', last_name)
WHERE display_name IS NULL
AND id IN (SELECT id FROM users WHERE display_name IS NULL LIMIT 1000);
```

### Manual Contract Phase (Remove Old)

```sql
-- Step 1: Verify no readers of old column (check query logs)
SELECT * FROM pg_stat_statements
WHERE query LIKE '%first_name%' OR query LIKE '%last_name%';

-- Step 2: Drop trigger (if used)
DROP TRIGGER IF EXISTS trg_sync_display_name ON users;
DROP FUNCTION IF EXISTS sync_display_name();

-- Step 3: Drop old columns ONLY after app fully migrated
ALTER TABLE users DROP COLUMN first_name;
ALTER TABLE users DROP COLUMN last_name;

-- Step 4: Make new column NOT NULL if required
ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;
```

### CONCURRENTLY Index Creation

```sql
-- Create index without locking table (PostgreSQL)
CREATE INDEX CONCURRENTLY idx_orders_customer_date
ON orders (customer_id, created_at DESC);

-- Drop index without locking (if recreation needed)
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_customer_date;

-- IMPORTANT: CONCURRENTLY cannot run inside transaction block
-- Run outside of Alembic transaction or use raw connection
```

### NOT VALID Constraint Pattern

```sql
-- Step 1: Add constraint without validating existing rows (instant)
ALTER TABLE orders ADD CONSTRAINT chk_amount_positive
CHECK (amount > 0) NOT VALID;

-- Step 2: Validate constraint (scans table but allows writes)
ALTER TABLE orders VALIDATE CONSTRAINT chk_amount_positive;
```

### Foreign Key Safe Addition

```sql
-- Step 1: Add FK without validation (instant)
ALTER TABLE orders ADD CONSTRAINT fk_orders_user
FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;

-- Step 2: Validate FK (scans but allows writes)
ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_user;
```

## Key Decisions

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Tool choice | pgroll for automation | Handles dual-writes via triggers automatically |
| Column Rename | Add new + copy + drop old | Direct RENAME blocks reads |
| Constraint Timing | Add NOT VALID first, VALIDATE separately | NOT VALID is non-blocking |
| Rollback Window | Keep old schema 24-72 hours | Allows safe rollback if issues |
| Backfill Batch Size | 1000-10000 rows per batch | Prevents lock escalation |
| Index Strategy | CONCURRENTLY always | Standard CREATE INDEX locks table |
| Verification | Check pg_stat_statements | Ensure no queries use old columns |

## Monitoring During Migration

```sql
-- Check for locks during migration
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
AND state != 'idle';

-- Check replication lag (if using replicas)
SELECT
  client_addr,
  state,
  sent_lsn,
  write_lsn,
  flush_lsn,
  replay_lsn,
  (sent_lsn - replay_lsn) AS replication_lag
FROM pg_stat_replication;

-- Monitor backfill progress
SELECT
  COUNT(*) FILTER (WHERE display_name IS NOT NULL) as migrated,
  COUNT(*) FILTER (WHERE display_name IS NULL) as remaining,
  ROUND(100.0 * COUNT(*) FILTER (WHERE display_name IS NOT NULL) / COUNT(*), 2) as pct_complete
FROM users;
```

## Anti-Patterns (FORBIDDEN)

```sql
-- FORBIDDEN: Single-step ALTER that locks table
ALTER TABLE users RENAME COLUMN name TO full_name;
-- Impact: Blocks ALL queries during metadata lock

-- FORBIDDEN: Add NOT NULL to existing column directly
ALTER TABLE orders ADD COLUMN org_id UUID NOT NULL;
-- Impact: Fails immediately if table has data

-- FORBIDDEN: Regular CREATE INDEX on large table
CREATE INDEX idx_big_table_col ON big_table(col);
-- Impact: Locks table for minutes/hours

-- FORBIDDEN: Drop column without verification period
ALTER TABLE users DROP COLUMN legacy_field;
-- Impact: No rollback if application still references it

-- FORBIDDEN: Constraint validation in same transaction as creation
ALTER TABLE orders ADD CONSTRAINT fk_org
FOREIGN KEY (org_id) REFERENCES orgs(id);
-- Impact: Full table scan with exclusive lock

-- FORBIDDEN: Backfill without batching
UPDATE users SET new_col = old_col;
-- Impact: Locks entire table, fills transaction log
```

## Related Skills

- `alembic-migrations` - Python migration framework with expand-contract support
- `database-schema-designer` - Schema design patterns and normalization principles
- `database-versioning` - Version control and change management for schemas

## Capability Details

### expand-contract
**Keywords:** expand contract, zero downtime, online migration, safe deploy, pgroll
**Solves:**
- How do I rename a column without downtime?
- Safe production schema changes
- Rolling deployments with schema changes

### online-index
**Keywords:** concurrent index, non-blocking index, large table index
**Solves:**
- Create index without locking
- Index creation on production
- PostgreSQL CONCURRENTLY pattern

### constraint-migration
**Keywords:** not valid constraint, foreign key migration, check constraint safe
**Solves:**
- Add constraints without downtime
- Foreign key on existing data
- Validate constraints safely

### pgroll-automation
**Keywords:** pgroll, versioned schema, automatic dual-write, schema versioning
**Solves:**
- Automate expand-contract pattern
- Multiple app versions during migration
- Automatic rollback support
