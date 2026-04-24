# Monitor Tool Patterns

`Monitor` (CC 2.1.98) streams each stdout line from a backgrounded process as a notification. Use it anywhere a workflow would otherwise poll output files or block on completion — tests, builds, long agents, agent-browser sessions.

## When to use Monitor

| Situation | Use |
|---|---|
| Background build/test/long script | `Monitor` — stream progress live |
| Finished task, need its final output | `TaskOutput(task_id)` — one-shot read (no block=true needed) |
| Gate entry on matching stdout line | `Monitor` + `until-condition` loop |
| Very short command (<5s) | `Bash(command="...")` foreground — not worth the overhead |

Monitor is NOT a replacement for `TaskOutput` on finished tasks. They answer different questions: *"what is this process doing right now?"* vs *"what did that task produce?"*.

## Pattern 1 — Streaming test execution

```python
# Start the test suite in the background
Bash(command="npm test -- --coverage 2>&1", run_in_background=true)

# Stream each line as it's produced
Monitor(pid=test_task_id)
# → user sees "PASS src/auth.test.ts", "FAIL src/db.test.ts", etc.
# → no polling, no intermediate "running tests..." lies
```

Applies to: `ork:cover`, `ork:verify`, any skill that runs a test suite longer than ~10 seconds.

## Pattern 2 — Streaming agent progress

```python
# Spawn a background agent
Agent(subagent_type="test-generator", run_in_background=true,
      prompt="Generate integration tests for the auth module")

# Watch its task-notification stream for partial progress (CC 2.1.98)
Monitor(pid=agent_task_id)
# → partial results arrive; if the agent crashes, salvageable output is visible
```

Applies to: `ork:implement`, `ork:cover`, any skill that spawns long-running background agents.

## Pattern 3 — Until-condition gate

```python
# Start a dev server
Bash(command="npm run dev 2>&1", run_in_background=true)
# Wait for "ready" message, then continue — don't block for fixed duration
Monitor(pid=dev_server_id)
# (gate satisfied once "ready" line is matched)
```

Applies to: `ork:expect` (agent-browser readiness), preview servers, long initialization.

## Pattern 4 — Partial-result salvage

Background agents can return `[PARTIAL RESULT]` when killed by context limit or timeout. With `Monitor` in place, the parent has already seen the partial stream — no need to re-spawn:

```python
# After Agent completes (partial or whole):
if "[PARTIAL RESULT]" in agent_result.output:
    # Stream already seen via Monitor — commit what's usable, flag incomplete
    commit_partial_files(agent_result.worktree)
    TaskUpdate(taskId=agent_task_id, status="completed",
               description=f"Partial: salvaged {len(partial_files)} files")
    # Do NOT re-spawn; wasted tokens
```

## Anti-patterns

### Polling `TaskOutput` in a loop

```python
# BAD — polls every N seconds, burns tokens on unchanged output
while True:
    out = TaskOutput(task_id)
    if "PASS" in out or "FAIL" in out: break
    time.sleep(5)
```

The `sleep` is blocked by OrchestKit's sleep-guard hook, and the pattern wastes cache on identical reads. Use `Monitor` instead.

### `TaskOutput(block=true)` — deprecated

CC 2.1.98 deprecated the `block=true` variant. Any skill that still documents it is stale; convert to `Monitor`. Current OrchestKit skills contain zero `block=true` call sites (verified 2026-04-24).

### Monitor for one-shot commands

```python
# BAD — overhead for a command that finishes in 200ms
Bash(command="git rev-parse HEAD", run_in_background=true)
Monitor(pid=head_id)
```

Foreground `Bash` is simpler and faster for short commands.

## Graceful fallback

`Monitor` requires CC ≥ 2.1.98. The version matrix in `src/hooks/src/lib/cc-version-matrix.ts` gates it. Skills that reference `Monitor` should not silently fail on older clients — either (a) the MIN_CC_VERSION guard (currently 2.1.117) makes fallback moot, or (b) document the `TaskOutput(task_id)` final-read path as the fallback in the skill itself.

## Related

- `chain-patterns/rules/push-notification-on-completion.md` — notify at completion (complements streaming during run).
- `chain-patterns/references/checkpoint-resume.md` — state.json discipline for long streaming runs.
- `ork:implement`, `ork:cover`, `ork:verify`, `ork:expect` — skills that apply these patterns.
