---
title: "Worked run 3 — --quick"
description: The 15-second answer. No agents, no tasks, no questions, no memory write.
---

# Worked run 3 — `--quick`

`--quick` exists because the full path costs an Explore agent, a six-task dependency graph, and a
question. Sometimes the honest answer to "what does this branch touch?" is a header and two
sections, and paying for the rest is why fast questions leaked to `/ork:glyph` and to
hand-written HTML instead.

## Input

```
$ /ork:visualize-plan --quick
```

## What is skipped

| Step | Full run | `--quick` |
|---|---|---|
| TaskCreate block | 6 tasks + dependency graph | skipped entirely |
| STEP -1 memory search | yes | skipped |
| STEP 1 Explore agent | base-vs-head component map | skipped |
| Sections | all six | `[1]` Changes + `[5]` Impact |
| STEP 5 question | one | none |
| Memory write | yes | skipped |

Everything that survives is fed by `scripts/analyze-impact.sh` alone. No sub-agent runs, so there
is no worktree, no model spend beyond this turn, and nothing to wait on.

## Output

```
PLAN: Working branch (feat/billing-redesign)  |  7 files  |  +1240 -486 lines
Risk: MEDIUM (1 migration, 1 delete)  |  Branch: feat/billing-redesign -> main
```

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

```
IMPACT
  Added     4 files   +1000
  Modified  2 files   +240 -272
  Deleted   1 file        -214
  NET                    +754
  Tests     2 files touched   |   API surface  1 additive field   |   Deps  none
```

Then it stops. No "what next?".

## What `--quick` must NOT do

- **Do not fabricate the fields it skipped.** Risk here is derived from the file list (a migration
  and a delete are visible without an agent). Confidence and reversibility are *not* shown, because
  computing them honestly needs the analysis `--quick` declined to run. A blank field beats a
  guessed one.
- **Do not write to memory.** A quick look is not a decision worth persisting; storing it pollutes
  the cross-session comparison the full run depends on.
- **Do not silently upgrade.** If the branch turns out to need real analysis, say so in one line
  ("7 files including a schema migration — worth a full run?") and let the user ask.

## When to use the full run instead

Anything where the *judgment* is the deliverable: reviewing a plan before committing to it,
comparing approaches, assessing blast radius, or producing an artifact someone else will read.
`--quick` answers "what changed"; the full run answers "should we do this, and in what order".
