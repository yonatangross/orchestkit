# Environment Coordination Patterns

## Multi-Environment Migration Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Local     │───>│     CI      │───>│   Staging   │───>│ Production  │
│   (dev)     │    │   (test)    │    │   (preview) │    │   (live)    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │                  │
       v                  v                  v                  v
   alembic            alembic           alembic            alembic
   upgrade            upgrade           upgrade            upgrade
    head               head              head               head
```

## Environment-Specific Settings

```python
# alembic/env.py
import os

def run_migrations_online():
    env = os.getenv("ENVIRONMENT", "development")

    if env == "production":
        # Use statement timeout for safety
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
from alembic import op
from sqlalchemy import text

def upgrade():
    # Acquire advisory lock (blocks until available)
    op.execute(text("SELECT pg_advisory_lock(12345)"))

    try:
        op.create_table('new_table', ...)
    finally:
        # Release lock
        op.execute(text("SELECT pg_advisory_unlock(12345)"))
```

## Migration Numbering Schemes

```
Option 1: Sequential
001_initial_schema.sql
002_add_users.sql
003_add_orders.sql

Option 2: Timestamp
20260115120000_initial_schema.sql
20260116143000_add_users.sql
20260117091500_add_orders.sql

Option 3: Hybrid (Date + Sequence)
2026_01_15_001_initial_schema.sql
2026_01_15_002_add_users.sql
2026_01_16_001_add_orders.sql
```

## Best Practices

| Practice | Reason |
|----------|--------|
| Always test migrations locally first | Catch errors early |
| Use transaction per migration | Atomic rollback on failure |
| Set lock timeouts in production | Prevent long-held locks |
| Never skip environments | Ensure consistency |
