# Execution Swimlane Patterns

Temporal dependency diagrams showing parallel/sequential execution.

## Symbol Convention

```
===  Active work (this lane is executing)
---  Blocked / waiting for a dependency
|    Dependency line (vertical)
+    Junction (dependency meets lane)
>    Flow direction (lane endpoint)
[N]  Phase reference number
```

## Basic Swimlane (2 lanes)

```
Backend  ===[1: Schema]==[2: API]========================[4: Deploy]===>
                |            |                                ^
                |            +--------blocks---------+        |
                |                                    |        |
Frontend ------[Wait]--------[3: Components]=========[5: Integrate]+

=== Active   --- Waiting   | Dependency
Critical path: 1 -> 2 -> 4 (backend-bound)
```

## Multi-Lane Swimlane (3+ lanes)

```
Database ===[1: Migrate]=====================================>
                  |
                  +---blocks---+---blocks---+
                  |            |            |
Backend  --------[Wait]------[2: API]=====[4: Deploy]=======>
                               |               ^
                               +--blocks--+    |
                               |          |    |
Frontend --------[Wait]------[Wait]-----[3: UI]==[5: Int.]==>
                                                      |
Tests    --------[Wait]------[Wait]-----[Wait]---[6: E2E]===>

=== Active   --- Waiting   | Dependency
Critical path: 1 -> 2 -> 3 -> 5 (longest chain)
Parallel opportunity: Backend deploy (4) can run alongside Frontend UI (3)
```

## Phase Detail Blocks

Expand key phases with sub-steps:

```
Phase 2: API Endpoints [estimated: 2-3 hours]
+--------------------------------------------------+
| 2a. Define Pydantic schemas (InvoiceCreate, etc.) |
| 2b. Implement CRUD routes                         |
| 2c. Add auth middleware to new routes              |
| 2d. Write route tests                             |
+--------------------------------------------------+
  Blocks: Phase 3 (UI needs API contract)
  Blocked by: Phase 1 (needs DB tables)
```

## With Time Estimates

```
Timeline (estimated):
0h        1h        2h        3h        4h        5h        6h
|---------|---------|---------|---------|---------|---------|
Database  [##1##]
Backend            [####2####]          [##4##]
Frontend                      [####3####][##5##]
Tests                                          [##6##]
          ▲                                           ▲
          Start                                       Done

Estimated total: 6 hours (3.5h critical path + 2.5h parallel)
Without parallelism: 9.5 hours
Time saved by parallel execution: ~37%
```

## Dependency Graph (DAG style)

For complex dependency chains, use a directed acyclic graph:

```
EXECUTION ORDER (DAG)

    [1: Schema]
        |
    +---+---+
    |       |
[2: API] [3: Indexes]
    |       |
    +---+---+
        |
    [4: Deploy API]
        |
    +---+---+
    |       |
[5: UI]  [6: Cache]
    |       |
    +---+---+
        |
    [7: Integration]
        |
    [8: E2E Tests]

Parallelizable pairs: (2,3), (5,6)
Serial bottleneck: 4 (both UI and cache depend on API deploy)
```

## Conditional Execution

When phases have success/failure branches:

```
[1: Migrate] --success--> [2: API] --success--> [3: Deploy]
      |                      |
      +--failure-->          +--failure-->
      |                      |
[1R: Rollback DB]      [2R: Revert API]
      |                      |
      +-----> [ABORT] <------+
```
