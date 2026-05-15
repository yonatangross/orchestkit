---
name: agents-view
description: "Wraps the Research Preview `claude agents` CLI (CC 2.1.139+) and `claude plugin details ork` for live observability of parallel agent sessions. Surfaces running/blocked/done state, per-session token cost, and the 198-hook plugin's runtime footprint. Use when debugging multi-agent workflows, projecting cost on a long-running orchestration, or auditing which hooks fired during a run."
argument-hint: "[--plugin] [--watch] [--json] [--cwd <path>] [--effort <level>]"
tags: [observability, agents, cli, research-preview, cc-2.1.139, cost, debugging]
version: 0.1.0
author: OrchestKit
license: MIT
compatibility: "Claude Code 2.1.139+ (Research Preview)."
user-invocable: true
complexity: low
context: inherit
persuasion-type: guidance
allowed-tools: [Bash, Read]
metadata:
  category: observability
  milestone: M137
  research-preview: true
experimental:
  reason: "depends on CC 2.1.139 agent-view (Research Preview)"
  ga-by: "CC 2.1.145 expected"
  exit-criteria:
    - "CC removes Research Preview label from `claude agents`"
    - "At least one non-trivial OrchestKit skill consumes agent-id without rewrite"
triggers:
  keywords: ["agents view", "agent status", "running agents", "agent cost", "plugin details", "hook footprint"]
  examples:
    - "what agents are still running"
    - "show me the cost for this orchestration so far"
    - "which hooks fired in the last run"
  anti-triggers: [implement, fix, commit, refactor]
---

# /ork:agents-view — Parallel Agent Observability

**Research Preview — table layout may still change before GA. The CLI flag set stabilised in CC 2.1.142; pinned to CC ≥ 2.1.139.**

## 1. What it does

Thin wrapper around two CC 2.1.139 CLI surfaces:

| Command | Purpose |
|---|---|
| `claude agents` | Research Preview — lists parallel agent sessions with state (running / blocked / done), elapsed time, token usage, and per-session cost projection. |
| `claude plugin details ork` | Plugin runtime footprint — number of hooks loaded, skills available, agents registered, and which hooks fired in the current session. |

Flags:

- `--plugin` — show only `claude plugin details ork` (skip the agent list).
- `--watch` — re-poll every 2s until interrupted (uses `claude agents --watch` under the hood).
- `--json` — emit raw JSON for piping into downstream skills (e.g. budget gates).

CC 2.1.141 / 2.1.142 expanded the flag surface. The flag set is stable; only the human-readable table layout remains Research Preview.

| Flag | CC version | Purpose |
|---|---|---|
| `--cwd <path>` | 2.1.141 | Scope the session list to a directory. |
| `--add-dir <path>` | 2.1.142 | Additional working dir for the spawned session. |
| `--settings <path>` | 2.1.142 | Custom `settings.json` for this session. |
| `--mcp-config <path>` | 2.1.142 | Custom `.mcp.json` for this session. |
| `--plugin-dir <path>` | 2.1.142 | Inject a plugin from a local path. |
| `--permission-mode <mode>` | 2.1.142 | Override permission mode (`auto`, `plan`, etc). |
| `--model <id>` | 2.1.142 | Model override for this session. |
| `--effort <level>` | 2.1.142 | Effort level — `low` / `medium` / `high` / `xhigh`. |
| `--dangerously-skip-permissions` | 2.1.142 | Bypass all permission prompts. Audit before using. |

## 2. When to use

| Scenario | Why |
|---|---|
| **Parallel-agent debugging** — a `/ork:explore`, `/ork:brainstorm`, or `/ork:implement` run feels stuck | `claude agents` shows which child session is `blocked`, on what, and how long. Faster than tailing logs. |
| **Observability for the 198-hook plugin** | `claude plugin details ork` reports per-hook invocation counts; useful when a hook is suspected of slowing the loop or firing more often than expected. |
| **Per-session cost projection** | The Research Preview view ships token + dollar projections per agent. Use before kicking off a long `xhigh`-effort run. |
| **Post-mortem after an `xhigh` orchestration** | `--json` snapshot lets you diff hook fire counts and agent durations across runs. |

## 3. Sample output

<!-- ascii-lint-disable: width-80 balanced-corners -->
```
$ /ork:agents-view
claude agents — Research Preview (CC 2.1.139)
─────────────────────────────────────────────
ID      AGENT                          STATE     ELAPSED   TOKENS   COST(proj)
a1f3    ork:explore                    running   00:04:12  142.3K   $0.42
a1f4    └─ ork:backend-system-architect blocked   00:01:08   34.1K   $0.09   (waiting: db-schema)
a1f5    └─ ork:frontend-ui-developer   running   00:02:55   71.8K   $0.21
a1f2    ork:code-quality-reviewer      done      00:00:48   18.4K   $0.05
─────────────────────────────────────────────
4 sessions · 2 running · 1 blocked · 1 done · projected total $0.77

claude plugin details ork
─────────────────────────
skills:   107 loaded · 12 invoked this session
agents:   37 registered · 4 spawned this session
hooks:    198 total (130 global · 46 agent · 22 skill) · 31 fired
top hooks: skill/repo-structure-indexer (8×) · global/stale-import-detector (5×)
```

`--json` mode emits the same data as a single JSON object — see `claude agents --help` for the schema (Research Preview, subject to change).

## 4. Related Skills

The following skills all spawn background agents that surface in this view — `/ork:agents-view` is the canonical observability surface for any of them:

- `ork:brainstorm` — multi-agent ideation; check `--watch` while it runs to see which angle is blocking.
- `ork:audit-full` — long-running parallel audit; cost projection helps decide whether to let it finish.
- `ork:explore` — 4–5 parallel explorer agents; `claude agents` shows which explorer is still searching.
- `ork:dev` — boots agent-browser as a background session; appears alongside Claude agents in the list.

## Anti-patterns

- **NEVER** parse the human-readable table format — use `--json` for any programmatic consumer. The Research Preview output schema is documented; the table layout is not.
- **NEVER** assume `claude agents` is available on CC < 2.1.139 — fall back gracefully and surface the install hint.
- **NEVER** call this inside a tight loop without `--watch`; each invocation pays cold-start latency on the CLI.
