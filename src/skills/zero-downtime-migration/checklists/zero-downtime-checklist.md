# Zero-Downtime Migration Checklist

Use this checklist before each phase of an expand-contract migration.

## Pre-Expand Phase

### Schema Design Review

- [ ] New column is NULLABLE (no NOT NULL on expand)
- [ ] Default value is non-volatile (or omitted)
- [ ] Column type matches future requirements (avoid second migration)
- [ ] Index creation uses CONCURRENTLY keyword
- [ ] Constraint uses NOT VALID for deferred validation

### Backward Compatibility

- [ ] Current app version ignores new column (SELECT * still works)
- [ ] ORM models don't require new column
- [ ] API responses unchanged (no new required fields)
- [ ] Existing queries won't break with new schema

### Testing Requirements

- [ ] Migration tested on production-size dataset
- [ ] Rollback migration tested and verified
- [ ] Performance benchmarks captured (before state)
- [ ] Query execution plans reviewed

## Expand Deployment

### Execution

- [ ] Deploy migration during low-traffic window
- [ ] Monitor pg_stat_activity for long-running queries
- [ ] Verify index creation completed (check pg_stat_progress_create_index)
- [ ] Confirm no lock wait events

### Post-Expand Verification

```sql
-- Run these queries after expand deployment
```

- [ ] New column exists: `\d+ table_name`
- [ ] Column is nullable: `SELECT is_nullable FROM information_schema.columns`
- [ ] Index is valid: `SELECT indexrelid::regclass, indisvalid FROM pg_index`
- [ ] No invalid constraints: `SELECT conname, convalidated FROM pg_constraint`

## Transition Phase

### Application Deployment

- [ ] Enable dual-write in application code
- [ ] Deploy new app version to subset (canary)
- [ ] Monitor error rates for 30+ minutes
- [ ] Roll out to remaining instances

### Data Backfill

- [ ] Backfill script uses batch processing (1000-10000 rows)
- [ ] Backfill includes progress logging
- [ ] Dead tuple count monitored during backfill
- [ ] VACUUM scheduled after backfill completion

```sql
-- Verify backfill completion
SELECT COUNT(*) FILTER (WHERE new_column IS NULL) AS unfilled,
       COUNT(*) AS total
FROM table_name;
```

### Monitoring Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error rate increase | > 0.1% | > 1% | Pause rollout |
| p99 latency increase | > 20% | > 50% | Investigate |
| Lock wait time | > 100ms | > 1s | Check blocking |
| Replication lag | > 10s | > 60s | Pause migration |

## Pre-Contract Phase

### Readiness Verification

- [ ] All application instances on new code (no old readers)
- [ ] Query logs show zero access to old column (72+ hours)
- [ ] Feature flag at 100% (if applicable)
- [ ] Monitoring stable for 24+ hours
- [ ] Rollback window expired (72 hours minimum)

### Query Log Verification

```sql
-- Ensure no queries reference old column
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%old_column_name%'
  AND query NOT LIKE '%pg_stat%'
ORDER BY calls DESC;
```

## Contract Deployment

### Pre-Execution

- [ ] Database backup verified (point-in-time recovery tested)
- [ ] Downgrade path documented (even if painful)
- [ ] On-call engineer notified
- [ ] Change ticket approved

### Execution Sequence

1. [ ] Drop triggers first (if dual-write triggers exist)
2. [ ] Drop old column
3. [ ] Add NOT NULL constraint (if required)
4. [ ] Validate any NOT VALID constraints
5. [ ] Update table statistics: `ANALYZE table_name`

### Post-Contract Verification

- [ ] Application healthy (no errors related to dropped column)
- [ ] Query plans still optimal (no regressions)
- [ ] ORM models updated to remove old field references
- [ ] Documentation updated (schema diagrams, ERDs)

## Rollback Triggers

### Automatic Rollback Conditions

Initiate rollback if ANY of these occur:

- [ ] Error rate > 1% for 5+ minutes
- [ ] p99 latency > 2x baseline for 10+ minutes
- [ ] Database connection pool exhaustion
- [ ] Replication lag > 5 minutes

### Rollback Procedure

```bash
# 1. Disable feature flag (immediate)
feature_flags disable use_new_column

# 2. Deploy previous application version
kubectl rollout undo deployment/api

# 3. If in contract phase, escalate to DBA
# (Schema restoration required from backup)
```

## Sign-Off

| Phase | Engineer | Date | Notes |
|-------|----------|------|-------|
| Expand approved | | | |
| Expand deployed | | | |
| Transition complete | | | |
| Contract approved | | | |
| Contract deployed | | | |
| Migration complete | | | |
