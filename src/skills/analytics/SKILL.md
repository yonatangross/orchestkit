---
name: analytics
license: MIT
compatibility: "Claude Code 2.1.206+."
author: OrchestKit
description: "Queries local analytics across OrchestKit projects for agent usage, skill frequency, hook timing, team activity, session replay, cost estimation, and model delegation trends. Privacy-safe with hashed project IDs. Supports time-range filtering and comparative analysis. Use when reviewing performance, estimating costs, or understanding usage patterns."
argument-hint: "[agents|models|skills|hooks|teams|session|cost|trends|summary]"
context: inherit
version: 2.1.0
tags: [analytics, metrics, usage, teams, agents, skills, hooks, data-visualization, dashboard, recharts, charts, widgets, session, cost, tokens, model-delegation]
user-invocable: false
allowed-tools: [Bash, Read, Grep, Glob, AskUserQuestion]
complexity: low
persuasion-type: collaborative
effort: low
model: haiku
metadata:
  category: document-asset-creation
---

# Cross-Project Analytics

Query local analytics data from `~/.claude/analytics/`. All data is local-only, privacy-safe (hashed project IDs, no PII).

Answer usage questions from the local files, never from guesswork: agent usage (which agents and how often — not which model, see the caveats) lives in `~/.claude/analytics/agent-usage.jsonl`; hook performance and failures live in `~/.claude/analytics/hook-timing.jsonl`; token and cost totals live in `~/.claude/stats-cache.json`. Query them with `jq` one-liners (below) and present real counts, not pointers to dashboards.

## Subcommands

Parse the user's argument to determine which report to show. If no argument provided, use AskUserQuestion to let them pick.

