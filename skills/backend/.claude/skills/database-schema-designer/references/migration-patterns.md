# Database Migration Patterns

## Overview

Database migrations evolve schema over time while preserving data and minimizing downtime. This guide covers zero-downtime strategies, backfill patterns, rollback planning, and Alembic best practices.

---

## Zero-Downtime Migrations

### The Problem
Traditional migrations lock tables during schema changes, causing downtime for users.

### The Solution: Multi-Phase Migrations

#### Phase 1: Add New Column (Nullable)
```sql
-- Migration 1: Add column without constraints
ALTER TABLE analyses
ADD COLUMN content_summary TEXT;  -- NULL allowed during transition
```

**Why nullable?** Existing rows don't have values yet. Adding NOT NULL would fail.

#### Phase 2: Backfill Data
```sql
-- Migration 2: Populate new column
UPDATE analyses
SET content_summary = LEFT(raw_content, 500)
WHERE content_summary IS NULL
  AND raw_content IS NOT NULL;

-- For large tables, batch updates to avoid long locks
DO $$
DECLARE
    batch_size INTEGER := 1000;
    updated_rows INTEGER;
BEGIN
    LOOP
        UPDATE analyses
        SET content_summary = LEFT(raw_content, 500)
        WHERE id IN (
            SELECT id FROM analyses
            WHERE content_summary IS NULL AND raw_content IS NOT NULL
            LIMIT batch_size
        );

        GET DIAGNOSTICS updated_rows = ROW_COUNT;
        EXIT WHEN updated_rows = 0;

        -- Brief pause to allow other transactions
        PERFORM pg_sleep(0.1);
    END LOOP;
END $$;
```

#### Phase 3: Add Constraints
```sql
-- Migration 3: Add NOT NULL constraint (safe after backfill)
ALTER TABLE analyses
ALTER COLUMN content_summary SET NOT NULL;

-- Add default for new rows
ALTER TABLE analyses
ALTER COLUMN content_summary SET DEFAULT '';
```

### Real-World Example: SkillForge's PII Columns

**Migration:** `20251210_add_pii_columns.py`

```python
def upgrade() -> None:
    # Phase 1: Add nullable columns
    op.execute(text("""
        ALTER TABLE analysis_chunks
        ADD COLUMN IF NOT EXISTS pii_flag BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS pii_types JSONB
    """))

    # Phase 2: Backfill (all existing chunks have pii_flag = FALSE)
    op.execute(text("""
        UPDATE analysis_chunks
        SET pii_flag = FALSE
        WHERE pii_flag IS NULL
    """))

    # Phase 3: Add NOT NULL constraint
    op.execute(text("""
        ALTER TABLE analysis_chunks
        ALTER COLUMN pii_flag SET NOT NULL
    """))
```

---

## Backfill Strategies

### Small Tables (< 10,000 rows)
**Strategy:** Single UPDATE statement.

```sql
-- Fast enough for small tables
UPDATE artifacts
SET version = 1
WHERE version IS NULL;
```

### Medium Tables (10,000 - 1,000,000 rows)
**Strategy:** Batched updates with progress tracking.

```python
# Alembic migration
from alembic import op
from sqlalchemy import text

def upgrade() -> None:
    # Add column
    op.add_column('analyses', sa.Column('content_summary', sa.Text, nullable=True))

    # Batched backfill
    connection = op.get_bind()
    batch_size = 1000

    while True:
        result = connection.execute(text("""
            UPDATE analyses
            SET content_summary = LEFT(raw_content, 500)
            WHERE id IN (
                SELECT id FROM analyses
                WHERE content_summary IS NULL AND raw_content IS NOT NULL
                LIMIT :batch_size
            )
        """), {"batch_size": batch_size})

        if result.rowcount == 0:
            break

        print(f"Backfilled {result.rowcount} rows")
```

### Large Tables (> 1,000,000 rows)
**Strategy:** Background job + application-level backfill.

