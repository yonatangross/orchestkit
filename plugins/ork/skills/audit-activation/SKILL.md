---
name: audit-activation
compatibility: "Claude Code 2.1.206+"
description: Audits OrchestKit sub-agent activation from real spawn telemetry — computes the generic-vs-specialist spawn split, flags dormant agents (never fired), and classifies each as fires/mis-triggered/niche. The agent-side analogue of audit-skills. Use when specialized agents feel under-used, before pruning the catalog, or after wiring new agent spawn paths.
tags: [audit, agents, activation, telemetry, orchestkit]
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
context: fork
complexity: medium
persuasion-type: discipline
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - TaskCreate
  - TaskUpdate
  - TaskList
---

# audit-activation

Reports whether OrchestKit's specialized sub-agents are actually being activated, from **real spawn telemetry** — not vibes. The agent-side analogue of `audit-skills` (which audits skill *quality*; this audits agent *activation*).

It answers: "Do my specialized agents get spawned, or does the model default to generic Explore/general-purpose?" Read-only — it never edits agents.

> **Why this exists:** a 2026-06 audit found only ~14% of agent spawns hit the 37-agent catalog vs ~74% generic, with 17/37 agents dormant — and that agents fire ~1:1 with how often a high-traffic skill names them via `subagent_type=`. Description rewrites ("use proactively") were A/B-tested and gave Δ0, so this skill measures **wiring + usage**, not description prose. See `docs/feat--activation-audit/`.

## Quick Reference

| Category | File | Impact | When to Use |
|----------|------|--------|-------------|
| Activation Checks | `${CLAUDE_SKILL_DIR}/rules/activation-checks.md` | HIGH | What to compute per agent |
| Classification | `${CLAUDE_SKILL_DIR}/rules/activation-status.md` | HIGH | fires / mis-triggered / niche / dead buckets |
| Output Format | `${CLAUDE_SKILL_DIR}/references/output-format.md` | MEDIUM | Report layout + the spawn-split summary |

## CRITICAL: Task Management is MANDATORY (CC 2.1.16)

```python
TaskCreate(subject="Audit activation: agent spawn analysis",
  description="Computing generic-vs-specialist split + dormancy from spawn telemetry",
  activeForm="Auditing agent activation")
TaskCreate(subject="Read spawn telemetry", activeForm="Reading subagent-spawns.jsonl")
TaskCreate(subject="Compute split + dormancy", activeForm="Computing split and dormant agents")
TaskCreate(subject="Classify & render", activeForm="Classifying agents and rendering report")
TaskUpdate(taskId="3", addBlockedBy=["2"])
TaskUpdate(taskId="4", addBlockedBy=["3"])
```

## Workflow

1. **Inventory** — Glob `src/agents/*.md` (exclude README/INDEX/CONTRIBUTING) for the catalog.
2. **Read telemetry** — the FRESH stream is `.claude/logs/subagent-spawns.jsonl` (writers: `pretool/task/spawn-intent-logger` + `subagent-start/subagent-validator`). The legacy `~/.claude/analytics/agent-usage.jsonl` is dead (orphaned in a refactor) — see edge cases.
3. **Compute** — run all checks from `Read("${CLAUDE_SKILL_DIR}/rules/activation-checks.md")`: spawn split (generic / ork-catalog / other-plugin), per-agent fire counts, never-fired set, concentration (top-5 %).
4. **Classify** — apply `Read("${CLAUDE_SKILL_DIR}/rules/activation-status.md")`: each dormant agent → mis-triggered (wired but no real spawn path) / niche (legit rare) / dead (no references anywhere).
5. **Render** — output using `Read("${CLAUDE_SKILL_DIR}/references/output-format.md")`.

## Quick Start

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/run-activation-audit.sh"
```

The script reads the spawn telemetry, joins it against `src/agents/`, and prints the split, top agents, never-fired list, and concentration. Then apply the classification rules to bucket the dormant agents (this step needs the model: it greps skills/agents for each dormant agent's real spawn path).

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Telemetry source | Use `.claude/logs/subagent-spawns.jsonl` (fresh); ignore the dead `agent-usage.jsonl` |
| "never fired" caveat | Absence in the telemetry window is a strong signal, NOT proof of zero — state the window |
| Fix direction | Dormancy ⇒ wire a `subagent_type=` spawn from a high-traffic skill; do NOT rewrite descriptions (A/B Δ0) |
| Prune threshold | Only "dead" (no references in any skill/agent) is a prune candidate; niche stays |

## Chain

After this audit, run the deeper experiment if you suspect descriptions: `docs/feat--activation-audit/agent-routing-experiment.mjs` (isolated A/B selection harness).

## Related Skills

- `audit-skills` — quality audit for skills (this skill's sibling, agent-side)
- `telemetry-inspect` — validates the telemetry data-plane this skill reads from
- `analytics` — raw usage queries across projects
- `doctor` — broader plugin health (manifests, hooks, memory budget)
