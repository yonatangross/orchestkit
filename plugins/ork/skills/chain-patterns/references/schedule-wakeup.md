---
title: ScheduleWakeup — Dynamic Loop Pacing
description: Cache-aware self-pacing for in-session polling, replacing fixed /loop intervals
---

# ScheduleWakeup — Dynamic Loop Pacing

## When to Use

```
                    ┌─ Need it after session ends?
                    │
              YES ──┤──→ CronCreate (persistent)
                    │    Weekly drift, daily regression, health checks
              NO ───┤
                    │──→ ScheduleWakeup (session-scoped)
                         CI polling, build watching, deploy verification
```

## Cache-Aware Delay Selection

The prompt cache has a **5-minute TTL**. Sleeping past 300s means the next wake-up reads full context uncached — slower and more expensive.

| Delay | Cache | Use When |
|-------|-------|----------|
| 60–270s | Warm | Active work — build running, CI check pending, process just started |
| **Never 300s** | **Worst of both** | Cache miss without amortizing the wait |
| 300–3600s | Cold | Genuinely idle — nothing to check for minutes |
| 1200–1800s | Cold (amortized) | Idle ticks with no specific signal to watch |

## Patterns

### CI Status Polling (after PR creation)

```python
ScheduleWakeup(
  delaySeconds: 270,           # CI takes ~4min, stay in cache
  prompt: "Check PR #123 CI status: gh pr checks 123. If all pass → done. If still pending → schedule again.",
  reason: "CI pipeline running, checking in 4.5min"
)
```

### Post-Deploy Health Check

```python
# First check: soon after deploy
ScheduleWakeup(
  delaySeconds: 120,
  prompt: "Verify deployment health: curl -s https://app.example.com/health | check status. If healthy for 2 consecutive checks → done.",
  reason: "deploy just completed, quick health check"
)

# Subsequent checks: longer intervals
ScheduleWakeup(
  delaySeconds: 1200,          # 20min, amortize cache miss
  prompt: "...",
  reason: "deploy stable, monitoring at 20min intervals"
)
```

### Post-Fix Verification

```python
ScheduleWakeup(
  delaySeconds: 270,
  prompt: "Re-run failing test to verify fix holds: npm test -- --testPathPattern=auth. If pass → done. If fail → investigate.",
  reason: "verifying fix stability after 4.5min"
)
```

## Termination

To stop the loop, **omit the ScheduleWakeup call** in the next iteration. No explicit cleanup needed (unlike CronDelete).

```python
# In the wakeup handler:
result = check_status()
if result == "all_pass":
    # Don't call ScheduleWakeup → loop ends
    return "CI passed, done."
else:
    # Continue polling
    ScheduleWakeup(delaySeconds: 270, ...)
```

## vs CronCreate

| Aspect | ScheduleWakeup | CronCreate |
|--------|---------------|------------|
| Lifetime | Session-scoped | Persistent |
| Cleanup | Auto (omit call) | Manual CronDelete |
| Pacing | Dynamic per-iteration | Fixed cron schedule |
| Cache | Aware (270s/1200s) | Unaware |
| Best for | In-session polling | Cross-session monitoring |

## Anti-Patterns

- **300s delay**: Exactly at cache boundary — pays cache miss without useful wait
- **Fixed intervals for variable tasks**: If build takes 2-8min, don't use fixed 5min — check elapsed and adapt
- **ScheduleWakeup for persistent monitors**: Use CronCreate for things that should survive session end
