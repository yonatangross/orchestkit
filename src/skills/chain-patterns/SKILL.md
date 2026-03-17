---
name: chain-patterns
description: "Chain patterns for CC 2.1.71 pipelines — MCP detection, handoff files, checkpoint-resume, worktree agents, CronCreate monitoring. Use when building multi-phase pipeline skills. Loaded via skills: field by pipeline skills (fix-issue, implement, brainstorm, verify). Not user-invocable."
tags: [pipeline, resilience, checkpoint, mcp, orchestkit]
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
context: inherit
allowed-tools: [Read, ToolSearch]
complexity: low
model: haiku
---

# Chain Patterns

## Overview

Foundation patterns for CC 2.1.71 pipeline skills. This skill is loaded via the `skills:` frontmatter field — it provides patterns that parent skills follow.

## Pattern 1: MCP Detection (ToolSearch Probe)

Run BEFORE any MCP tool call. Probes are parallel and instant.

```python
# FIRST thing in any pipeline skill — all in ONE message:
ToolSearch(query="select:mcp__memory__search_nodes")
ToolSearch(query="select:mcp__context7__resolve-library-id")
ToolSearch(query="select:mcp__sequential-thinking__sequentialthinking")

# Store results for all phases:
Write(".claude/chain/capabilities.json", JSON.stringify({
  "memory": true_or_false,
  "context7": true_or_false,
  "sequential": true_or_false,
  "timestamp": "ISO-8601"
}))
```

**Usage in phases:**
```python
# BEFORE any mcp__memory__ call:
if capabilities.memory:
    mcp__memory__search_nodes(query="...")
# else: skip gracefully, no error
```

Load details: `Read("${CLAUDE_SKILL_DIR}/references/mcp-detection.md")`

## Pattern 2: Handoff Files

Write structured JSON after every major phase. Survives context compaction and rate limits.

```python
Write(".claude/chain/NN-phase-name.json", JSON.stringify({
  "phase": "rca",
  "skill": "fix-issue",
  "timestamp": "ISO-8601",
  "status": "completed",
  "outputs": { ... },           # phase-specific results
  "mcps_used": ["memory"],
  "next_phase": 5
}))
```

**Location:** `.claude/chain/` — numbered files for ordering, descriptive names for clarity.

Load schema: `Read("${CLAUDE_SKILL_DIR}/references/handoff-schema.md")`

## Pattern 3: Checkpoint-Resume

Read state at skill start. If found, skip completed phases.

```python
# FIRST instruction after MCP probe:
Read(".claude/chain/state.json")

# If exists and matches current skill:
#   → Read last handoff file
#   → Skip to current_phase
#   → Tell user: "Resuming from Phase N"

# If not exists:
Write(".claude/chain/state.json", JSON.stringify({
  "skill": "fix-issue",
  "started": "ISO-8601",
  "current_phase": 1,
  "completed_phases": [],
  "capabilities": { ... }
}))

# After each major phase:
# Update state.json with new current_phase and append to completed_phases
```

Load protocol: `Read("${CLAUDE_SKILL_DIR}/references/checkpoint-resume.md")`

## Pattern 4: Worktree-Isolated Agents

Use `isolation: "worktree"` when spawning agents that WRITE files in parallel.

```python
# Agents editing different files in parallel:
Agent(
  subagent_type="backend-system-architect",
  prompt="Implement backend for: {feature}...",
  isolation="worktree",       # own copy of repo
  run_in_background=true
)
```

**When to use worktree:** Agents with Write/Edit tools running in parallel.
**When NOT to use:** Read-only agents (brainstorm, assessment, review).

Load details: `Read("${CLAUDE_SKILL_DIR}/references/worktree-agent-pattern.md")`

## Pattern 5: CronCreate Monitoring

Schedule post-completion health checks that survive session end.

```python
# Guard: Skip cron in headless/CI (CLAUDE_CODE_DISABLE_CRON)
# if env CLAUDE_CODE_DISABLE_CRON is set, run a single check instead
CronCreate(
  schedule="*/5 * * * *",
  prompt="Check CI status for PR #{number}:
    Run: gh pr checks {number} --repo {repo}
    All pass → CronDelete this job, report success.
    Any fail → alert with failure details."
)
```

