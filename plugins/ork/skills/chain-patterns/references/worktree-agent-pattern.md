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
  subagent_type="backend-system-architect",
  description="Implement backend auth",
  prompt="Implement auth API endpoints...",
  isolation="worktree",          # ← gets own repo copy
  run_in_background=true         # ← non-blocking
)
Agent(
  subagent_type="frontend-ui-developer",
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

## Required Setting (CC ≥ 2.1.133)

CC 2.1.133 reintroduced a `worktree.baseRef` setting whose default `"fresh"` branches new worktrees from `origin/<default-branch>` — **not** from local `HEAD`. OrchestKit's agent-isolation pattern needs unpushed commits to be visible to spawned agents, so set:

```json
{
  "worktree": {
    "baseRef": "head"
  }
}
```

Add this to `.claude/settings.json` (project) or `~/.claude/settings.json` (user). Without it, agents spawned via `Task(... isolation: "worktree")` start from origin and miss every unpushed local commit — `tsc` will fail with "cannot find module" for code you just wrote, and tests will run against stale source.

## Branch base (CC 2.1.128–2.1.132 default, CC 2.1.133+ with `baseRef: "head"`)

With `worktree.baseRef: "head"` (or any CC in the 2.1.128–2.1.132 window where this was the default), `EnterWorktree` creates the new branch from **local `HEAD`**, not from `origin/<default-branch>`. This means:

- Unpushed commits in the parent worktree are preserved in the new worktree
- No need to `git push` before spawning isolated agents
- Parent and child see the same uncommitted history

CC ≤ 2.1.127 branched from `origin/<default-branch>`, which silently dropped local-only commits. CC 2.1.128–2.1.132 changed the default to local `HEAD`. CC 2.1.133 added the explicit `worktree.baseRef` setting and reverted the default back to `"fresh"` (origin/<default>) — see "Required Setting" above. We floor at `2.1.170`, so the setting is the single source of truth.

> **CC 2.1.154 — nested-worktree HEAD fix**: `worktree.baseRef: "head"` previously resolved to the **main checkout's** HEAD (not the current worktree's) when spawning subagents or calling `EnterWorktree` from *inside* a linked worktree. 2.1.154 fixed this, so `"head"` is now reliable for nested/recursive worktree spawns too. Also in 2.1.154: subagents in background sessions no longer bypass the worktree-isolation guard, so `Agent(isolation:"worktree")` is safe for parallel spawns — the manual pre-create workaround (`implement/references/manual-worktree-pattern.md`) is superseded.

> **CC 2.1.133 — concurrent-session stability**: Running multiple worktree-isolated agents in parallel shares one refresh token across sessions. Before 2.1.133 a refresh-token race could 401 every session at once. At our floor this is fixed — concurrent worktree sessions are stable. See `${CLAUDE_SKILL_DIR}/../configure/references/cc-version-settings.md` (CC 2.1.133 section) for the full fix description.

## Limitations

- Worktree agents are slightly slower to start (~2-3s overhead)
- Each worktree is a full copy — uses disk space
- Merge conflicts possible if agents edit same files (rare with proper task splitting)
- Don't use for read-only agents — unnecessary overhead
