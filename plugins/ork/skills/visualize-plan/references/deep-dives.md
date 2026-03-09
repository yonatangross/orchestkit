---
title: Deep Dive Patterns (Tier 3)
description: Cross-layer consistency checks and migration checklist patterns.
---

# Deep Dive Patterns

These are Tier 3 sections rendered only on explicit request after the core 5 sections.

## [7] Cross-Layer Consistency

Verify frontend/backend alignment by mapping endpoints to consumers:

```
CROSS-LAYER CONSISTENCY
Backend Endpoint          Frontend Consumer     Status
POST /invoices            createInvoice()       PLANNED
GET  /invoices/:id        useInvoice(id)        PLANNED
GET  /invoices            InvoiceList.tsx        MISSING  !!
```

### Rules
- List every backend endpoint the plan introduces or modifies
- Map each to its frontend consumer (component, hook, or API call)
- Flag `MISSING !!` for any unmatched endpoint — these are gaps in the plan
- Flag `ORPHANED !!` for frontend consumers calling endpoints not in the plan
- Include status: EXISTING, PLANNED, MISSING, ORPHANED

## [8] Migration Checklist

Generate an ordered runbook with explicit dependency constraints and time estimates:

```
MIGRATION CHECKLIST

Sequential Block A (database):
  1. [ ] Backup production database                    [~5 min]
  2. [ ] Run migration: 001_add_invoices.sql           [~30s]   <- blocks #4

Parallel Block B (after #2):
  3. [ ] Deploy API v2.1.0                             [~3 min]
  4. [ ] Update frontend bundle                        [~2 min]

Sequential Block C (verification):
  5. [ ] Smoke test                                    [~2 min]
  6. [ ] Monitor error rate 15 min                     [~15 min]
```

### Rules
- Group steps into sequential and parallel blocks
- Show `<- blocks #N` for dependency constraints
- Include time estimates for each step
- Always start with a backup step for data-touching migrations
- Always end with verification (smoke test + monitoring)
- Use checkbox format `[ ]` for runbook usability
