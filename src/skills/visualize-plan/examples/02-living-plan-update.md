---
title: "Worked run 2 — living plan, update mode"
description: Second session on a multi-wave plan. Slug-keyed detection, merge, evidence gate, and the fork case.
---

# Worked run 2 — updating a living plan

A plan that executes over multiple sessions is a **living plan**: one plan = ONE file, updated in
place. This run is the *second* session on that plan. The whole point is that it must not create a
second file.

## Input

```
$ git branch --show-current
chore/dep-currency-sweep          # NOTE: renamed since session 1, which was on research/dep-currency

$ /ork:visualize-plan
```

The branch rename is the interesting part. Path-keyed detection would look for
`docs/chore--dep-currency-sweep/plan-viz.html`, find nothing, and author a **second** plan. That is
exactly how slug `langchain-ecosystem-currency` ended up committed twice.

## STEP 4b — detect by SLUG, before authoring anything

```
$ bash scripts/find-living-plan.sh "dep-currency-sweep"
docs/research--dep-currency/plan-viz.html
$ echo $?
0
```

Exit 0, one hit → **UPDATE that file, wherever it lives.** Not the branch-derived path.

| Exit | Meaning | Action |
|---|---|---|
| 0 | one match | Merge into the printed path |
| 1 | no match | Author `docs/<branch-dir>/plan-viz.html` |
| 2 | **already forked** | STOP. Name both paths, ask which survives, `git mv` + delete in one commit |

## The merge (never an overwrite)

Read the existing `lpp-state`, mutate the JSON, leave the renderer alone.

```diff
   { "id": "i3", "wave": "w2", "title": "Bump langchain to 0.4.x",
-    "status": "in_progress",
+    "status": "done",
     "evidence": "pnpm -r why langchain shows 0.4.x only" },

   { "id": "i4", "wave": "w2", "title": "Drop the pydantic v1 shim",
-    "status": "planned",
+    "status": "in_progress",
     "evidence": "grep -r 'pydantic.v1' src/ returns nothing" },

   "changelog": [
+    { "at": "2026-08-04", "note": "i3 done (verified via pnpm why). i4 started." },
     { "at": "2026-07-25", "note": "v1 authored." }
   ]
```

Then `git mv docs/research--dep-currency docs/chore--dep-currency-sweep` so the path catches up
with the branch. **The slug never changes.** The slug is identity; the path is an address.

## The evidence gate is not a formality

`i3` moved to `done` only because the check was actually run **this session**:

```
$ pnpm -r why langchain
langchain 0.4.2   (1 dependent)
```

Compare with the item that did *not* move:

```
   { "id": "i5", "wave": "w2", "title": "Regenerate the lockfile",
     "status": "in_progress",          # NOT done — evidence never run
     "evidence": "pnpm install --frozen-lockfile exits 0" },
```

Say so out loud: *"i5 looks finished but I did not run `pnpm install --frozen-lockfile`, so it
stays in_progress."* Marking done without evidence is a contract violation, not a rounding error.

## The fork case (exit 2)

```
$ bash scripts/find-living-plan.sh "langchain-ecosystem-currency"
docs/chore--langchain-ecosystem-currency/plan-viz.html
docs/research--langchain-ecosystem-currency-2026-07-25/plan-viz.html
FORKED: 2 files share slug 'langchain-ecosystem-currency' — reconcile before writing.
$ echo $?
2
```

Do **not** write a third file, and do not silently pick one. Report both paths with their `updated`
dates and item counts, ask which survives, then reconcile in a single commit. Gated by
`tests/orphans/test-duplicate-living-plans.sh`, which fails on committed forks.

## What "good" looked like here

- Detection ran **before** authoring, and keyed on the slug, not the branch-derived path.
- The merge was a JSON mutation; no rendered progress was hand-edited.
- `changelog` was appended to, never rewritten; nothing was deleted (removed work → `dropped`).
- One item was explicitly left `in_progress` with the reason stated, rather than rounded up to done.
- The directory was `git mv`'d to follow the branch, keeping one file for one slug.