```python
# Step 1: Add nullable column (migration)
def upgrade() -> None:
    op.add_column('analysis_chunks', sa.Column('content_tsvector', TSVECTOR, nullable=True))

# Step 2: Create trigger for new rows (migration)
def upgrade() -> None:
    op.execute(text("""
        CREATE FUNCTION chunks_tsvector_update() RETURNS TRIGGER AS $$
        BEGIN
            NEW.content_tsvector :=
                setweight(to_tsvector('english', COALESCE(NEW.section_title, '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(NEW.snippet, '')), 'B');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER chunks_tsvector_trigger
        BEFORE INSERT OR UPDATE OF section_title, snippet ON analysis_chunks
        FOR EACH ROW EXECUTE FUNCTION chunks_tsvector_update();
    """))

# Step 3: Backfill old rows (background script, not migration)
# Run: poetry run python scripts/backfill_chunks_tsvector.py
async def backfill_tsvector():
    batch_size = 5000
    total_backfilled = 0

    while True:
        async with get_db() as db:
            result = await db.execute(text("""
                UPDATE analysis_chunks
                SET content_tsvector =
                    setweight(to_tsvector('english', COALESCE(section_title, '')), 'A') ||
                    setweight(to_tsvector('english', COALESCE(snippet, '')), 'B')
                WHERE id IN (
                    SELECT id FROM analysis_chunks
                    WHERE content_tsvector IS NULL
                    LIMIT :batch_size
                )
            """), {"batch_size": batch_size})

            await db.commit()

            if result.rowcount == 0:
                break

            total_backfilled += result.rowcount
            print(f"Backfilled {total_backfilled} total rows")
```

**SkillForge Migration:** `20251218_backfill_chunks_tsvector.py` (actual example)

---

## Rollback Planning

### Always Include `downgrade()`
Every migration MUST have a rollback path.

```python
def upgrade() -> None:
    op.add_column('analyses', sa.Column('content_summary', sa.Text, nullable=True))

def downgrade() -> None:
    op.drop_column('analyses', 'content_summary')
```

### Destructive Rollbacks (Data Loss)
**Warning:** Some rollbacks cannot preserve data.

```python
def upgrade() -> None:
    # Split 'phone_numbers' TEXT into separate table
    op.create_table('user_phones', ...)
    # Migrate data from analyses.phone_numbers to user_phones
    op.drop_column('analyses', 'phone_numbers')

def downgrade() -> None:
    # DESTRUCTIVE: Cannot restore original 'phone_numbers' format
    op.add_column('analyses', sa.Column('phone_numbers', sa.Text, nullable=True))
    # Drop user_phones table (data loss!)
    op.drop_table('user_phones')
```

**Solution:** Document data loss in migration docstring.

```python
"""Split phone_numbers column into user_phones table.

Revision ID: abc123
Revises: xyz456
Create Date: 2025-12-21

WARNING: Downgrade will result in data loss. Phone number type
(mobile/home/work) cannot be restored to original format.
"""
```

### Testing Rollbacks
Always test both upgrade and downgrade paths:

```bash
# Apply migration
poetry run alembic upgrade head

# Test rollback
poetry run alembic downgrade -1

# Re-apply
poetry run alembic upgrade head
```

---

## Alembic Best Practices

### Migration File Naming
SkillForge uses timestamp-based naming for clarity:

```
20251210_harden_embedding_pipeline.py
20251218_backfill_chunks_tsvector.py
```

**Format:** `YYYYMMDD_description.py` or `YYYYMMDDHHmmss_description.py`

### Use `text()` for Raw SQL
**Required** for PostgreSQL-specific features (triggers, constraints, indexes).

```python
from sqlalchemy import text

def upgrade() -> None:
    # WRONG: Will fail with syntax errors
    op.execute("""
        CREATE INDEX idx_vector USING hnsw (vector vector_cosine_ops)
    """)

    # CORRECT: Use text() wrapper
    op.execute(text("""
        CREATE INDEX idx_vector
        ON analysis_chunks
        USING hnsw (vector vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """))
```

### Idempotent Migrations
Make migrations safe to re-run (important for development):

```python
def upgrade() -> None:
    # Add column only if it doesn't exist
    op.execute(text("""
        ALTER TABLE analyses
        ADD COLUMN IF NOT EXISTS content_summary TEXT
    """))

    # Create index only if it doesn't exist
    op.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_analyses_url
        ON analyses(url)
    """))

    # Add constraint with existence check
    op.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'chk_granularity'
            ) THEN
                ALTER TABLE analysis_chunks
                ADD CONSTRAINT chk_granularity
                CHECK (granularity IN ('coarse', 'fine', 'summary'));
            END IF;
        END $$;
    """))
```

### Separate Index Creation
For large tables, create indexes separately (not in transaction):

```bash
# Migration creates table without index
poetry run alembic upgrade head

# Manually create index CONCURRENTLY (no locks)
psql -d skillforge -c "CREATE INDEX CONCURRENTLY idx_chunks_vector_hnsw ON analysis_chunks USING hnsw (vector vector_cosine_ops) WITH (m = 16, ef_construction = 64);"
```

**Why?** `CREATE INDEX CONCURRENTLY` cannot run inside transaction blocks (Alembic uses transactions by default).

