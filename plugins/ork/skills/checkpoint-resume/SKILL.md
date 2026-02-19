---
name: checkpoint-resume
description: Rate-limit-resilient pipeline with checkpoint/resume for long multi-phase sessions. Use when starting a complex multi-phase task that risks hitting rate limits, when resuming an interrupted session, or when orchestrating work that spans commits, issues, and file changes across many steps.
tags: [resilience, checkpoint, pipeline, orchestkit]
version: 2.0.0
author: OrchestKit
user-invocable: true
complexity: high
---

# Checkpoint Resume

Rate-limit-resilient pipeline orchestrator. Saves progress to `.claude/pipeline-state.json` after each phase so long sessions survive interruptions.

## Rules

| Rule | File | Key Constraint |
|------|------|----------------|
| Phase ordering | `rules/phase-ordering.md` | GitHub issues and commits first; file-heavy work last |
| State writes | `rules/state-writes.md` | Write state immediately after each phase, not at end |
| Parallelism | `rules/parallelism.md` | Only parallelize phases with empty `dependencies` arrays |
| Mini-commits | `rules/mini-commits.md` | Commit every 3 phases as recovery checkpoint |

## References

- [Pipeline state schema](references/pipeline-state-schema.md)
- [Resume flow](references/resume-flow.md)

## On Invocation

### If `.claude/pipeline-state.json` exists

1. Read and display resume summary (completed phases, current phase, remaining)
2. Ask: **"Resume from [current_phase.name]? (y/n)"**
3. On yes: continue from `current_phase`; on no: offer restart or abandon

### If no state file exists

1. Ask user to describe the multi-phase task
2. Build execution plan and write initial `.claude/pipeline-state.json`
3. Begin execution from first phase

## After Each Phase

1. Update `.claude/pipeline-state.json` — move phase to `completed_phases`, advance `current_phase`
2. Every 3 completed phases: `checkpoint: phases N-M complete` mini-commit
