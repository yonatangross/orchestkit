---
name: checkpoint-resume
description: Rate-limit-resilient pipeline with checkpoint/resume for long multi-phase sessions. Saves progress to .claude/pipeline-state.json after each phase. Use when starting a complex multi-phase task that risks hitting rate limits, when resuming an interrupted session, or when orchestrating work spanning commits, GitHub issues, and large file changes.
tags: [resilience, checkpoint, pipeline, orchestkit]
version: 2.0.0
author: OrchestKit
user-invocable: true
complexity: high
---

# Checkpoint Resume

Rate-limit-resilient pipeline orchestrator. Saves progress to `.claude/pipeline-state.json` after every phase so long sessions survive interruptions.

## Quick Reference

| Category | Rule | Impact | Key Pattern |
|----------|------|--------|-------------|
| Phase Ordering | `rules/ordering-priority.md` | CRITICAL | GitHub issues/commits first, file-heavy phases last |
| State Writes | `rules/state-write-timing.md` | CRITICAL | Write after every phase, never batch |
| Mini-Commits | `rules/checkpoint-mini-commit.md` | HIGH | Every 3 phases, checkpoint commit format |

**Total: 3 rules across 3 categories**

## On Invocation

**If `.claude/pipeline-state.json` exists:** run `scripts/show-status.sh` to display progress, then ask to resume, pick a different phase, or restart. See `references/resume-decision-tree.md` for the full decision tree.

**If no state file exists:** ask the user to describe the task, build an execution plan, write initial state via `scripts/init-pipeline.sh <branch>`, begin Phase 1.

## Execution Plan Structure

```json
{
  "phases": [
    { "id": "create-issues", "name": "Create GitHub Issues", "dependencies": [], "status": "pending" },
    { "id": "commit-scaffold", "name": "Commit Scaffold", "dependencies": [], "status": "pending" },
    { "id": "write-source", "name": "Write Source Files", "dependencies": ["commit-scaffold"], "status": "pending" }
  ]
}
```

Phases with empty `dependencies` may run in parallel via Task sub-agents (when they don't share file writes).

## After Each Phase

1. Update `.claude/pipeline-state.json` — see `rules/state-write-timing.md`
2. Every 3 phases: create a mini-commit — see `rules/checkpoint-mini-commit.md`

## References

- [Pipeline State Schema](references/pipeline-state-schema.md) — full field-by-field schema with examples
- [Pipeline State JSON Schema](references/pipeline-state.schema.json) — machine-readable JSON Schema for validation
- [Resume Decision Tree](references/resume-decision-tree.md) — logic for resuming, picking phases, or restarting

## Scripts

- `scripts/init-pipeline.sh <branch>` — print skeleton state JSON to stdout
- `scripts/show-status.sh [path]` — print human-readable pipeline status (requires `jq`)

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Phase granularity | One meaningful deliverable per phase (a commit, a set of issues, a feature) |
| Parallelism | Task sub-agents only for phases with empty `dependencies` that don't share file writes |
| Rate limit recovery | State is already saved — re-invoke `/checkpoint-resume` to continue |
