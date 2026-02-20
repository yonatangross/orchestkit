---
title: Apply zero-downtime migration patterns to avoid table locks and production outages
impact: CRITICAL
impactDescription: "Incorrect schema changes lock production tables and cause outages"
tags: zero-downtime, expand-contract, pgroll, migration, production
---

## Zero-Downtime Migration Patterns

**Incorrect — blocking schema changes:**
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
```

**Correct — expand-contract pattern:**
```
Phase 1: EXPAND              Phase 2: MIGRATE           Phase 3: CONTRACT
Add new column               Backfill data              Remove old column
(nullable)                   Update app to use new      (after app migrated)
                             Both versions work
```

### Manual Expand Phase

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

### Manual Contract Phase

```sql
-- Step 1: Verify no readers of old column
SELECT * FROM pg_stat_statements
WHERE query LIKE '%first_name%' OR query LIKE '%last_name%';

-- Step 2: Drop trigger, then old columns ONLY after app fully migrated
DROP TRIGGER IF EXISTS trg_sync_display_name ON users;
ALTER TABLE users DROP COLUMN first_name;
ALTER TABLE users DROP COLUMN last_name;
ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;
```

### NOT VALID Constraint Pattern

```sql
-- Step 1: Add constraint without validating existing rows (instant)
ALTER TABLE orders ADD CONSTRAINT chk_amount_positive
CHECK (amount > 0) NOT VALID;

-- Step 2: Validate constraint (scans table but allows writes)
ALTER TABLE orders VALIDATE CONSTRAINT chk_amount_positive;
```

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Tool choice | pgroll for automation, manual for simple cases |
| Column rename | Add new + copy + drop old (never RENAME) |
| Constraint timing | Add NOT VALID first, VALIDATE separately |
| Rollback window | Keep old schema 24-72 hours |
| Backfill batch size | 1000-10000 rows per batch |
| Index strategy | CONCURRENTLY always |
