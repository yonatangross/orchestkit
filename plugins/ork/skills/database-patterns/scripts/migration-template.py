"""${message}

Revision ID: ${revision}
Revises: ${down_revision}
Create Date: ${create_date}

Purpose:
    Brief description of what this migration does and why.

Rollback Plan:
    How to safely rollback if issues occur.

Dependencies:
    Any application changes required before/after this migration.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# Revision identifiers
revision: str = '${revision}'
down_revision: str | None = '${down_revision}'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Configuration
BATCH_SIZE = 5000  # Adjust based on table size and resources


def upgrade() -> None:
    """Apply migration changes."""
    # ============================================================
    # EXAMPLE: Create new table
    # ============================================================
    # op.create_table('table_name',
    #     sa.Column('id', UUID(as_uuid=True), primary_key=True,
    #               server_default=sa.text('gen_random_uuid()')),
    #     sa.Column('name', sa.String(255), nullable=False),
    #     sa.Column('created_at', sa.DateTime(timezone=True),
    #               server_default=sa.func.now()),
    #     sa.Column('updated_at', sa.DateTime(timezone=True),
    #               server_default=sa.func.now()),
    # )

    # ============================================================
    # EXAMPLE: Add column (nullable first for safety)
    # ============================================================
    # op.add_column('users',
    #     sa.Column('new_column', sa.String(100), nullable=True)
    # )
    #
    # # Add foreign key if needed
    # op.create_foreign_key(
    #     'fk_users_related',
    #     'users', 'related_table',
    #     ['new_column_id'], ['id'],
    #     ondelete='SET NULL'
    # )

    # ============================================================
    # EXAMPLE: Create index CONCURRENTLY (for large tables)
    # ============================================================
    # op.execute("COMMIT")  # Exit transaction for CONCURRENTLY
    # op.execute("""
    #     CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_table_column
    #     ON table_name (column_name)
    #     WHERE deleted_at IS NULL
    # """)

    # ============================================================
    # EXAMPLE: Batch data migration
    # ============================================================
    # _migrate_data_in_batches()

    pass  # Remove when adding operations


def downgrade() -> None:
    """Reverse migration changes."""
    # ============================================================
    # IMPORTANT: Reverse operations in OPPOSITE order of upgrade
    # ============================================================

    # Drop indexes (if created with CONCURRENTLY)
    # op.execute("COMMIT")
    # op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_table_column")

    # Drop foreign keys before columns
    # op.drop_constraint('fk_users_related', 'users', type_='foreignkey')

    # Drop columns
    # op.drop_column('users', 'new_column')

    # Drop tables
    # op.drop_table('table_name')

    pass  # Remove when adding operations


# ============================================================
# Helper Functions for Data Migrations
# ============================================================

def _migrate_data_in_batches() -> None:
    """Migrate data in batches to avoid long locks and memory issues."""
    conn = op.get_bind()

    total_processed = 0

    while True:
        # Fetch batch - use FOR UPDATE SKIP LOCKED for concurrent safety
        result = conn.execute(sa.text("""
            SELECT id, source_column
            FROM source_table
            WHERE needs_migration = true
            ORDER BY id
            LIMIT :batch_size
            FOR UPDATE SKIP LOCKED
        """), {'batch_size': BATCH_SIZE})

        rows = result.fetchall()
        if not rows:
            break

        # Process batch
        for row_id, source_value in rows:
            # Transform and insert/update
            conn.execute(sa.text("""
                UPDATE source_table
                SET target_column = :new_value,
                    needs_migration = false
                WHERE id = :id
            """), {
                'id': row_id,
                'new_value': _transform_value(source_value)
            })

        # Commit per batch to release locks
        conn.commit()

        total_processed += len(rows)
        print(f"Processed {total_processed} rows...")

    print(f"Migration complete. Total rows processed: {total_processed}")


def _transform_value(value):
    """Transform source value to target format."""
    # Implement transformation logic
    return value


# ============================================================
# Concurrent Index Creation Template
# ============================================================

def _create_index_concurrently(index_name: str, table: str, columns: str,
                                where_clause: str = None) -> None:
    """Create index without blocking reads/writes."""
    op.execute("COMMIT")  # Must exit transaction

    where = f"WHERE {where_clause}" if where_clause else ""
    op.execute(f"""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS {index_name}
        ON {table} ({columns})
        {where}
    """)


def _drop_index_concurrently(index_name: str) -> None:
    """Drop index without blocking reads/writes."""
    op.execute("COMMIT")  # Must exit transaction
    op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {index_name}")


# ============================================================
# Safe Column Operations Template
# ============================================================

def _add_not_null_column_safely(table: str, column: str,
                                 column_type: sa.types.TypeEngine,
                                 default_value) -> None:
    """Add NOT NULL column in three phases for zero downtime."""
    # Phase 1: Add nullable column
    op.add_column(table, sa.Column(column, column_type, nullable=True))

    # Phase 2: Backfill with default
    conn = op.get_bind()
    conn.execute(sa.text(f"""
        UPDATE {table} SET {column} = :default WHERE {column} IS NULL
    """), {'default': default_value})
    conn.commit()

    # Phase 3: Add NOT NULL constraint
    op.alter_column(table, column, nullable=False)


# ============================================================
# Rollback Safety Check
# ============================================================

def _verify_rollback_safe() -> bool:
    """Check if rollback is safe to execute."""
    conn = op.get_bind()

    # Add checks specific to your migration
    # Example: verify no data would be lost
    result = conn.execute(sa.text("""
        SELECT COUNT(*) FROM table_name WHERE critical_column IS NOT NULL
    """))

    count = result.scalar()
    if count > 0:
        print(f"WARNING: Rollback will affect {count} rows")
        return False

    return True
