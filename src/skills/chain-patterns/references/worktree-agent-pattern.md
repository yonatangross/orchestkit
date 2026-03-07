# Worktree-Isolated Agents

Use `isolation: "worktree"` when spawning agents that write files in parallel. Each agent gets its own copy of the repo — no merge conflicts.

## When to Use

| Scenario | Use Worktree? | Why |
|----------|--------------|-----|
| 3 agents implementing different modules | YES | Each edits different files, may overlap |
| 3 agents investigating a bug (read-only) | NO | Only reading, no conflicts possible |
| 2 agents: one backend, one frontend | YES | Both may edit `package.json`, config files |
| 1 agent running tests | NO | Single agent, no conflict risk |
| Agent doing code review | NO | Read-only analysis |

## Pattern

```python
# Launch parallel agents with worktree isolation:
Agent(
  subagent_type="ork:backend-system-architect",
  description="Implement backend auth",
  prompt="Implement auth API endpoints...",
  isolation="worktree",          # ← gets own repo copy
  run_in_background=true         # ← non-blocking
)
Agent(
  subagent_type="ork:frontend-ui-developer",
  description="Implement frontend auth",
  prompt="Implement auth UI components...",
  isolation="worktree",
  run_in_background=true
)
```

## How It Works

1. CC creates a git worktree (separate directory, own branch)
2. Agent works in the worktree — edits don't affect main working directory
3. On completion, agent's changes are on a separate branch
4. Parent skill merges the branches back

## Hooks That Fire

- `WorktreeCreate` → `worktree-lifecycle-logger` (logs creation)
- `WorktreeRemove` → `worktree-lifecycle-logger` (logs cleanup)
- `SubagentStart` → `unified-dispatcher` (logs agent spawn)
- `SubagentStop` → `unified-dispatcher` (logs completion)

## Limitations

- Worktree agents are slightly slower to start (~2-3s overhead)
- Each worktree is a full copy — uses disk space
- Merge conflicts possible if agents edit same files (rare with proper task splitting)
- Don't use for read-only agents — unnecessary overhead
