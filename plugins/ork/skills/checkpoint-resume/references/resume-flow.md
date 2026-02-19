---
title: Resume Flow
tags: [checkpoint, resume, flow]
---

# Resume Flow

## Detection

On invocation, the first action is always:

```
Check: does .claude/pipeline-state.json exist?
```

## If State File Exists — Resume Path

1. Read `.claude/pipeline-state.json`
2. Display summary:
   ```
   Completed phases: N (phase-1: ..., phase-2: ...)
   Current phase:    phase-3 "Implement feature" — Writing tests
   Remaining:        phase-4, phase-5
   Last updated:     2026-02-19T10:00:00Z
   ```
3. Ask: "Resume from phase-3? (y/n)"
4. On **yes**: resume `current_phase` from `progress_description` context
5. On **no**: offer options:
   - Restart from the beginning (deletes state file)
   - Abandon pipeline (deletes state file, no work done)
   - Jump to a specific phase (advanced)

## If No State File — Fresh Start Path

1. Ask: "Describe the multi-phase task"
2. Analyze and build phase list with dependencies
3. Write initial state file with `current_phase` = first phase, `status: pending`
4. Begin phase 1

## Rate Limit Recovery

If a rate limit interrupts mid-phase:
1. The state file reflects the last completed phase
2. The current phase may be partially done — re-invoke the skill
3. Read `progress_description` to understand how far into the current phase to resume
4. Continue from that point, do not restart the entire phase unless necessary
