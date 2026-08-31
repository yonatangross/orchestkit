---
title: "Index budget: rule-based demotion into MEMORY-ARCHIVE.md"
tags: [dream, memory, budget, archive]
---

# Index budget (STEP 5.5)

`scripts/index-budget.mjs <memory_dir> [--ceiling N] [--handoff-days 7] [--entry-days 30] [--apply] [--json]`

## Why a script

MEMORY.md is loaded every session, so its size is a permanent per-session cost. The rebuild
step keeps the index consistent with the files; nothing kept it within budget. A PreToolUse
guard asks before an over-budget write, but it was silent in bypass mode, the population that
writes MEMORY.md most (#3741: six projects at or over 17,408 B; this repo 22,234 B). A
deterministic pass makes the budget a reviewable number and the demotions a rule that binds
every author equally, which is defensible where demoting another session's entry on judgement
is not.

## The report

Bytes vs ceiling (`--ceiling`, else `ORK_CONTEXT_FILE_BUDGET_BYTES`, else 17,408 B, the same
figure the guard reads; the often-quoted "~24 KB hard read limit" failed to reproduce twice and
is not used), entries and bytes per section, entries over 400 chars, overhead bytes, and the
two-file invariant: `indexed(MEMORY.md) + indexed(MEMORY-ARCHIVE.md) == files_on_disk`, disjoint,
every link target present with exact-case name, exactly one trailer line.

## The demotion rule

| class | rule |
|---|---|
| `## Handoffs` | older than `--handoff-days` (date from `project_handoff_YYYY_MM_DD`, else file mtime) |
| `## Feedback`, `## Project` | file mtime older than `--entry-days` |
| never | `hub_*`, anything under `## Policy`, `user_*`, anything modified within 7 days |

Oldest first within each class, handoffs first, until the projected size (including the
rewritten trailer) fits the ceiling. If the candidates are exhausted and the index is still over,
fall through to hook trimming in the rebuild step, then warn. Nothing is ever deleted.

## Apply

`--apply` copies `MEMORY.md` to `.MEMORY.md.prev` first, removes the proposed lines from
`MEMORY.md`, appends them to `MEMORY-ARCHIVE.md` under `## Moved from MEMORY.md <date> (N)`
(creating the archive with a short header if absent), rewrites the single trailer to link
`MEMORY-ARCHIVE.md` by exact name, re-verifies the invariant from disk, and exits 1 if it fails.
The archive is not budgeted: it is read on demand, never auto-loaded.