Load patterns: `Read("${CLAUDE_SKILL_DIR}/references/cron-monitoring.md")`

## Pattern 6: Progressive Output (CC 2.1.76)

Launch agents with `run_in_background=true` and output results as each returns — don't wait for all agents to finish. Gives ~60% faster perceived feedback.

```python
# Launch all agents in ONE message with run_in_background=true
Agent(subagent_type="backend-system-architect",
  prompt="...", run_in_background=true, name="backend")
Agent(subagent_type="frontend-ui-developer",
  prompt="...", run_in_background=true, name="frontend")
Agent(subagent_type="test-generator",
  prompt="...", run_in_background=true, name="tests")

# As each agent completes, output its findings immediately.
# CC delivers background agent results as notifications —
# present each result to the user as it arrives.
# If any agent scores below threshold, flag it before others finish.
```

**Key rules:**
- Launch ALL independent agents in a single message (parallel)
- Output each result incrementally — don't batch
- Flag critical findings immediately (don't wait for stragglers)
- Background bash tasks are killed at 5GB output (CC 2.1.77) — pipe verbose output to files

## Pattern 7: SendMessage Agent Resume (CC 2.1.77)

Continue a previously spawned agent using `SendMessage`. CC 2.1.77 auto-resumes stopped agents — no error handling needed.

```python
# Spawn agent
Agent(subagent_type="backend-system-architect",
  prompt="Design the API schema", name="api-designer")

# Later, continue the same agent with new context
SendMessage(to="api-designer", content="Now implement the schema you designed")

# CC 2.1.77: SendMessage auto-resumes stopped agents.
# No need to check agent state or handle "agent stopped" errors.
# NEVER use Agent(resume=...) — removed in 2.1.77.
```

## Pattern 8: /loop Skill Chaining (CC 2.1.71)

`/loop` runs a prompt or skill on a recurring interval — session-scoped, dies on exit, 3-day auto-expiry. Unlike `CronCreate` (agent-initiated), `/loop` is user-invoked and can chain other skills.

```text
# User types these — skills suggest them in "Next Steps"
/loop 5m gh pr checks 42                    # Watch CI after push
/loop 20m /ork:verify authentication        # Periodic quality gate
/loop 10m npm test -- --coverage            # Coverage drift watch
/loop 1h check deployment health at /api/health  # Post-deploy monitor
```

**Key difference from CronCreate:**
- `/loop` can invoke skills: `/loop 20m /ork:verify` (CronCreate can't)
- Both use the same underlying scheduler (50-task limit, 3-day expiry)
- Skills use `CronCreate` for agent-initiated scheduling
- Skills suggest `/loop` in "Next Steps" for user-initiated monitoring

**When to suggest /loop in Next Steps:**
- After creating a PR → `/loop 5m gh pr checks {pr_number}`
- After running tests → `/loop 10m npm test`
- After deployment → `/loop 1h check health at {endpoint}`
- After verification → `/loop 30m /ork:verify {scope}`

## Rules

| Rule | Impact | Key Pattern |
|------|--------|-------------|
| `rules/probe-before-use.md` | HIGH | Always ToolSearch before MCP calls |
| `rules/handoff-after-phase.md` | HIGH | Write handoff JSON after every major phase |
| `rules/checkpoint-on-gate.md` | MEDIUM | Update state.json at every user gate |

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:

| File | Content |
|------|---------|
| `mcp-detection.md` | ToolSearch probe pattern + capability map |
| `handoff-schema.md` | JSON schema for `.claude/chain/*.json` |
| `checkpoint-resume.md` | state.json schema + resume protocol |
| `worktree-agent-pattern.md` | `isolation: "worktree"` usage guide |
| `cron-monitoring.md` | CronCreate patterns for post-task health |
| `progressive-output.md` | Progressive output with run_in_background |
| `sendmessage-resume.md` | SendMessage auto-resume (CC 2.1.77) |
| `tier-fallbacks.md` | T1/T2/T3 graceful degradation |

## Related Skills

- `ork:implement` — Full-power feature implementation (primary consumer)
- `ork:fix-issue` — Issue debugging and resolution pipeline
- `ork:verify` — Post-implementation verification
- `ork:brainstorm` — Design exploration pipeline
