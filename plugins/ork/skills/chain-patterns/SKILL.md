---
name: chain-patterns
compatibility: "Claude Code 2.1.183+"
description: "Chain patterns for CC 2.1.71 pipelines — MCP detection, handoff files, checkpoint-resume, worktree agents, CronCreate monitoring. Use when building multi-phase pipeline skills. Loaded via skills: field by pipeline skills (fix-issue, implement, brainstorm, verify). Not user-invocable."
tags: [pipeline, resilience, checkpoint, mcp, orchestkit]
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
context: inherit
allowed-tools: [Read, ToolSearch]
complexity: medium
persuasion-type: guidance
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
  subagent_type="ork:backend-system-architect",
  prompt="Implement backend for: {feature}...",
  isolation="worktree",       # own copy of repo
  run_in_background=true
)
```

**When to use worktree:** Agents with Write/Edit tools running in parallel.

> **CC 2.1.157 worktree lifecycle:** `EnterWorktree` can switch between Claude-managed worktrees mid-session, and worktrees are left **unlocked** when the agent finishes — so `git worktree remove`/`prune` cleans them up without `--force`.

> **Session-aware worktree check (CC 2.1.145):** before parallel-worktree work, detect concurrent same-repo sessions with `claude agents --json` (filter by `working_dir`) rather than `ps`/`pgrep` — it returns `session_id`, `parent_agent_id`, `working_dir`, `awaiting_input`, and `elapsed` per live session, so you can tell *which* sessions share this repo.
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

> **Background by default (CC 2.1.198+):** Agent-tool subagents launch in the background even when `run_in_background` is omitted. Pass `run_in_background: false` only when a stage must block on the result before continuing (e.g. a verdict gate ahead of a destructive step). The `Notification` hook fires `agent_needs_input` / `agent_completed` as background agents progress — ork's notification hooks surface both.

```python
# Launch all agents in ONE message with run_in_background=true
Agent(subagent_type="ork:backend-system-architect",
  prompt="...", run_in_background=true, name="backend")
Agent(subagent_type="ork:frontend-ui-developer",
  prompt="...", run_in_background=true, name="frontend")
