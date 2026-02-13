---
title: "Versioning: Rollback"
category: versioning
impact: HIGH
impactDescription: Untested rollbacks in production lead to extended outages. Every migration must have a verified downgrade path with documented data loss risks.
tags: [rollback, downgrade, migration-testing, data-integrity, ci]
---

# Versioning Rollback Patterns

## Full Cycle Testing

```python
# tests/test_migrations.py
import pytest
from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory

@pytest.fixture
def alembic_config():
    return Config("alembic.ini")

def test_migrations_upgrade_downgrade(alembic_config, test_db):
    """Test all migrations can be applied and rolled back."""
    command.upgrade(alembic_config, "head")
    command.downgrade(alembic_config, "base")
    assert get_table_count(test_db) == 0
```

## Local Rollback Verification

```bash
# Apply migration
alembic upgrade head

# Verify schema change
psql -c "\d tablename"

# Rollback migration
alembic downgrade -1

# Verify rollback complete
psql -c "\d tablename"

# Re-apply to confirm idempotency
alembic upgrade head
```

## Data Integrity Testing

```python
def test_migration_preserves_data(alembic_config, test_db):
    """Verify migration doesn't lose data."""
    insert_test_records(test_db, count=100)
    original_count = get_record_count(test_db)

    command.upgrade(alembic_config, "+1")

    new_count = get_record_count(test_db)
    assert new_count == original_count
```

## Rollback Safety Check

```python
def test_rollback_safety(alembic_config, test_db):
    """Verify rollback restores previous state."""
    command.upgrade(alembic_config, "head")
    pre_rollback_schema = get_schema_snapshot(test_db)

    apply_pending_migration(alembic_config)
    command.downgrade(alembic_config, "-1")

    post_rollback_schema = get_schema_snapshot(test_db)
    assert pre_rollback_schema == post_rollback_schema
```

## Documenting Destructive Rollbacks

```python
"""Split phone_numbers column into user_phones table.

Revision ID: abc123
Revises: xyz456

WARNING: Downgrade will result in data loss. Phone number type
(mobile/home/work) cannot be restored to original format.
"""
def downgrade() -> None:
    # DESTRUCTIVE: Cannot restore original format
    op.add_column('analyses', sa.Column('phone_numbers', sa.Text, nullable=True))
    op.drop_table('user_phones')
```

## CI Integration

```yaml
# .github/workflows/migrations.yml
migration-test:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_PASSWORD: test
  steps:
    - uses: actions/checkout@v4
    - name: Test migrations
      run: pytest tests/test_migrations.py -v
```

## Anti-Patterns

```python
# NEVER: Skip downgrade implementation
def downgrade():
    pass  # WRONG - implement proper rollback

# NEVER: Modify deployed migrations - create new migration instead

# NEVER: Delete migration history
command.stamp(alembic_config, "head")  # Loses history
```

## Key Decisions

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Test rollbacks | Always verify locally + CI | Prevents production surprises |
| Destructive rollbacks | Document in migration docstring | Clear risk communication |
| Production rollback | `alembic downgrade -1` then investigate | Fast recovery, fix later |
| Immutable migrations | Never modify after deployment | Audit trail integrity |
