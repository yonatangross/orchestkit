---
title: "Alembic: Branching & Merging"
category: alembic
impact: CRITICAL
impactDescription: Parallel development creates migration branch conflicts. Proper merge strategies prevent lost migrations and deployment failures.
tags: [alembic, branching, merge, multi-database, feature-branches]
---

# Alembic Branching & Merge Patterns

## Creating Feature Branches

```bash
# Create a feature branch
alembic revision --branch-label=feature_payments -m "start payments feature"

# Create revision on branch
alembic revision --head=feature_payments@head -m "add payment_methods table"

# View branch structure
alembic branches

# Merge branches before deployment
alembic merge feature_payments@head main@head -m "merge payments feature"
```

## Merge Migration

```python
"""Merge feature_payments and main branches.

Revision ID: merge_abc
Revises: ('abc123', 'def456')
"""
revision = 'merge_abc'
down_revision = ('abc123', 'def456')  # Tuple for merge

def upgrade() -> None:
    pass  # No operations - marks merge point

def downgrade() -> None:
    raise Exception("Cannot downgrade past merge point")
```

## Multi-Database Migrations

```python
# alembic/env.py - Multi-database support
DATABASES = {
    'default': 'postgresql://user:pass@localhost/main',
    'analytics': 'postgresql://user:pass@localhost/analytics',
}

def run_migrations_online():
    for db_name, url in DATABASES.items():
        config = context.config
        config.set_main_option('sqlalchemy.url', url)
        connectable = engine_from_config(
            config.get_section(config.config_ini_section),
            prefix='sqlalchemy.', poolclass=pool.NullPool,
        )
        with connectable.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=get_metadata(db_name),
                version_table=f'alembic_version_{db_name}',
            )
            with context.begin_transaction():
                context.run_migrations()
```

## Column Rename (Expand-Contract)

```python
"""Phase 1: Add new column alongside old."""
def upgrade() -> None:
    op.add_column('users', sa.Column('full_name', sa.String(255), nullable=True))

    # Create trigger to sync during transition
    op.execute("""
        CREATE OR REPLACE FUNCTION sync_user_name()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.full_name = COALESCE(NEW.full_name, NEW.name);
            NEW.name = COALESCE(NEW.name, NEW.full_name);
            RETURN NEW;
        END; $$ LANGUAGE plpgsql;

        CREATE TRIGGER trg_sync_user_name
        BEFORE INSERT OR UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION sync_user_name();
    """)

def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_sync_user_name ON users")
    op.execute("DROP FUNCTION IF EXISTS sync_user_name()")
    op.drop_column('users', 'full_name')
```

## Key Decisions

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Column rename | 4-phase expand/contract | Safe migration without downtime |
| Branch merge | Merge before deployment | Prevents version conflicts |
| Multi-database | Separate version tables | Independent migration tracking |
| Transaction mode | Default on, disable for CONCURRENTLY | CONCURRENTLY requires no transaction |

## Common Mistakes

- Merging branches without testing both paths first
- Skipping expand-contract for column renames (causes downtime)
- Using shared version table for multiple databases
- Not using `--branch-label` for feature isolation
