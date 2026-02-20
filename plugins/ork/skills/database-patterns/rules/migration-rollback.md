---
title: Plan migration rollbacks and monitor execution to prevent extended outages
impact: HIGH
impactDescription: "Failed migrations without rollback plans cause extended production outages"
tags: rollback, monitoring, pgroll, replication-lag, migration-safety
---

## Migration Rollback and Monitoring

**Incorrect — no rollback plan or monitoring:**
```sql
-- FORBIDDEN: Constraint validation in same transaction as creation
ALTER TABLE orders ADD CONSTRAINT fk_org
FOREIGN KEY (org_id) REFERENCES orgs(id);
-- Impact: Full table scan with exclusive lock

-- FORBIDDEN: Backfill without batching
UPDATE users SET new_col = old_col;
-- Impact: Locks entire table, fills transaction log

-- FORBIDDEN: Skip environments
-- Always: local -> CI -> staging -> production
```

**Correct — pgroll automated rollback:**
```bash
# Install pgroll
brew install xataio/pgroll/pgroll

# Initialize pgroll in your database
pgroll init --postgres-url "postgres://user:pass@localhost/db"
```

```json
{
  "name": "001_add_email_verified",
  "operations": [
    {
      "add_column": {
        "table": "users",
        "column": {
          "name": "email_verified",
          "type": "boolean",
          "default": "false",
          "nullable": false
        },
        "up": "false"
      }
    }
  ]
}
```

```bash
# Start migration (creates versioned schema)
pgroll start migrations/001_add_email_verified.json

# After verification, complete migration
pgroll complete

# Rollback if issues
pgroll rollback
```

### Monitoring During Migration

```sql
-- Check for locks during migration
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
AND state != 'idle';

-- Check replication lag (if using replicas)
SELECT client_addr, state, (sent_lsn - replay_lsn) AS replication_lag
FROM pg_stat_replication;

-- Monitor backfill progress
SELECT
  COUNT(*) FILTER (WHERE display_name IS NOT NULL) as migrated,
  COUNT(*) FILTER (WHERE display_name IS NULL) as remaining,
  ROUND(100.0 * COUNT(*) FILTER (WHERE display_name IS NOT NULL) / COUNT(*), 2) as pct_complete
FROM users;
```

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Automated rollback | Use pgroll for dual-schema versioning |
| Verification | Check pg_stat_statements before contract phase |
| Lock monitoring | Query pg_stat_activity during migration |
| Replication | Monitor lag before completing migration |
| Environment order | local -> CI -> staging -> production (never skip) |