| Subcommand | Description | Data Source | Reference |
|------------|-------------|-------------|-----------|
| `agents` | Top agents by frequency and success rate (duration/model unavailable — #3034) | `agent-usage.jsonl` | `${CLAUDE_SKILL_DIR}/references/jq-queries.md` |
| `models` | Model delegation from **token totals** in `stats-cache.json`. Per-spawn attribution is unavailable (#3034) | `stats-cache.json` | `${CLAUDE_SKILL_DIR}/references/jq-queries.md` |
| `skills` | Top skills by invocation count | `skill-usage.jsonl` | `${CLAUDE_SKILL_DIR}/references/jq-queries.md` |
| `hooks` | Slowest hooks and failure rates | `hook-timing.jsonl` | `${CLAUDE_SKILL_DIR}/references/jq-queries.md` |
| `teams` | Team spawn counts, idle time, task completions | `team-activity.jsonl` | `${CLAUDE_SKILL_DIR}/references/jq-queries.md` |
| `session` | Replay a session timeline with tools, tokens, timing | CC session JSONL | `${CLAUDE_SKILL_DIR}/references/session-replay.md` |
| `cost` | Token cost estimation with cache savings | `stats-cache.json` | `${CLAUDE_SKILL_DIR}/references/cost-estimation.md` |
| `trends` | Daily activity, model delegation, peak hours | `stats-cache.json` | `${CLAUDE_SKILL_DIR}/references/trends-analysis.md` |
| `summary` | Unified view of all categories | All files | `${CLAUDE_SKILL_DIR}/references/jq-queries.md` |
| `otel` | CC 2.1.117 + 2.1.122 + 2.1.126 OTEL enrichments: top slash commands (user vs model), per-effort cost, effort-vs-success correlation, skill activation by trigger type, most-mentioned `@` targets | `~/.claude/otel/*.jsonl` | `${CLAUDE_SKILL_DIR}/references/otel-fields.md` |

### Quick Start Example

```bash
# Top agents by spawn frequency. Excludes phantom rows (see caveat below).
jq -s 'map(select(.agent != "unknown")) | group_by(.agent) | map({agent: .[0].agent, count: length}) | sort_by(-.count)' ~/.claude/analytics/agent-usage.jsonl

# Cost per model: input + output token counts (multiply by per-model pricing;
# count cache-read tokens separately — prompt-cache hits are ~90% cheaper, so
# cache savings materially lower the real total)
jq '.modelUsage | to_entries | map({model: .key, input: .value.inputTokens, output: .value.outputTokens, cacheRead: .value.cacheReadInputTokens})' ~/.claude/stats-cache.json

# Slowest hooks by average duration, and failure rate as a percentage
jq -s 'group_by(.hook) | map({hook: .[0].hook, avg_ms: (map(.duration_ms) | add / length), fail_pct: (100 * (map(select(.ok != true)) | length) / length)}) | sort_by(-.avg_ms)' ~/.claude/analytics/hook-timing.jsonl
```

### Quick Subcommand Guide

**`agents`, `models`, `skills`, `hooks`, `teams`, `summary`** — Run the jq query from `Read("${CLAUDE_SKILL_DIR}/references/jq-queries.md")` for the matching subcommand. Present results as a markdown table.

**`session`** — Follow the 4-step process in `Read("${CLAUDE_SKILL_DIR}/references/session-replay.md")`: locate session file, resolve reference (latest/partial/full ID), parse JSONL, present timeline.

**`cost`** — Apply model-specific pricing from `Read("${CLAUDE_SKILL_DIR}/references/cost-estimation.md")` to CC's stats-cache.json. Show per-model breakdown, totals, and cache savings. On CC >= 2.1.174, cross-check against CC-native `/usage` per-component attribution (see 'CC-Native /usage Attribution' below).

**`trends`** — Follow the 4-step process in `Read("${CLAUDE_SKILL_DIR}/references/trends-analysis.md")`: daily activity, model delegation, peak hours, all-time stats.

**`summary`** — Run all subcommands and present a unified view: total sessions, top 5 agents, top 5 skills, team activity, unique projects. If `~/.claude/otel/*.jsonl` exists with non-empty content, append the three OTEL panels from `otel-fields.md`; otherwise omit them (do not render empty panels).

**`otel`** — Render the OTEL panels: 3 from CC 2.1.117 (top slash commands user-vs-model, per-effort cost, effort-vs-success correlation), 3 from CC 2.1.119 (oversized inputs, pre/post latency, see `otel-fields.md`), 1 from CC 2.1.122 (most-mentioned `@` targets), and 1 from CC 2.1.126 (skill activation by trigger type). See `Read("${CLAUDE_SKILL_DIR}/references/otel-fields.md")` for queries, graceful-fallback rules, and panel semantics. Each panel falls back cleanly to "no OTEL data available (upgrade to CC ≥ X)" when its specific file is absent or empty — render only the panels with data.

## Data-Quality Caveats — read before reporting any number

Two measured defects in `agent-usage.jsonl` change what this file can honestly answer. Verified against 11,249 real rows on 2026-07-20.

**1. Four of eight fields are dead for 100% of rows (#3034).** `model` is the literal string `"unknown"` on every row, `agent_name` is null on every row, `output_len` is 0 on every row, and `duration_ms` is absent entirely. Only `ts`, `pid`, `agent`, and `success` carry signal. Do NOT report model delegation, agent duration, or output size from this file — grouping by `.model` returns one `unknown` bucket, not a breakdown. If asked, say the data is unavailable and cite #3034 rather than presenting a single-bucket result as if it were an answer.

**2. ~38% of rows are phantom events, not spawns (#3035).** Rows with `agent == "unknown"` have no SubagentStart, no readable transcript, and their agent ids appear nowhere in Claude Code's own session data. They are an inflated denominator: any activation ratio computed over the full file is wrong. **Filter `select(.agent != "unknown")` before computing any share, percentage, or ranking.** A specialist-vs-generic split over the raw file understates specialists by roughly a third.

Both are writer-side defects, not query bugs — a better jq expression cannot recover the missing signal.

## Data Files

Load `Read("${CLAUDE_SKILL_DIR}/references/data-locations.md")` for complete data source documentation.

| File | Contents |
|------|----------|
| `agent-usage.jsonl` | Agent spawns — usable fields are `ts`, `pid`, `agent`, `success` only. `model`/`agent_name`/`output_len`/`duration_ms` are dead (#3034) and ~38% of rows are phantoms (#3035) |
| `skill-usage.jsonl` | Skill invocations |
| `hook-timing.jsonl` | Hook execution timing and failure rates |
| `session-summary.jsonl` | Session end summaries |
| `task-usage.jsonl` | Task completions |
| `team-activity.jsonl` | Team spawns and idle events |

## Rules

Each category has individual rule files in `rules/` loaded on-demand:

| Category | Rule | Impact | Key Pattern |
|----------|------|--------|-------------|
| Data Integrity | `${CLAUDE_SKILL_DIR}/rules/data-privacy.md` | CRITICAL | Hash project IDs, never log PII, local-only |
| Cost & Tokens | `${CLAUDE_SKILL_DIR}/rules/cost-calculation.md` | HIGH | Separate pricing per token type, cache savings |
| Performance | `${CLAUDE_SKILL_DIR}/rules/large-file-streaming.md` | HIGH | Streaming jq for >50MB, rotation-aware queries |
| Visualization | `${CLAUDE_SKILL_DIR}/rules/visualization-recharts.md` | HIGH | Recharts charts, ResponsiveContainer, tooltips |
| Visualization | `${CLAUDE_SKILL_DIR}/rules/visualization-dashboards.md` | HIGH | Dashboard grids, stat cards, widget registry |

**Total: 5 rules across 4 categories**

## References

| Reference | Contents |
|-----------|----------|
| `${CLAUDE_SKILL_DIR}/references/jq-queries.md` | Ready-to-run jq queries for all JSONL subcommands |
| `${CLAUDE_SKILL_DIR}/references/session-replay.md` | Session JSONL parsing, timeline extraction, presentation |
| `${CLAUDE_SKILL_DIR}/references/cost-estimation.md` | Pricing table, cost formula, daily cost queries |
| `${CLAUDE_SKILL_DIR}/references/trends-analysis.md` | Daily activity, model delegation, peak hours queries |
| `${CLAUDE_SKILL_DIR}/references/data-locations.md` | All data sources, file formats, CC session structure |
| `${CLAUDE_SKILL_DIR}/references/otel-fields.md` | CC 2.1.117 OTEL fields (command_name, command_source, effort), queries, and dashboard panels |

## Important Notes

- All files are JSONL (newline-delimited JSON) format
- For large files (>50MB), use streaming `jq` without `-s` — load `Read("${CLAUDE_SKILL_DIR}/rules/large-file-streaming.md")`
- Rotated files: `<name>.<YYYY-MM>.jsonl` — include for historical queries
- `team` field only present during team/swarm sessions
- `pid` is a 12-char SHA256 hash — irreversible, for grouping only

## CC-Native /usage Attribution (2.1.174+)

CC 2.1.174 added per-component attribution to `/usage`: cache misses, long-context usage, subagent costs, and per-skill / per-agent / per-plugin / per-MCP cost breakdowns over the last 24h / 7d. It currently surfaces in the VSCode "Account & usage" dialog; in the terminal, run `/usage`.

When the user asks "which skill/agent actually costs the most" or questions ork's local estimates, direct them to `/usage` as the authoritative source — CC's own attribution supersedes ork's heuristic `cost` estimates for the windows it covers. Use ork's `cost`/`otel` views for history beyond CC's 7-day window and for cross-project slicing; use `/usage` for ground truth on the last 24h/7d.

## Output Format

Present results as clean markdown tables. Include counts, percentages, and averages. If a file doesn't exist, note that no data has been collected yet for that category.

## Related Skills

- `ork:explore` - Codebase exploration and analysis
- `ork:feedback` - Capture user feedback
- `ork:remember` - Store project knowledge
- `ork:doctor` - Health check diagnostics
