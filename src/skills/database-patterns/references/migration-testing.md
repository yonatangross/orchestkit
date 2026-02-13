# Migration Testing Patterns

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
    # Get all revisions
    script = ScriptDirectory.from_config(alembic_config)
    revisions = list(script.walk_revisions())

    # Apply all migrations
    command.upgrade(alembic_config, "head")

    # Downgrade all migrations
    command.downgrade(alembic_config, "base")

    # Verify clean state
    assert get_table_count(test_db) == 0
```

## Checksum Verification

```python
def test_migration_checksums(alembic_config):
    """Verify migrations haven't been modified after deployment."""
    script = ScriptDirectory.from_config(alembic_config)

    for revision in script.walk_revisions():
        if revision.revision in DEPLOYED_MIGRATIONS:
            current_checksum = calculate_checksum(revision.path)
            expected_checksum = DEPLOYED_MIGRATIONS[revision.revision]
            assert current_checksum == expected_checksum, \
                f"Migration {revision.revision} was modified after deployment!"
```

## Data Integrity Testing

```python
def test_migration_preserves_data(alembic_config, test_db):
    """Verify migration doesn't lose data."""
    # Insert test data
    insert_test_records(test_db, count=100)
    original_count = get_record_count(test_db)

    # Run migration
    command.upgrade(alembic_config, "+1")

    # Verify data preserved
    new_count = get_record_count(test_db)
    assert new_count == original_count
```

## Rollback Testing

```python
def test_rollback_safety(alembic_config, test_db):
    """Verify rollback restores previous state."""
    # Get initial state
    command.upgrade(alembic_config, "head")
    pre_rollback_schema = get_schema_snapshot(test_db)

    # Apply new migration
    apply_pending_migration(alembic_config)

    # Rollback
    command.downgrade(alembic_config, "-1")

    # Verify schema restored
    post_rollback_schema = get_schema_snapshot(test_db)
    assert pre_rollback_schema == post_rollback_schema
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
      run: |
        pytest tests/test_migrations.py -v
```
