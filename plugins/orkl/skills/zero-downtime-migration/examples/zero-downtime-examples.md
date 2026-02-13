# Zero-Downtime Migration Examples

Complete code examples for common zero-downtime migration scenarios.

## Example 1: Column Rename (Expand-Contract)

Renaming `users.name` to `users.display_name` without downtime.

### Expand Migration

```sql
-- Migration: 001_expand_add_display_name.sql

-- Step 1: Add new column (instant, no lock)
ALTER TABLE users ADD COLUMN display_name VARCHAR(200);

-- Step 2: Create index on new column
CREATE INDEX CONCURRENTLY idx_users_display_name ON users (display_name);

-- Step 3: Create sync trigger for dual-write
CREATE OR REPLACE FUNCTION sync_name_to_display_name() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_name IS NULL THEN
        NEW.display_name := NEW.name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_name_to_display_name
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION sync_name_to_display_name();
```

### Backfill Script

```sql
-- backfill_display_name.sql
-- Run in batches to avoid long transactions

DO $$
DECLARE
    batch_size INT := 5000;
    total_updated INT := 0;
    rows_affected INT;
BEGIN
    LOOP
        UPDATE users
        SET display_name = name
        WHERE id IN (
            SELECT id FROM users
            WHERE display_name IS NULL
            LIMIT batch_size
            FOR UPDATE SKIP LOCKED
        );

        GET DIAGNOSTICS rows_affected = ROW_COUNT;
        total_updated := total_updated + rows_affected;

        RAISE NOTICE 'Updated % rows (total: %)', rows_affected, total_updated;

        EXIT WHEN rows_affected = 0;

        -- Small delay to reduce load
        PERFORM pg_sleep(0.1);
    END LOOP;
END $$;
```

### Contract Migration

```sql
-- Migration: 002_contract_drop_name.sql
-- Run ONLY after verifying no queries use 'name' column

-- Step 1: Drop the sync trigger
DROP TRIGGER IF EXISTS trg_sync_name_to_display_name ON users;
DROP FUNCTION IF EXISTS sync_name_to_display_name();

-- Step 2: Drop old index (if exists)
DROP INDEX CONCURRENTLY IF EXISTS idx_users_name;

-- Step 3: Drop old column
ALTER TABLE users DROP COLUMN name;

-- Step 4: Add NOT NULL if required
ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;
```

## Example 2: NOT VALID Constraint Pattern

Adding a CHECK constraint to existing data without blocking writes.

```sql
-- Migration: add_order_amount_constraint.sql

-- Step 1: Add constraint as NOT VALID (instant, no scan)
ALTER TABLE orders
ADD CONSTRAINT chk_orders_amount_positive
CHECK (amount > 0) NOT VALID;

-- Step 2: Validate in separate transaction (allows concurrent writes)
-- This scans the table but doesn't hold exclusive lock
ALTER TABLE orders VALIDATE CONSTRAINT chk_orders_amount_positive;
```

### Foreign Key with NOT VALID

```sql
-- Adding FK to large table without downtime

-- Step 1: Add FK as NOT VALID (instant)
ALTER TABLE orders
ADD CONSTRAINT fk_orders_customer
FOREIGN KEY (customer_id) REFERENCES customers(id)
NOT VALID;

-- Step 2: Create supporting index FIRST (important!)
CREATE INDEX CONCURRENTLY idx_orders_customer_id ON orders (customer_id);

-- Step 3: Validate FK (scans table, checks each row)
ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_customer;
```

## Example 3: Online Index Creation

Creating indexes on large tables without blocking operations.

### Simple CONCURRENTLY Index

```sql
-- IMPORTANT: Cannot run inside transaction block
-- Must set autocommit or use raw connection

CREATE INDEX CONCURRENTLY idx_orders_created_at
ON orders (created_at DESC);

-- Monitor progress
SELECT phase, blocks_done, blocks_total,
       tuples_done, tuples_total,
       current_locker_pid
FROM pg_stat_progress_create_index;
```

### Partial Index for Hot Path

