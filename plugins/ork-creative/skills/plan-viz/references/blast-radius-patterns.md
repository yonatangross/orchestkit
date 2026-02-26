# Blast Radius Patterns

Visualize the transitive impact of planned changes.

## Concentric Rings

The changed file at center, expanding rings for each degree of dependency:

```
                         Ring 3: Tests (8 files)
                    +-------------------------------+
                    |      Ring 2: Transitive (5)    |
                    |   +------------------------+   |
                    |   |   Ring 1: Direct (3)    |   |
                    |   |   +--------------+      |   |
                    |   |   | CHANGED FILE |      |   |
                    |   |   +--------------+      |   |
                    |   +------------------------+   |
                    +-------------------------------+

Ring 1 (direct):     auth.py, routes.py, middleware.py
Ring 2 (transitive): app.py, config.py, utils.py, cli.py, server.py
Ring 3 (tests):      test_auth.py, test_routes.py, ... (+6 more)
```

## Multi-File Blast Radius

When multiple files change, show overlapping impact:

```
BLAST RADIUS: 3 changed files

memory-writer.ts ─── Ring 1: 5 files ─── Ring 2: 12 files ─── Ring 3: 8 tests
                          |                    |
memory-health.ts ─── Ring 1: 3 files ────+    |
                          |               |    |
queue-processor.ts ── Ring 1: 2 files ──+─+───+

Overlap: 4 files appear in multiple blast radii
Unique impact: 18 files total (not 25 — overlap deduplicated)
```

## Fan-In / Fan-Out Analysis

```
Fan-In (what depends on changed files)    Fan-Out (what changed files depend on)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
memory-writer.ts  [========] 8            graph-client     [======] 6
memory-health.ts  [====] 4                cc-native-writer [====] 4
queue-processor.ts [==] 2                 logger           [==] 2
decision-history.ts [===] 3              config            [=] 1

High fan-in = higher risk (more things break if this file breaks)
High fan-out = higher complexity (more things to understand)
```

## Dependency Tree (Detailed)

```
BLAST RADIUS: memory-writer.ts

memory-writer.ts (CHANGED)
├── stop/auto-remember-continuity.ts     (direct dependent)
│   ├── stop/unified-dispatcher.ts       (transitive)
│   │   └── hooks.json                   (config entry)
│   └── stop/session-patterns.ts         (transitive)
├── stop/session-profile-aggregator.ts   (direct dependent)
├── subagent-stop/agent-memory-store.ts  (direct dependent)
├── skill/decision-processor.ts          (direct dependent)
│   └── skill/unified-dispatcher.ts      (transitive)
└── lifecycle/pre-compact-saver.ts       (direct dependent)

Direct: 5 files  |  Transitive: 3 files  |  Total: 8 files
```

## Impact by Layer

For full-stack changes, show blast radius per layer:

```
BLAST RADIUS BY LAYER

API Layer:
  Changed: routes.py, schemas.py
  Impact:  middleware.py, auth.py (2 dependents)
  Tests:   test_routes.py, test_auth.py (2 test files)

Service Layer:
  Changed: billing.py (new)
  Impact:  None (new file, no dependents yet)
  Tests:   test_billing.py (new, paired)

Model Layer:
  Changed: invoice.py (new)
  Impact:  billing.py depends on it (1 dependent)
  Tests:   test_models.py needs update (1 test file)

Frontend:
  Changed: InvoiceList.tsx, InvoiceDetail.tsx (new)
  Impact:  App.tsx (routing), Sidebar.tsx (navigation)
  Tests:   InvoiceList.test.tsx (new, paired)

Cross-Layer Dependencies:
  Frontend -> API: 2 new fetch calls (POST /invoices, GET /invoices)
  API -> Model: 1 new import (InvoiceModel)
```

## Compact Blast Radius (small changes)

```
BLAST RADIUS: routes.py -> 3 direct, 5 transitive, 4 tests = 12 files
```
