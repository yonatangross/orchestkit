# Alembic Migration Examples

Complete, production-ready migration examples.

## Add Column with Default Value

```python
"""Add organization_id to users with default.

Revision ID: add_org_001
Revises: previous_rev
Create Date: 2026-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'add_org_001'
down_revision = 'previous_rev'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add column as nullable first (no lock)
    op.add_column('users',
        sa.Column('organization_id', UUID(as_uuid=True), nullable=True)
    )

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_users_organization',
        'users', 'organizations',
        ['organization_id'], ['id'],
        ondelete='SET NULL'
    )

    # Backfill with default organization (in separate transaction for large tables)
    op.execute("""
        UPDATE users
        SET organization_id = (SELECT id FROM organizations WHERE is_default = true)
        WHERE organization_id IS NULL
    """)

def downgrade() -> None:
    op.drop_constraint('fk_users_organization', 'users', type_='foreignkey')
    op.drop_column('users', 'organization_id')
```

## Create Index CONCURRENTLY

```python
"""Add composite index for user search queries.

Revision ID: idx_user_search
Revises: add_org_001
Create Date: 2026-01-15

Note: Uses CONCURRENTLY to avoid blocking reads/writes.
Migration must run outside transaction.
"""
from alembic import op

revision = 'idx_user_search'
down_revision = 'add_org_001'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # CRITICAL: Exit transaction for CONCURRENTLY
    op.execute("COMMIT")

    # Composite index for common query pattern
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_org_status_created
        ON users (organization_id, status, created_at DESC)
        WHERE deleted_at IS NULL
    """)

    # GIN index for full-text search on name
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_name_trgm
        ON users USING gin (name gin_trgm_ops)
    """)

def downgrade() -> None:
    op.execute("COMMIT")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_users_name_trgm")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_users_org_status_created")
```

## Data Migration with Batching

```python
"""Migrate user preferences from JSON to normalized table.

Revision ID: migrate_prefs
Revises: idx_user_search
Create Date: 2026-01-15

Handles millions of rows with batch processing.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
import json

revision = 'migrate_prefs'
down_revision = 'idx_user_search'
branch_labels = None
depends_on = None

BATCH_SIZE = 5000

def upgrade() -> None:
    # Create new preferences table
    op.create_table('user_preferences',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('key', sa.String(100), nullable=False),
        sa.Column('value', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
    )

    # Add constraints
    op.create_foreign_key('fk_user_prefs_user', 'user_preferences', 'users',
                          ['user_id'], ['id'], ondelete='CASCADE')
    op.create_unique_constraint('uq_user_prefs_user_key', 'user_preferences',
                                ['user_id', 'key'])

    # Migrate data in batches
    conn = op.get_bind()

    offset = 0
    while True:
        # Fetch batch of users with preferences
        result = conn.execute(sa.text("""
            SELECT id, preferences
            FROM users
            WHERE preferences IS NOT NULL
              AND preferences != '{}'::jsonb
            ORDER BY id
            LIMIT :batch_size OFFSET :offset
        """), {'batch_size': BATCH_SIZE, 'offset': offset})

        rows = result.fetchall()
        if not rows:
            break

        # Transform and insert preferences
        for user_id, prefs in rows:
            if prefs:
                pref_dict = prefs if isinstance(prefs, dict) else json.loads(prefs)
                for key, value in pref_dict.items():
                    conn.execute(sa.text("""
                        INSERT INTO user_preferences (user_id, key, value)
                        VALUES (:user_id, :key, :value)
                        ON CONFLICT (user_id, key) DO NOTHING
                    """), {'user_id': user_id, 'key': key, 'value': str(value)})

        conn.commit()
        offset += BATCH_SIZE
        print(f"Migrated {offset} users...")

    # Create index after data load (faster than during inserts)
    op.create_index('idx_user_prefs_user_id', 'user_preferences', ['user_id'])

def downgrade() -> None:
    # Migrate data back to JSON column
    conn = op.get_bind()

    conn.execute(sa.text("""
        UPDATE users u
        SET preferences = (
            SELECT jsonb_object_agg(key, value)
            FROM user_preferences up
            WHERE up.user_id = u.id
        )
        WHERE EXISTS (
            SELECT 1 FROM user_preferences WHERE user_id = u.id
        )
    """))
    conn.commit()

    op.drop_table('user_preferences')
```

