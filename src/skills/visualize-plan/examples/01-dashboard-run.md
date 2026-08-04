---
title: "Worked run 1 — default dashboard"
description: Full trace of `/ork:visualize-plan` on a real branch, from invocation to emitted HTML.
---

# Worked run 1 — the default path

The scenario is the same one committed as sample state in
`playground-exemplars/plan-dashboard.template.html`, so the example and the template reinforce each
other. Read this before authoring your first plan visualization.

## Input

```
$ git branch --show-current
feat/billing-redesign

$ /ork:visualize-plan
```

No flags. So: source auto-detected, all six sections, ASCII only, one question at the end.
**Zero questions before the first render.**

## STEP 0 — detect (no question, detection was unambiguous)

```
$ bash scripts/detect-plan-context.sh
branch:  feat/billing-redesign -> main
issue:   #234        (from branch-linked PR body "Closes #234")
commits: 6 ahead
files:   7 changed
```

## STEP 1 — gather

```
$ bash scripts/analyze-impact.sh
added:     4 files   +1000
modified:  2 files   +240 -272
deleted:   1 file        -214
tests:     2 files touched
```

Explore agent maps components at `git show origin/main:<path>` (base) vs the working tree (head).
Both maps feed section [0] **and** the plan brief that any richer format will consume.

## STEP 2 — tier 1 header (always)

```
PLAN: Billing module redesign (#234)  |  4 phases  |  7 files  |  +1240 -486 lines
Risk: MEDIUM  |  Confidence: HIGH  |  Reversible until P3 (schema migration)
Branch: feat/billing-redesign -> main

[0] Before/After  [1] Changes  [2] Execution  [3] Risks  [4] Decisions  [5] Impact  [all]
```

## STEP 4 — sections (all six, no picker)

### [0] Before/After

<!-- ascii-lint-disable: balanced-corners -->
```
BASE (origin/main)                      HEAD (working tree)

api/routes/billing.ts                   api/routes/billing.ts
  └ stripe.charge() inline         ->     └ delegates to BillingService    [~]
                                        services/BillingService.ts         [+]
                                          └ providers/StripeProvider.ts    [+]
lib/legacy-invoice.ts            [-]
db/schema/invoices                      db/schema/invoices (+ provider_ref) [~]
```

### [1] Change Manifest

<!-- ascii-lint-disable: balanced-corners -->
```
services/
├── BillingService.ts              [A] +412       ** new file
└── providers/StripeProvider.ts    [A] +286       ** new file
api/
└── routes/billing.ts              [M] +174 -231  !! 3 handlers rewritten
db/
└── migrations/0042_provider_ref.sql [A] +38      !! hot table
tests/
├── billing/service.test.ts        [A] +264       ** new file
└── billing/routes.test.ts         [M] +66 -41
lib/
└── legacy-invoice.ts              [D] -214       ~~ replaced by BillingService

Legend: [A]dd [M]odify [D]elete  !! Risk  ** New
Summary: +1240 -486  |  4 new  |  2 modified  |  1 deleted
```

### [2] Execution Swimlane

```
Service  ===[P1: Extract]===[P2: Provider]===============================>
                                  |
                                  +---blocks---+
                                              |
Schema   -------[Wait]------------[Wait]----[P3: Migrate]====+
                                                             |
                                                  +--blocks--+
                                                  |
Cleanup  -------[Wait]------------[Wait]--------[Wait]-----[P4: Delete]==>

=== Active   --- Waiting   | Dependency
Critical path: P1 -> P2 -> P3 -> P4 (fully sequential — no parallel opportunity)
```

### [3] Risk Dashboard

```
REVERSIBILITY TIMELINE

P1  [================]  FULLY REVERSIBLE   (pure refactor, tests green)
P2  [================]  FULLY REVERSIBLE   (provider seam, additive)
P3  [============....]  PARTIALLY          (nullable column, can drop)
         --- POINT OF NO RETURN ---
P4  [....????????????]  IRREVERSIBLE       (legacy reader deleted)

PRE-MORTEM (3 scenarios)
  R1 CRITICAL  Double-charge during cutover
     How: P2 ships while an in-flight retry queue still points at the inline
          charge path; the same invoice is charged twice.
     Containment: idempotency key derived from invoice id, asserted before P2 merges.
  R2 SERIOUS   Migration locks the invoices table
     How: 0042 adds NOT NULL with a default; Postgres rewrites 4.2M rows.
     Containment: land nullable, backfill in batches, NOT NULL in a later migration.
  R3 WARNING   Legacy reader still live at P4
     How: an ungrepped cron job imports legacy-invoice and throws after the delete.
     Containment: 7-day telemetry gate on legacy read count == 0.
```

### [4] Decision Log · [5] Impact

ADR-lite per decision (Context / Decision / Alternatives / Tradeoff), then the impact table.
Both are rendered in full in the HTML; see the `plan-state` island in the template.

## STEP 5 — the one question

```
What next?
  › Interactive dashboard (Recommended)   docs/feat--billing-redesign/plan-viz.html
    Drill deeper                          blast radius / cross-layer / migration checklist
    Generate GitHub issues                one per execution phase
    Done
```

Picking the dashboard copies `plan-dashboard.template.html` and replaces **only** the
`plan-state` island with the data already gathered — no recomputation, no hand-written CSS.

## What "good" looked like here

- Every number came from `analyze-impact.sh`, not estimated.
- [0] compared `git show origin/main:<path>` against the working tree, not two guesses.
- Each risk carries a *mechanism* ("how"), not a category. "Migration is risky" is not a risk.
- The point of no return is stated once, loudly, and matches the reversibility field in the header.
- The HTML reused the template; the only authored content was JSON.
