# Change Manifest Patterns

Terraform-style annotated file trees for visualizing planned changes.

## Symbol Convention

Borrowed from Terraform plan output for universal recognition:

```
[A]  Add       — New file being created
[M]  Modify    — Existing file being changed
[D]  Delete    — File being removed
[R]  Rename    — File being moved/renamed
[S]  Simplify  — File being reduced (lines removed, logic simplified)
```

## Annotation Convention

```
!!   Risk flag     — High-traffic path, complex logic, or fragile code
**   New file      — Freshly created, no existing behavior to break
~~   Deprecated    — Being replaced by another file
->   Moves to      — Content relocating to a different path
```

## Basic Change Tree

```
src/
├── api/
│   ├── routes.py          [M] +45 -12
│   └── schemas.py         [M] +20 -5
├── services/
│   └── billing.py         [A] +180       ** new file
├── models/
│   └── invoice.py         [A] +95        ** new file
└── tests/
    └── test_billing.py    [A] +120       ** new file

Legend: [A]dd [M]odify [D]elete  !! Risk  ** New
Summary: +460 -17  |  3 new  |  2 modified  |  0 deleted
```

## Annotated Change Tree (with risk flags)

```
src/
├── hooks/
│   ├── lifecycle/
│   │   ├── mem0-context-retrieval.ts   [D] -245    ~~ replaced by graph
│   │   ├── mem0-analytics-tracker.ts   [D] -180    ~~ no replacement needed
│   │   └── pre-compact-saver.ts        [S] -40     remove mem0 fallback
│   ├── stop/
│   │   ├── mem0-queue-sync.ts          [D] -320    ~~ queue system removed
│   │   └── auto-remember-continuity.ts [S] -25     !! touches session persistence
│   ├── lib/
│   │   ├── memory-writer.ts            [S] -350    !! core write path
│   │   ├── queue-processor.ts          [D] -280    ~~ queue system removed
│   │   └── memory-health.ts            [S] -60     remove mem0 health checks
│   └── setup/
│       ├── mem0-backup-setup.ts        [D] -150
│       ├── mem0-cleanup.ts             [D] -120
│       └── mem0-analytics-dashboard.ts [D] -200
├── skills/
│   ├── mem0-memory/                    [D] -4500   ~~ entire skill removed
│   ├── memory-fabric/SKILL.md          [S] -80     remove mem0 paths
│   └── remember/SKILL.md              [S] -45     remove --mem0 flag
└── tests/
    └── mem0/                           [D] -3200   ~~ 20 test files removed

Legend: [A]dd [M]odify [D]elete [S]implify  !! Risk  ** New  ~~ Deprecated
Summary: +0 -9,795  |  0 new  |  4 simplified  |  30 deleted
```

## Grouped by Action

For large changesets, group by action type:

```
DELETIONS (30 files, -9,195 lines):
  src/skills/mem0-memory/         [D] 42 files  -4,500 lines
  tests/mem0/                     [D] 20 files  -3,200 lines
  src/hooks/src/lifecycle/mem0-*  [D]  2 files    -425 lines
  src/hooks/src/stop/mem0-*       [D]  2 files    -520 lines
  src/hooks/src/setup/mem0-*      [D]  3 files    -470 lines
  bin/mem0-*.py                   [D]  2 files     -80 lines

SIMPLIFICATIONS (4 files, -600 lines):
  src/hooks/src/lib/memory-writer.ts    [S] -350 lines  !! core write path
  src/skills/memory-fabric/SKILL.md     [S]  -80 lines
  src/skills/remember/SKILL.md          [S]  -45 lines
  src/hooks/src/lib/memory-health.ts    [S]  -60 lines
  src/hooks/src/stop/auto-remember.ts   [S]  -25 lines  !! session persistence

NO CHANGES (185 files):
  All other skills, agents, hooks unchanged
```

## Compact Format (for small changes)

```
CHANGES: 3 files (+85 -12)
  [M] src/api/routes.py      +45 -12  !! hot path
  [A] src/api/schemas.py     +20
  [A] tests/test_routes.py   +20
```
