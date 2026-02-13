---
title: "DevOps: Database Migrations"
category: devops
impact: CRITICAL
impactDescription: "Destructive schema changes break running application instances during deployment — causing downtime, data loss, or failed rollbacks"
tags: [devops, database, migrations, zero-downtime]
---

## DevOps: Database Migrations

All schema changes must be backward-compatible with the currently running application version. Destructive changes require a multi-phase migration to achieve zero-downtime deployments.

**Incorrect:**
```sql
-- Destructive: renames column while old code still references 'name'
ALTER TABLE users RENAME COLUMN name TO full_name;

-- Destructive: adds NOT NULL column, old inserts fail immediately
ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL;

-- Destructive: drops column while old code still reads it
ALTER TABLE users DROP COLUMN legacy_field;
```

**Correct (3-phase zero-downtime migration):**
```sql
-- Phase 1: Add nullable column (safe with old code running)
ALTER TABLE users ADD COLUMN email VARCHAR(255);
```

```python
# Phase 2: Deploy new code that writes to both + backfill
def create_user(name: str, email: str):
    db.execute(
        "INSERT INTO users (name, email) VALUES (%s, %s)",
        (name, email),
    )

async def backfill_emails():
    users = await db.fetch("SELECT id FROM users WHERE email IS NULL")
    for user in users:
        email = generate_email(user.id)
        await db.execute(
            "UPDATE users SET email = %s WHERE id = %s",
            (email, user.id),
        )
```

```sql
-- Phase 3: Add constraint after backfill is verified complete
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
```

**Backward-compatible changes (safe to deploy directly):**
- Add nullable column
- Add new table
- Add index
- Rename column with a view alias

**Backward-incompatible changes (require 3-phase migration):**
- Remove column
- Rename column without alias
- Add NOT NULL column
- Change column type

**Deploy order:** migrate (phase 1) --> deploy new code (phase 2) --> migrate (phase 3)

**Key rules:**
- Always deploy migrations before the application code that depends on them
- Never add a NOT NULL column in a single step — use the 3-phase pattern (add nullable, backfill, add constraint)
- Always write a `downgrade()` function so migrations can be rolled back (`alembic downgrade -1`)
- Always review auto-generated migrations before applying (`alembic revision --autogenerate`)
- Test rollback procedures regularly — do not assume `downgrade()` works without verification
- Column renames require a view alias to maintain backward compatibility during rollout

Reference: `references/environment-management.md` (lines 115-162)