## Enum Type Changes

```python
"""Add new status values to user_status enum.

Revision ID: enum_status
Revises: migrate_prefs
Create Date: 2026-01-15

PostgreSQL enum modification requires special handling.
"""
from alembic import op

revision = 'enum_status'
down_revision = 'migrate_prefs'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add new values to existing enum
    op.execute("ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'suspended'")
    op.execute("ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'pending_verification'")

    # Note: Cannot remove enum values in PostgreSQL
    # For removal, must recreate enum type (see downgrade for pattern)

def downgrade() -> None:
    # Recreate enum without new values (complex operation)
    # First, update any rows using new values
    op.execute("""
        UPDATE users
        SET status = 'inactive'
        WHERE status IN ('suspended', 'pending_verification')
    """)

    # Rename old enum
    op.execute("ALTER TYPE user_status RENAME TO user_status_old")

    # Create new enum without new values
    op.execute("CREATE TYPE user_status AS ENUM ('active', 'inactive', 'deleted')")

    # Update column to use new enum
    op.execute("""
        ALTER TABLE users
        ALTER COLUMN status TYPE user_status
        USING status::text::user_status
    """)

    # Drop old enum
    op.execute("DROP TYPE user_status_old")
```

## Add Table with Partitioning

```python
"""Add partitioned events table for analytics.

Revision ID: events_partition
Revises: enum_status
Create Date: 2026-01-15

Uses PostgreSQL native partitioning for time-series data.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'events_partition'
down_revision = 'enum_status'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Create partitioned parent table
    op.execute("""
        CREATE TABLE events (
            id UUID DEFAULT gen_random_uuid(),
            event_type VARCHAR(100) NOT NULL,
            user_id UUID,
            payload JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id, created_at)
        ) PARTITION BY RANGE (created_at)
    """)

    # Create initial partitions (monthly)
    op.execute("""
        CREATE TABLE events_2026_01 PARTITION OF events
        FOR VALUES FROM ('2026-01-01') TO ('2026-02-01')
    """)
    op.execute("""
        CREATE TABLE events_2026_02 PARTITION OF events
        FOR VALUES FROM ('2026-02-01') TO ('2026-03-01')
    """)
    op.execute("""
        CREATE TABLE events_2026_03 PARTITION OF events
        FOR VALUES FROM ('2026-03-01') TO ('2026-04-01')
    """)

    # Create indexes on parent (propagates to partitions)
    op.execute("COMMIT")  # For CONCURRENTLY
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_user_type
        ON events (user_id, event_type, created_at DESC)
    """)

    # Add FK constraint
    op.create_foreign_key('fk_events_user', 'events', 'users',
                          ['user_id'], ['id'], ondelete='SET NULL')

def downgrade() -> None:
    op.drop_table('events_2026_03')
    op.drop_table('events_2026_02')
    op.drop_table('events_2026_01')
    op.drop_table('events')
```

## Rename Column Safely (Expand-Contract)

```python
"""Phase 1: Add email_address alongside email.

Revision ID: rename_email_p1
Revises: events_partition
Create Date: 2026-01-15

Safe column rename using expand-contract pattern.
Run Phase 2 after application code is updated.
"""
from alembic import op
import sqlalchemy as sa

revision = 'rename_email_p1'
down_revision = 'events_partition'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add new column
    op.add_column('users', sa.Column('email_address', sa.String(255), nullable=True))

    # Copy existing data
    op.execute("UPDATE users SET email_address = email")

    # Create sync trigger for transition period
    op.execute("""
        CREATE OR REPLACE FUNCTION sync_user_email()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.email IS DISTINCT FROM OLD.email THEN
                NEW.email_address = NEW.email;
            ELSIF NEW.email_address IS DISTINCT FROM OLD.email_address THEN
                NEW.email = NEW.email_address;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trg_sync_email
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION sync_user_email();
    """)

def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_sync_email ON users")
    op.execute("DROP FUNCTION IF EXISTS sync_user_email()")
    op.drop_column('users', 'email_address')
```
