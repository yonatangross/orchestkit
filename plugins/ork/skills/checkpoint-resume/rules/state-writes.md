---
title: State Write Discipline
impact: CRITICAL
impactDescription: "Batching state writes means losing all intermediate progress on interruption"
tags: [checkpoint, state, resilience]
---

# State Write Discipline

## Rule

Write `.claude/pipeline-state.json` **immediately after each phase completes**, before starting the next phase.

## Never Batch

Do NOT accumulate completed phases and write once at the end. If interrupted between writes, all unwritten progress is lost.

## What to Write After Each Phase

```json
{
  "completed_phases": [
    { "id": "phase-1", "name": "...", "timestamp": "...", "commit_sha": "..." }
  ],
  "current_phase": { "id": "phase-2", "name": "...", "progress_description": "Starting" },
  "remaining_phases": [{ "id": "phase-3", "name": "..." }],
  "context_summary": { "branch": "...", "key_decisions": [], "file_paths": [] },
  "updated_at": "<ISO 8601 timestamp>"
}
```

## Write Order

1. Complete phase work
2. Write state file
3. Start next phase

If step 3 is interrupted, re-invoking the skill reads the state file and resumes from `current_phase`.
