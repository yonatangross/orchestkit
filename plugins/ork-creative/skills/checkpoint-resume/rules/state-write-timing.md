---
title: Write state after each phase so rate-limit interruptions preserve all prior progress
impact: CRITICAL
impactDescription: "Batching state writes means a rate-limit hit between phases loses all progress since the last write — the session cannot be resumed"
tags: state, checkpoint, pipeline-state, timing
---

## State Write Timing

Write `.claude/pipeline-state.json` immediately after every phase completes. Never accumulate updates.

**Incorrect — batching state writes to the end:**
```javascript
// Run all phases, then save state once
for (const phase of phases) {
  await runPhase(phase);
}
await writeState({ completed_phases: phases }); // Lost if interrupted!
```

**Correct — write state after every phase:**
```javascript
for (const phase of phases) {
  await runPhase(phase);
  // Write immediately — before starting next phase
  await writeState({
    completed_phases: [...prev.completed_phases, { ...phase, timestamp: new Date().toISOString() }],
    current_phase: nextPhase,
    remaining_phases: phasesAfterNext,
    updated_at: new Date().toISOString()
  });
}
```

**State write checklist (after each phase):**
- [ ] Move completed phase into `completed_phases` with `timestamp`
- [ ] Add `commit_sha` if the phase produced a git commit
- [ ] Set `current_phase` to the next pending phase
- [ ] Remove completed phase from `remaining_phases`
- [ ] Update `updated_at`
- [ ] Update `context_summary.file_paths` with any new files created

**Key rules:**
- Write state BEFORE starting the next phase, not after
- Never batch multiple phase completions into one write
- If a phase produces a commit, capture the SHA: `git rev-parse --short HEAD`
- The state file is the source of truth for resume — it must be current
