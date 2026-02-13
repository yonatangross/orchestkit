---
title: Git Workflow Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Branch Protection (protection) — CRITICAL — 1 rule

Protected branch rules that prevent direct commits to main/dev. Violations can break deployments and lose team work.

- `branch-protection.md` — Protected branches, required workflows, emergency procedures

## 2. Merge Strategy (merge) — HIGH — 1 rule

When to rebase vs merge, how to handle conflicts, and keeping history clean.

- `merge-strategy.md` — Rebase-first workflow, merge commit rules, conflict resolution

## 3. History Hygiene (hygiene) — HIGH — 1 rule

Maintaining a clean, useful git history for debugging (bisect) and code review.

- `history-hygiene.md` — Squashing, fixup commits, interactive rebase, history cleanup

## 4. Recovery (recovery) — CRITICAL — 3 rules

Git recovery patterns using reflog, reset modes, and stash management.

- `recovery-reflog.md` — Reflog-based recovery of lost commits, deleted branches, undone rebases
- `recovery-reset.md` — Safe (--soft/--mixed) vs dangerous (--hard) reset, pushed vs unpushed
- `recovery-stash.md` — Named stashes, context switching, recovering dropped stashes via fsck

## 5. Stacked PRs (stacked) -- HIGH -- 2 rules

Break large features into small, reviewable, dependent PRs that merge in sequence.

- `stacked-pr-workflow.md` -- Stack planning, PR creation, dependency tracking, numbering
- `stacked-pr-rebase.md` -- Rebase management, force-with-lease, retargeting after merge

## 6. Monorepo (monorepo) -- MEDIUM -- 1 rule

Multi-directory context patterns for monorepo workflows.

- `monorepo-context.md` -- --add-dir, per-service CLAUDE.md, workspace detection
