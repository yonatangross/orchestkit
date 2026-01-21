"""
Expand-Contract Migration Template for Alembic

This template provides a complete expand-contract migration pattern.
Copy and customize for your specific schema change.

Usage:
    1. Copy this file to your alembic/versions/ directory
    2. Rename with proper revision ID: {rev_id}_expand_{description}.py
    3. Create corresponding contract migration
    4. Deploy expand first, wait 72+ hours, then deploy contract
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision = "REPLACE_WITH_REVISION_ID"
down_revision = "REPLACE_WITH_PREVIOUS_REVISION"
branch_labels = None
depends_on = None

# Migration metadata
MIGRATION_NAME = "column_rename_example"
TABLE_NAME = "users"
OLD_COLUMN = "name"
NEW_COLUMN = "display_name"


def upgrade() -> None:
    """
    EXPAND PHASE: Add new column and set up dual-write.

    This migration is SAFE to deploy during active traffic.
    """
    # Step 1: Add new nullable column (instant operation)
    op.add_column(
        TABLE_NAME,
        sa.Column(NEW_COLUMN, sa.String(200), nullable=True)
    )

    # Step 2: Create index on new column (CONCURRENTLY, non-blocking)
    # NOTE: Must run outside transaction
    op.execute(f"""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_{TABLE_NAME}_{NEW_COLUMN}
        ON {TABLE_NAME} ({NEW_COLUMN})
    """)

    # Step 3: Create dual-write trigger (syncs old -> new)
    op.execute(f"""
        CREATE OR REPLACE FUNCTION sync_{OLD_COLUMN}_to_{NEW_COLUMN}()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.{NEW_COLUMN} IS NULL AND NEW.{OLD_COLUMN} IS NOT NULL THEN
                NEW.{NEW_COLUMN} := NEW.{OLD_COLUMN};
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute(f"""
        CREATE TRIGGER trg_sync_{OLD_COLUMN}_to_{NEW_COLUMN}
        BEFORE INSERT OR UPDATE ON {TABLE_NAME}
        FOR EACH ROW EXECUTE FUNCTION sync_{OLD_COLUMN}_to_{NEW_COLUMN}();
    """)


def downgrade() -> None:
    """
    EXPAND ROLLBACK: Remove new column and triggers.

    Safe to run - no data loss (old column untouched).
    """
    # Drop trigger first
    op.execute(f"DROP TRIGGER IF EXISTS trg_sync_{OLD_COLUMN}_to_{NEW_COLUMN} ON {TABLE_NAME}")
    op.execute(f"DROP FUNCTION IF EXISTS sync_{OLD_COLUMN}_to_{NEW_COLUMN}()")

    # Drop index
    op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS idx_{TABLE_NAME}_{NEW_COLUMN}")

    # Drop column
    op.drop_column(TABLE_NAME, NEW_COLUMN)


# =============================================================================
# BACKFILL SCRIPT (Run separately, not part of migration)
# =============================================================================

BACKFILL_SQL = f"""
DO $$
DECLARE
    batch_size INT := 5000;
    total_updated INT := 0;
    rows_affected INT;
BEGIN
    LOOP
        UPDATE {TABLE_NAME}
        SET {NEW_COLUMN} = {OLD_COLUMN}
        WHERE id IN (
            SELECT id FROM {TABLE_NAME}
            WHERE {NEW_COLUMN} IS NULL AND {OLD_COLUMN} IS NOT NULL
            LIMIT batch_size
            FOR UPDATE SKIP LOCKED
        );

        GET DIAGNOSTICS rows_affected = ROW_COUNT;
        total_updated := total_updated + rows_affected;

        RAISE NOTICE 'Backfilled % rows (total: %)', rows_affected, total_updated;

        EXIT WHEN rows_affected = 0;
        PERFORM pg_sleep(0.1);
    END LOOP;

    RAISE NOTICE 'Backfill complete. Total rows: %', total_updated;
END $$;
"""


# =============================================================================
# CONTRACT MIGRATION (Create as separate file after 72+ hours)
# =============================================================================

CONTRACT_TEMPLATE = '''
"""
Contract Migration: Remove old column after expand migration.

IMPORTANT: Only deploy this AFTER:
1. All application code uses new column
2. Query logs show zero access to old column (72+ hours)
3. Backfill is 100% complete
4. Feature flags at 100%
"""

def upgrade() -> None:
    """CONTRACT PHASE: Remove old column and finalize schema."""

    # Step 1: Drop dual-write trigger
    op.execute(f"DROP TRIGGER IF EXISTS trg_sync_{OLD_COLUMN}_to_{NEW_COLUMN} ON {TABLE_NAME}")
    op.execute(f"DROP FUNCTION IF EXISTS sync_{OLD_COLUMN}_to_{NEW_COLUMN}()")

    # Step 2: Drop old index (if exists)
    op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS idx_{TABLE_NAME}_{OLD_COLUMN}")

    # Step 3: Drop old column
    op.drop_column(TABLE_NAME, OLD_COLUMN)

    # Step 4: Add NOT NULL constraint (if required)
    op.alter_column(
        TABLE_NAME,
        NEW_COLUMN,
        nullable=False
    )


def downgrade() -> None:
    """
    CONTRACT ROLLBACK: Restore old column.

    WARNING: This requires data restoration from backup!
    The old column data is LOST after contract upgrade.
    """
    # Step 1: Add old column back
    op.add_column(
        TABLE_NAME,
        sa.Column(OLD_COLUMN, sa.String(200), nullable=True)
    )

    # Step 2: Copy data from new to old
    op.execute(f"UPDATE {TABLE_NAME} SET {OLD_COLUMN} = {NEW_COLUMN}")

    # Step 3: Recreate sync trigger (reversed direction)
    # ... (implement as needed)

    # NOTE: Full data restoration requires point-in-time recovery
'''


# =============================================================================
# VALIDATION QUERIES (Run before contract deployment)
# =============================================================================

VALIDATION_QUERIES = {
    "check_null_count": f"""
        SELECT COUNT(*) as null_count
        FROM {TABLE_NAME}
        WHERE {NEW_COLUMN} IS NULL;
    """,

    "check_old_column_queries": f"""
        SELECT query, calls, mean_exec_time
        FROM pg_stat_statements
        WHERE query ILIKE '%{OLD_COLUMN}%'
          AND query NOT ILIKE '%pg_%'
        ORDER BY calls DESC
        LIMIT 10;
    """,

    "check_index_valid": f"""
        SELECT indexrelid::regclass, indisvalid
        FROM pg_index
        WHERE indexrelid::regclass::text LIKE '%{TABLE_NAME}%{NEW_COLUMN}%';
    """,
}
