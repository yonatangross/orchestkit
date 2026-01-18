# Expand-Contract Pattern Implementation Guide

The expand-contract pattern enables zero-downtime schema changes by separating deployment into distinct phases with independent rollback capabilities.

## Pattern Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  EXPAND PHASE          │  TRANSITION PHASE    │  CONTRACT PHASE    │
│  (Add new structure)   │  (Dual-write/read)   │  (Remove old)      │
│                        │                      │                    │
│  - Add new column      │  - App writes both   │  - Drop old column │
│  - Create new table    │  - Backfill data     │  - Remove triggers │
│  - Add new index       │  - Validate reads    │  - Finalize schema │
└─────────────────────────────────────────────────────────────────────┘
        Deploy 1                Deploy 2-N              Deploy N+1
```

## Expand Phase Best Practices

### 1. Add Nullable Columns First

```sql
-- CORRECT: Add nullable column (instant operation)
ALTER TABLE users ADD COLUMN email_verified BOOLEAN;

-- WRONG: Add with NOT NULL (requires table rewrite)
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false;
```

### 2. Use DEFAULT Expressions Carefully

PostgreSQL 11+ supports non-volatile defaults without table rewrite:

```sql
-- PostgreSQL 11+: Instant operation (stored in catalog)
ALTER TABLE orders ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();

-- Pre-PostgreSQL 11: Triggers table rewrite
-- Use expand-contract instead
```

### 3. Create Supporting Indexes Early

```sql
-- Create indexes BEFORE they're needed by application
CREATE INDEX CONCURRENTLY idx_users_email_verified
ON users (email_verified) WHERE email_verified = true;

-- Monitor progress
SELECT phase, blocks_done, blocks_total,
       round(100.0 * blocks_done / nullif(blocks_total, 0), 2) AS pct_done
FROM pg_stat_progress_create_index;
```

## Contract Phase Timing

### When to Contract

| Condition | Ready to Contract? | Action |
|-----------|-------------------|--------|
| All app instances on new code | Yes | Proceed |
| Query logs show no old column access | Yes | Proceed |
| Monitoring shows no regressions | Yes | Proceed |
| < 72 hours since expand | No | Wait |
| Rollback still needed | No | Wait |

### Safe Contraction Sequence

```sql
-- 1. Verify no active queries on old column (check pg_stat_activity)
SELECT query FROM pg_stat_activity
WHERE query ILIKE '%old_column_name%' AND state = 'active';

-- 2. Add deprecation comment (documentation)
COMMENT ON COLUMN users.legacy_name IS 'DEPRECATED: Use display_name. Removal planned 2025-02-01';

-- 3. Drop after verification period
ALTER TABLE users DROP COLUMN legacy_name;
```

## Dual-Write Patterns

### Application-Level Dual-Write (Preferred)

```python
# In application code - write to both columns
async def update_user(user_id: str, name: str):
    await db.execute("""
        UPDATE users
        SET legacy_name = :name,
            display_name = :name  -- New column
        WHERE id = :user_id
    """, {"user_id": user_id, "name": name})
```

### Database Trigger Dual-Write (Fallback)

```sql
-- Use when application changes take longer than migration window
CREATE OR REPLACE FUNCTION sync_user_name() RETURNS TRIGGER AS $$
BEGIN
    -- Sync legacy to new on any write
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.display_name IS NULL AND NEW.legacy_name IS NOT NULL THEN
            NEW.display_name := NEW.legacy_name;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_user_name
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION sync_user_name();
```

### Trigger Cleanup

```sql
-- Remove trigger during contract phase
DROP TRIGGER IF EXISTS trg_sync_user_name ON users;
DROP FUNCTION IF EXISTS sync_user_name();
```

## Feature Flag Integration

### Coordinating Schema and Code Changes

```python
# Phase 1: Expand (schema deployed, flag off)
async def get_user_name(user_id: str) -> str:
    if feature_flags.is_enabled("use_new_name_column"):
        return await db.fetchval(
            "SELECT display_name FROM users WHERE id = $1", user_id
        )
    return await db.fetchval(
        "SELECT legacy_name FROM users WHERE id = $1", user_id
    )

# Phase 2: Transition (gradually enable flag, monitor)
# Phase 3: Contract (flag 100%, remove old code path)
```

### Migration State Tracking

```sql
-- Track migration progress with feature flags table
CREATE TABLE IF NOT EXISTS migration_states (
    migration_name VARCHAR(200) PRIMARY KEY,
    phase VARCHAR(20) CHECK (phase IN ('expand', 'transition', 'contract', 'complete')),
    expand_deployed_at TIMESTAMPTZ,
    contract_deployed_at TIMESTAMPTZ,
    rollback_safe_until TIMESTAMPTZ,
    notes TEXT
);

-- Update as you progress
UPDATE migration_states
SET phase = 'transition',
    rollback_safe_until = now() + interval '72 hours'
WHERE migration_name = 'user_name_consolidation';
```

## Rollback Strategy

### Expand Phase Rollback

```sql
-- Safe: Just drop the new column (no data loss)
ALTER TABLE users DROP COLUMN IF EXISTS display_name;
```

### Transition Phase Rollback

```sql
-- Revert to reading old column only
-- Application: Disable feature flag
-- Database: Keep both columns (no schema change needed)
```

### Contract Phase Rollback

```sql
-- DANGER: Old column is gone, must restore from backup
-- This is why we wait 72+ hours before contracting

-- Restore procedure:
-- 1. Stop writes to table
-- 2. Restore column from backup
-- 3. Backfill from new column
-- 4. Resume writes
```

## Monitoring During Migration

```sql
-- Check for queries still using old column
SELECT queryid, calls, query
FROM pg_stat_statements
WHERE query ILIKE '%legacy_name%'
ORDER BY calls DESC;

-- Monitor table bloat during backfill
SELECT relname, n_dead_tup, n_live_tup,
       round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_user_tables
WHERE relname = 'users';
```

## Related Documentation

- `checklists/zero-downtime-checklist.md` - Pre-deployment verification
- `examples/zero-downtime-examples.md` - Complete migration examples
- `templates/expand-contract-template.py` - Alembic migration template
