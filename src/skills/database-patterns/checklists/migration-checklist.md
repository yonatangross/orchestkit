# Migration Deployment Checklist

Verification steps for safe database migration deployment.

## Pre-Deployment Checks

### Code Review

- [ ] Migration file has descriptive docstring with purpose
- [ ] `revision` and `down_revision` are correct
- [ ] `upgrade()` contains all necessary changes
- [ ] `downgrade()` properly reverses all changes (tested!)
- [ ] No hardcoded environment-specific values
- [ ] Large table operations use `CONCURRENTLY` where applicable

### Schema Validation

- [ ] Run `alembic check` - no pending model changes
- [ ] Generate SQL: `alembic upgrade head --sql > migration.sql`
- [ ] Review generated SQL for unexpected operations
- [ ] Verify column types match SQLAlchemy model definitions
- [ ] Check constraint names follow naming conventions

### Backward Compatibility

- [ ] New columns are `nullable=True` or have `server_default`
- [ ] No column/table renames (use expand-contract pattern)
- [ ] No `NOT NULL` constraints added to existing columns with data
- [ ] Application code works with both old and new schema
- [ ] API responses unchanged (or versioned)

## Rollback Testing

### Local Rollback Verification

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

### Rollback Checklist

- [ ] `alembic downgrade -1` succeeds without errors
- [ ] Data is preserved after rollback (if applicable)
- [ ] Indexes and constraints are properly removed
- [ ] Triggers and functions are cleaned up
- [ ] Application functions correctly after rollback

## Data Backup Verification

### Before Production Migration

- [ ] Full database backup completed
- [ ] Backup verified (can restore to test environment)
- [ ] Point-in-time recovery configured (if using RDS/Cloud SQL)
- [ ] Backup retention policy confirmed (minimum 7 days)
- [ ] Document backup timestamp and location

### Backup Commands

```bash
# PostgreSQL backup
pg_dump -Fc -v -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).dump

# Verify backup
pg_restore --list backup_*.dump | head -20

# Test restore to separate database
createdb restore_test
pg_restore -d restore_test backup_*.dump
```

## Production Deployment Steps

### 1. Pre-Flight (T-30 minutes)

- [ ] Notify team of upcoming migration window
- [ ] Verify backup completed successfully
- [ ] Check current migration version: `alembic current`
- [ ] Review migration history: `alembic history -v`
- [ ] Confirm rollback plan documented

### 2. Deployment Execution

```bash
# Generate SQL for final review
alembic upgrade head --sql > /tmp/migration_$(date +%Y%m%d).sql

# Review SQL one more time
cat /tmp/migration_$(date +%Y%m%d).sql

# Apply migration with timing
time alembic upgrade head

# Verify new version
alembic current
```

### 3. Post-Migration Verification

- [ ] Check `alembic current` shows expected revision
- [ ] Verify schema changes with `\d tablename`
- [ ] Run smoke tests against API endpoints
- [ ] Check application logs for database errors
- [ ] Monitor database metrics (connections, query latency)
- [ ] Verify no increase in error rates

### 4. Rollback Procedure (If Needed)

```bash
# Immediate rollback
alembic downgrade -1

# Verify rollback
alembic current

# Notify team of rollback
# Investigate and fix before retry
```

## Large Table Migration Checklist

### Additional Checks for Tables > 1M Rows

- [ ] Estimated migration duration calculated
- [ ] `CONCURRENTLY` used for index operations
- [ ] Batch processing implemented for data migrations
- [ ] Lock wait timeout configured: `SET lock_timeout = '5s'`
- [ ] Statement timeout configured: `SET statement_timeout = '30m'`
- [ ] Maintenance window scheduled (if blocking operations)

### Monitoring During Migration

- [ ] Active queries: `SELECT * FROM pg_stat_activity WHERE state = 'active'`
- [ ] Lock monitoring: `SELECT * FROM pg_locks WHERE NOT granted`
- [ ] Table bloat after migration
- [ ] Replication lag (if applicable)

## Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| DBA On-Call | [Slack/Phone] | Database issues |
| Backend Lead | [Slack/Phone] | Application issues |
| Infrastructure | [Slack/Phone] | Connection/network |

## Post-Deployment Tasks

- [ ] Update documentation if schema changed significantly
- [ ] Close related tickets/issues
- [ ] Schedule VACUUM ANALYZE if large changes
- [ ] Archive migration SQL for audit trail
- [ ] Confirm monitoring alerts are not firing