```sql
-- Index only active records (smaller, faster)
CREATE INDEX CONCURRENTLY idx_orders_active_recent
ON orders (customer_id, created_at DESC)
WHERE status = 'active' AND created_at > now() - interval '90 days';
```

### Index Rebuild (Replace Invalid Index)

```sql
-- If CONCURRENTLY fails, index is marked invalid
-- Check for invalid indexes
SELECT indexrelid::regclass, indisvalid
FROM pg_index WHERE NOT indisvalid;

-- Rebuild by creating replacement
CREATE INDEX CONCURRENTLY idx_orders_created_at_new
ON orders (created_at DESC);

-- Swap indexes (brief exclusive lock on index only)
DROP INDEX CONCURRENTLY idx_orders_created_at;
ALTER INDEX idx_orders_created_at_new RENAME TO idx_orders_created_at;
```

## Example 4: Table Partition Migration

Moving a large table to partitioned structure without downtime.

### Step 1: Create Partitioned Table

```sql
-- Create new partitioned table structure
CREATE TABLE orders_partitioned (
    id UUID NOT NULL,
    customer_id UUID NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

-- Create partitions for expected date ranges
CREATE TABLE orders_p2024q4 PARTITION OF orders_partitioned
FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');

CREATE TABLE orders_p2025q1 PARTITION OF orders_partitioned
FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');

-- Create default partition for unexpected values
CREATE TABLE orders_default PARTITION OF orders_partitioned DEFAULT;
```

### Step 2: Set Up Dual-Write Trigger

```sql
-- Trigger on old table writes to new partitioned table
CREATE OR REPLACE FUNCTION sync_to_partitioned_orders() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO orders_partitioned VALUES (NEW.*);
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE orders_partitioned SET
            customer_id = NEW.customer_id,
            amount = NEW.amount,
            status = NEW.status
        WHERE id = NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM orders_partitioned WHERE id = OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_to_partitioned
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION sync_to_partitioned_orders();
```

### Step 3: Backfill Historical Data

```sql
-- Backfill in batches by date range
INSERT INTO orders_partitioned
SELECT * FROM orders
WHERE created_at >= '2024-10-01' AND created_at < '2024-11-01'
ON CONFLICT (id) DO NOTHING;

-- Repeat for each month, monitoring replication lag
```

### Step 4: Swap Tables (Brief Downtime Alternative)

```sql
-- Option A: View-based swap (no downtime)
-- Rename old table
ALTER TABLE orders RENAME TO orders_legacy;

-- Create view with same name pointing to partitioned
CREATE VIEW orders AS SELECT * FROM orders_partitioned;

-- Update application to use table directly, then drop view

-- Option B: Table swap (requires brief maintenance window)
BEGIN;
ALTER TABLE orders RENAME TO orders_old;
ALTER TABLE orders_partitioned RENAME TO orders;
COMMIT;
-- Window: ~100ms

-- Clean up
DROP TABLE orders_old; -- After verification period
```

## Example 5: NOT NULL with Default Value

Adding NOT NULL column to existing table with data.

```sql
-- PostgreSQL 11+ approach (instant for non-volatile default)

-- Step 1: Add column with default (instant, catalog-only)
ALTER TABLE users ADD COLUMN verified_at TIMESTAMPTZ DEFAULT now();

-- Step 2: If you need to remove the default later
ALTER TABLE users ALTER COLUMN verified_at DROP DEFAULT;

-- Step 3: Make NOT NULL (instant if all rows have value)
ALTER TABLE users ALTER COLUMN verified_at SET NOT NULL;
```

### Pre-PostgreSQL 11 Approach

```sql
-- Must use expand-contract pattern

-- Expand: Add nullable column
ALTER TABLE users ADD COLUMN verified_at TIMESTAMPTZ;

-- Backfill in batches
UPDATE users SET verified_at = created_at
WHERE verified_at IS NULL AND id IN (
    SELECT id FROM users WHERE verified_at IS NULL LIMIT 10000
);

-- Contract: Add NOT NULL after backfill complete
ALTER TABLE users ALTER COLUMN verified_at SET NOT NULL;
```
