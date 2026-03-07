---
title: Handoff After Phase
impact: HIGH
impactDescription: Prevents loss of work when sessions compact or rate-limit
tags: [handoff, persistence, resilience]
---

# Handoff After Phase

Write a handoff JSON file after every major phase completes.

## Incorrect

```python
# BAD: All phase results only in memory — lost on compaction
phase_4_results = run_rca_agents()
# ... continue to Phase 5 using in-memory results
# If rate-limited here: all RCA work is gone
```

## Correct

```python
# GOOD: Persist results to disk after each phase
phase_4_results = run_rca_agents()

Write(".claude/chain/04-rca.json", JSON.stringify({
  "phase": "rca",
  "phase_number": 4,
  "skill": "fix-issue",
  "timestamp": now(),
  "status": "completed",
  "outputs": phase_4_results,
  "next_phase": 5
}))

# If rate-limited: next session reads 04-rca.json and continues
```

## Which Phases Need Handoffs

- After any phase that takes > 30 seconds
- After any phase that spawns parallel agents
- Before any AskUserQuestion gate
- After the final phase (completion record)
