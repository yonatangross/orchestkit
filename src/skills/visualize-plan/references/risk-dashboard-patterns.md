# Risk Dashboard Patterns

Reversibility timelines and pre-mortem scenarios.

## Reversibility Timeline

Shows each phase's undo capability. The point of no return is the most important signal.

### Standard Format

```
REVERSIBILITY TIMELINE

Phase 1  [================]  FULLY REVERSIBLE    (add column, nullable)
Phase 2  [================]  FULLY REVERSIBLE    (new endpoint, additive)
Phase 3  [============....]  PARTIALLY           (backfill data, can truncate)
              --- POINT OF NO RETURN ---
Phase 4  [........????????]  IRREVERSIBLE        (drop old column, data lost)
Phase 5  [================]  FULLY REVERSIBLE    (frontend toggle via flag)

Recommendation: Add backup step before Phase 4
```

### Fill Pattern Legend

```
[================]  FULLY REVERSIBLE    — Can undo completely, no data loss
[============....]  PARTIALLY           — Can undo, but some manual cleanup needed
[========........]  DIFFICULT           — Requires backup restore or significant effort
[....????????????]  IRREVERSIBLE        — Cannot undo, data permanently changed
```

### Compact Format (for simple plans)

```
Reversibility: Phase 1 [SAFE] -> Phase 2 [SAFE] -> Phase 3 [PARTIAL] -> Phase 4 [IRREVERSIBLE]
                                                                          ^
                                                               Point of no return
```

### With Rollback Instructions

```
REVERSIBILITY + ROLLBACK

Phase 1: Add users.billing_address column
  Reversibility: FULL
  Rollback: ALTER TABLE users DROP COLUMN billing_address;
  Time: <1 min  |  Data loss: NONE

Phase 2: Deploy billing API endpoints
  Reversibility: FULL
  Rollback: Revert deployment to previous version
  Time: ~3 min  |  Data loss: NONE

Phase 3: Backfill billing_address from legacy table
  Reversibility: PARTIAL
  Rollback: UPDATE users SET billing_address = NULL WHERE ...;
  Time: ~10 min  |  Data loss: backfilled data only

Phase 4: Drop legacy_billing table
  Reversibility: NONE
  Rollback: Restore from backup (Phase 0 snapshot required)
  Time: ~30 min  |  Data loss: ALL legacy billing if no backup
```

## Pre-Mortem Scenarios

Frame risks as "what already went wrong" narratives. More memorable than probability tables.

### The one rule: state a MECHANISM, not a category

A category names *what kind* of bad thing could happen. A mechanism names *what runs,
in what order, producing what bad state*. Only the second is actionable, because only a
mechanism can be contained.

This is the measured failure mode of this section, not a style preference. A 2026-08-04
eval graded real output and the grader's words were: *"names categories … but describes
no causal sequence of how failure occurs."*

```
❌ CATEGORY   "Migration risk — the schema change could cause problems"
❌ CATEGORY   "Manual JWT validation"              ← a topic heading, not a failure
✅ MECHANISM  "P2 ships while an in-flight retry queue still points at the inline
               charge path, so the same invoice is charged twice."
```

Write it as `<trigger> → <sequence> → <bad end state>`. The test: can a reader say
*when* it fires and *what state it leaves behind*? If it reads like a section heading,
it is still a category.

Containment must reference that specific mechanism. "Add tests" is not containment;
"idempotency key derived from invoice id, asserted before P2 merges" is.

Note how each scenario below names a trigger and an outcome, never just a topic.

### Standard Format (3 scenarios)

```
PRE-MORTEM: This plan failed because...

1. MOST LIKELY: Cache served stale prices after Stripe webhook
   Probability: HIGH  |  Impact: HIGH
   Mitigation: Add cache invalidation hook on webhook receipt
   Rollback: Clear Redis cache (30s recovery)
   Detection: Monitor cache hit rate, alert on stale-age > 60s

2. MOST SEVERE: Migration ran on replica before primary
   Probability: LOW  |  Impact: CRITICAL
   Mitigation: Run migration with explicit --primary flag, verify replication lag
   Rollback: Cannot cleanly roll back (need full backup restore)
   Detection: Check pg_stat_replication before and after

3. MOST SUBTLE: Frontend shows billing tab to free-tier users
   Probability: MEDIUM  |  Impact: MEDIUM
   Mitigation: Add feature flag check in BillingTab component
   Rollback: Disable feature flag (instant)
   Detection: QA checklist for each user tier
```

### Tabular Format (for quick scanning)

```
PRE-MORTEM RISK TABLE
+======================+========+==========+========================+=============+
| Scenario             | Prob.  | Impact   | Mitigation             | Rollback    |
+======================+========+==========+========================+=============+
| Stale cache after    | HIGH   | HIGH     | Cache invalidation     | Clear Redis |
| webhook update       |        |          | on webhook receipt     | (30s)       |
+----------------------+--------+----------+------------------------+-------------+
| Migration on replica | LOW    | CRITICAL | --primary flag +       | Full backup |
| before primary       |        |          | check replication lag  | restore     |
+----------------------+--------+----------+------------------------+-------------+
| Billing tab shown    | MEDIUM | MEDIUM   | Feature flag in        | Disable     |
| to free-tier users   |        |          | BillingTab component   | flag (0s)   |
+----------------------+--------+----------+------------------------+-------------+
```

## Risk-Impact Quadrant

For plans with many risk factors, use a 2x2 grid:

```
                     HIGH IMPACT
                         |
    MONITOR CLOSELY      |      ACT NOW
                         |
    * API versioning     |  * schema migration
    * env config         |  * cache invalidation
                         |
   ──────────────────────+─────────────────── HIGH LIKELIHOOD
                         |
    ACCEPT               |      MITIGATE
                         |
    * docs update        |  * feature flag timing
    * logging format     |  * DNS propagation
                         |
                     LOW IMPACT

Priority: ACT NOW > MITIGATE > MONITOR > ACCEPT
```

## Cascading Failure Analysis

For distributed systems, show how one failure propagates:

```
FAILURE CASCADE: Database connection pool exhausted

[Pool exhausted] --> [API timeouts] --> [Frontend 504s] --> [User complaints]
       |                   |                  |
       v                   v                  v
  Detection:          Detection:          Detection:
  Connection          p95 latency         Error rate
  count alert         > 5s alert          > 1% alert
  (30s)               (2 min)             (5 min)

Total detection time: 30s (if pool alert configured)
Blast radius without alert: ~5 min until user-visible
```