Agent(subagent_type="ork:test-generator",
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
- Parallel tool calls fail independently (CC 2.1.161) — a failed Bash no longer cancels siblings in the batch; add explicit per-call error handling instead of relying on cascade-abort

## Pattern 7: SendMessage Agent Resume (CC 2.1.77)

Continue a previously spawned agent using `SendMessage`. CC 2.1.77 auto-resumes stopped agents — no error handling needed.

```python
# Spawn agent
Agent(subagent_type="ork:backend-system-architect",
  prompt="Design the API schema", name="api-designer")

# Later, continue the same agent with new context
SendMessage(to="api-designer", message="Now implement the schema you designed")

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

> **CC 2.1.169 — `/cd` keeps the cache across directory moves:** chains that hop between repos or into manually created worktrees should use `/cd <dir>` instead of ending the session — the prompt cache survives the move, so the next phase doesn't re-pay full context ingest. (Self-hosted runner chains can also export `.claude/chain/` artifacts in the new `post-session` hook before the workspace is deleted.)

## Pattern 9: Nested Delegation (CC 2.1.172)

Sub-agents can spawn their own sub-agents, up to 5 levels deep. Agents declaring `Agent(ork:xxx)` in their tools frontmatter (12 ork agents do) now execute those chains for real — e.g. `infrastructure-architect → ork:ci-cd-engineer → ork:deployment-manager` runs as a live 3-level chain.

```python
# Parent agent's prompt can delegate a sub-problem to ITS declared specialist:
Agent(subagent_type="ork:backend-system-architect",
      prompt="Design the API. Delegate schema design to ork:database-engineer.")
# backend-system-architect internally calls Agent(ork:database-engineer) — depth 2.
```

> **Registry names, advisory scope (#2371, live-verified on CC 2.1.173):** nested spawns must use the namespaced registry type — bare `Agent(database-engineer)` fails at dispatch. And the `Agent(...)` grant is advisory: CC does not block out-of-grant spawns, so the declared list steers the model only through its prompt documentation.

**Nest when** (depth 2-3):
- A specialist needs its OWN specialist for a bounded sub-problem (schema → index tuning)
- The sub-result must be synthesized by the intermediate agent, not the main loop
- Worktree isolation should scope to the subtree (`isolation: "worktree"` works recursively)

**Flatten when** (parallel dispatch from the main loop):
- Sub-tasks are independent — parallel fan-out is faster and cheaper than a serial chain
- The main loop needs each raw result anyway (nesting hides intermediates)
- You're tempted past depth 3 — each level multiplies latency and token cost; CC hard-caps at 5

**Depth budget:** treat 3 as the practical ceiling. Depth telemetry is currently DORMANT: CC sends no `parent_agent_id` at SubagentStart (live-verified 2026-06-11), so `spawn_depth` is logged only when lineage is real and the validator's depth ≥ 4 warning cannot fire until upstream exposes agent context in hook payloads (anthropics/claude-code#16424). Until then the budget is enforced by THIS guidance, not by hooks — respect it.

> **CC 2.1.181 — foreground depth cap now enforced:** foreground subagents previously spawned unbounded nested chains; CC now rejects spawns past 5 levels deep, the same limit background subagents always had. This is CC's INTERNAL spawn-time rejection — distinct from ork's hook-based depth-≥4 warning above, which stays dormant (2.1.181 did not expose `parent_agent_id`). ork's ≤3 convention sits safely under the enforced 5-cap; the failure mode authors now hit is a hard depth-limit rejection, not silent unbounded growth.

> **CC 2.1.203 — subagents less likely to re-delegate their whole task:** upstream tuned subagent behavior so an agent no longer hands its ENTIRE task to another subagent instead of doing the work itself. This reinforces the "each level synthesizes, never forwards" contract below — with accidental full-task handoff suppressed, the remaining depth pressure is the deliberate-nesting cost this budget already governs.

**Worked example — depth-3 infra chain** (grants live in `src/agents/`):

```python
# Depth 1 — main loop dispatches the architect:
Agent(subagent_type="ork:infrastructure-architect",
      prompt="Design staging infra for the API: Terraform module for ECS + RDS.
              Delegate pipeline wiring to ork:ci-cd-engineer, and have IT
              delegate the rollout plan to ork:deployment-manager.")

# Depth 2 — infrastructure-architect, mid-run, spawns its declared specialist:
Agent(subagent_type="ork:ci-cd-engineer",
      prompt="Wire GitHub Actions deploy for the Terraform module at infra/staging/:
              plan on PR, apply on merge to main, OIDC to AWS — no long-lived keys.
              Delegate the production rollout strategy to ork:deployment-manager.")

# Depth 3 — ci-cd-engineer spawns ITS declared specialist:
Agent(subagent_type="ork:deployment-manager",
      prompt="Given the apply-on-merge pipeline above, produce the rollout plan:
              blue-green for the ECS service, health-check gates, and the exact
              rollback sequence if p99 regresses post-cutover.")
```

**What flows back up** — each level synthesizes, never forwards raw transcripts:
- deployment-manager → ci-cd-engineer: rollout plan + rollback commands (final text result)
- ci-cd-engineer → infrastructure-architect: workflow files written, rollout plan folded into the deploy job
- infrastructure-architect → main loop: ONE report — module paths, pipeline summary, rollout strategy. The main loop never sees depths 2-3 directly.

Grant chain: `infrastructure-architect` declares `Agent(ork:ci-cd-engineer)` + `Agent(ork:deployment-manager)`; `ci-cd-engineer` declares `Agent(ork:deployment-manager)`; `deployment-manager` declares no `Agent(...)` grants — the natural leaf, so the chain can't drift past depth 3.

> **Compatibility:** chains deeper than 2 require CC 2.1.172+. On older CC, nested `Agent(...)` calls fail at dispatch — design chains to degrade (intermediate agent does the work inline) rather than assume the specialist ran.

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
| `experiment-journal.md` | Append-only TSV log for try/measure/keep-or-discard cycles |
| `progressive-output.md` | Progressive output with run_in_background |
| `sendmessage-resume.md` | SendMessage auto-resume (CC 2.1.77) |
| `tier-fallbacks.md` | T1/T2/T3 graceful degradation |
| `dynamic-workflow-patterns.md` | The 6 Dynamic-Workflow patterns → ork map, failure-mode selection, per-agent model tiers, use-directly-vs-template, quarantine pointer |
| `assertion-grader.md` | Fresh-context grader auditing a `/goal` assertion set on timeout/stall — verdict tighten/loosen/abort + revised line |

## Related Skills

- `ork:implement` — Full-power feature implementation (primary consumer)
- `ork:fix-issue` — Issue debugging and resolution pipeline
- `ork:verify` — Post-implementation verification
- `ork:brainstorm` — Design exploration pipeline
