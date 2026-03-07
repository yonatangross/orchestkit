---
name: chain-patterns
description: "CC 2.1.71 pipeline patterns — MCP detection, handoff files, checkpoint-resume, worktree agents, CronCreate monitoring. Loaded via skills: field by pipeline skills (fix-issue, implement, brainstorming, verify). Not user-invocable."
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

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/mcp-detection.md")`

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

Load schema: `Read("${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/handoff-schema.md")`

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

Load protocol: `Read("${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/checkpoint-resume.md")`

## Pattern 4: Worktree-Isolated Agents

Use `isolation: "worktree"` when spawning agents that WRITE files in parallel.

```python
# Agents editing different files in parallel:
Agent(
  subagent_type="ork:backend-system-architect",
  prompt="Implement backend for: {feature}...",
  isolation="worktree",       # own copy of repo
  run_in_background=true
)
```

**When to use worktree:** Agents with Write/Edit tools running in parallel.
**When NOT to use:** Read-only agents (brainstorming, assessment, review).

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/worktree-agent-pattern.md")`

## Pattern 5: CronCreate Monitoring

Schedule post-completion health checks that survive session end.

```python
CronCreate(
  schedule="*/5 * * * *",
  prompt="Check CI status for PR #{number}:
    Run: gh pr checks {number} --repo {repo}
    All pass → CronDelete this job, report success.
    Any fail → alert with failure details."
)
```

Load patterns: `Read("${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/cron-monitoring.md")`

## Rules

| Rule | Impact | Key Pattern |
|------|--------|-------------|
| `rules/probe-before-use.md` | HIGH | Always ToolSearch before MCP calls |
| `rules/handoff-after-phase.md` | HIGH | Write handoff JSON after every major phase |
| `rules/checkpoint-on-gate.md` | MEDIUM | Update state.json at every user gate |

## References

Load on demand with `Read("${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/<file>")`:

| File | Content |
|------|---------|
| `mcp-detection.md` | ToolSearch probe pattern + capability map |
| `handoff-schema.md` | JSON schema for `.claude/chain/*.json` |
| `checkpoint-resume.md` | state.json schema + resume protocol |
| `worktree-agent-pattern.md` | `isolation: "worktree"` usage guide |
| `cron-monitoring.md` | CronCreate patterns for post-task health |
| `tier-fallbacks.md` | T1/T2/T3 graceful degradation |