### Foreign Key Constraints with Cascades
**Always specify** `ON DELETE` behavior:

```python
def upgrade() -> None:
    # WRONG: No cascade (orphaned records)
    op.create_foreign_key(
        'fk_artifacts_analysis',
        'artifacts', 'analyses',
        ['analysis_id'], ['id']
    )

    # CORRECT: Cascade deletes
    op.execute(text("""
        ALTER TABLE artifacts
        ADD CONSTRAINT fk_artifacts_analysis
        FOREIGN KEY (analysis_id) REFERENCES analyses(id)
        ON DELETE CASCADE
    """))
```

**SkillForge Example:** `20251210_add_cascade_delete.py`

```python
def upgrade() -> None:
    # Drop old constraint
    op.execute(text("""
        ALTER TABLE analysis_chunks
        DROP CONSTRAINT IF EXISTS analysis_chunks_analysis_id_fkey
    """))

    # Add new constraint with CASCADE
    op.execute(text("""
        ALTER TABLE analysis_chunks
        ADD CONSTRAINT analysis_chunks_analysis_id_fkey
        FOREIGN KEY (analysis_id) REFERENCES analyses(id)
        ON DELETE CASCADE
    """))
```

### Trigger Functions
**Pattern:** Create reusable functions for common triggers.

```python
def upgrade() -> None:
    # Reusable function for updated_at
    op.execute(text("""
        CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """))

    # Apply to multiple tables
    for table in ['analyses', 'artifacts', 'analysis_chunks']:
        op.execute(text(f"""
            CREATE TRIGGER update_{table}_updated_at
            BEFORE UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        """))
```

### Migration Dependencies
Handle branching with merge migrations:

```bash
# Two developers create migrations in parallel
# branch-a: revision = "abc123", down_revision = "xyz456"
# branch-b: revision = "def789", down_revision = "xyz456"

# Create merge migration
poetry run alembic merge -m "merge sprint 12 migrations" abc123 def789

# Generates:
# revision = "merge123"
# down_revision = ("abc123", "def789")
```

**SkillForge Example:** `500313d1cac9_merge_sprint_12_migrations.py`

---

## Common Pitfalls

### 1. Adding NOT NULL Without Default
```python
# WRONG: Fails if table has existing rows
def upgrade():
    op.add_column('analyses', sa.Column('content_summary', sa.Text, nullable=False))

# CORRECT: Add with default or nullable first
def upgrade():
    op.add_column('analyses', sa.Column('content_summary', sa.Text, nullable=True))
    # Backfill data...
    op.alter_column('analyses', 'content_summary', nullable=False)
```

### 2. Renaming Columns Without Downtime
```python
# Multi-phase approach:
# Phase 1: Add new column, populate from old column
op.add_column('analyses', sa.Column('url', sa.Text, nullable=True))
op.execute(text("UPDATE analyses SET url = old_url WHERE url IS NULL"))

# Deploy application code that reads/writes both columns

# Phase 2: Drop old column (after code deployment)
op.drop_column('analyses', 'old_url')
```

### 3. Changing Column Types
```python
# WRONG: Fails if data is incompatible
op.alter_column('analyses', 'status', type_=sa.Integer)

# CORRECT: Multi-step with validation
op.add_column('analyses', sa.Column('status_new', sa.Integer, nullable=True))
op.execute(text("""
    UPDATE analyses SET status_new =
    CASE status
        WHEN 'pending' THEN 0
        WHEN 'complete' THEN 1
        WHEN 'failed' THEN 2
    END
"""))
op.drop_column('analyses', 'status')
op.alter_column('analyses', 'status_new', new_column_name='status')
```

---

## Summary

| Pattern | Use When | Example |
|---------|----------|---------|
| **Zero-Downtime** | Production systems | Add nullable → backfill → add constraint |
| **Batched Backfill** | Medium tables (10K-1M rows) | UPDATE in batches with LIMIT |
| **Background Backfill** | Large tables (>1M rows) | Trigger for new rows + script for old |
| **Idempotent Migrations** | Development environments | IF NOT EXISTS checks |
| **CASCADE Deletes** | Parent-child relationships | ON DELETE CASCADE |
| **Triggers** | Auto-update computed fields | updated_at, search_vector, tsvector |
| **Merge Migrations** | Parallel development | Combine divergent branches |

**Golden Rules:**
1. Always test `upgrade()` and `downgrade()` locally
2. Never add NOT NULL without backfilling first
3. Use `text()` for PostgreSQL-specific SQL
4. Document destructive rollbacks
5. Create indexes CONCURRENTLY for large tables
