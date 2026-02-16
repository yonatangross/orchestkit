---
title: "Versioning: Drift Detection"
category: versioning
impact: HIGH
impactDescription: Schema drift between environments causes silent failures and deployment incidents. Checksum verification and environment coordination prevent unauthorized changes.
tags: [drift, environment-sync, checksum, advisory-locks, migration-coordination]
---

# Versioning Drift Detection

## Multi-Environment Migration Flow

```
Local (dev) -> CI (test) -> Staging (preview) -> Production (live)
  alembic       alembic       alembic            alembic
  upgrade       upgrade       upgrade            upgrade
   head          head          head               head
```

**Never skip environments.** Always: local -> CI -> staging -> production.

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

## Environment-Specific Settings

```python
# alembic/env.py
import os

def run_migrations_online():
    env = os.getenv("ENVIRONMENT", "development")

    if env == "production":
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            transaction_per_migration=True,
            postgresql_set_session_options={
                "statement_timeout": "30s",
                "lock_timeout": "10s"
            }
        )
    else:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )
```

## Migration Locks (Prevent Concurrent Migrations)

```python
"""Migration with advisory lock.

Prevents multiple instances from running migrations simultaneously.
"""
def upgrade():
    # Acquire advisory lock (blocks until available)
    op.execute(text("SELECT pg_advisory_lock(12345)"))

    try:
        op.create_table('new_table', ...)
    finally:
        op.execute(text("SELECT pg_advisory_unlock(12345)"))
```

## Migration Numbering Schemes

```
Option 1: Sequential       001_initial.sql, 002_add_users.sql
Option 2: Timestamp         20260115120000_initial.sql
Option 3: Hybrid            2026_01_15_001_initial.sql
```

Recommendation: Timestamp-based (avoids conflicts in parallel development).

## Conditional Migration Logic

```python
"""Add analytics index (production only)."""
def upgrade() -> None:
    if os.getenv('ENVIRONMENT') == 'production':
        op.execute("COMMIT")
        op.execute("""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_timestamp
            ON events (timestamp DESC)
        """)
    else:
        op.create_index('idx_events_timestamp', 'events', ['timestamp'])
```

## Best Practices

| Practice | Reason |
|----------|--------|
| Always test migrations locally first | Catch errors early |
| Use transaction per migration | Atomic rollback on failure |
| Set lock timeouts in production | Prevent long-held locks |
| Never skip environments | Ensure consistency |
| Checksum deployed migrations | Detect unauthorized changes |
| Environment parity | Consistent deployments |

**Incorrect — Skipping environments:**
```bash
# Dangerous: Deploy to prod without staging test
alembic upgrade head  # On production DB directly
```

**Correct — Progressive deployment:**
```bash
# Safe: Test in each environment sequentially
alembic upgrade head  # Local
# CI tests pass
alembic upgrade head  # Staging
# Smoke tests pass
alembic upgrade head  # Production
```

## Anti-Patterns

- Modifying deployed migrations (create new migration instead)
- Skipping staging and deploying directly to production
- Running concurrent migrations without advisory locks
- Versioning sensitive data in migrations (security risk)
