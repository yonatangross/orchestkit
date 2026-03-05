---
name: analytics
license: MIT
compatibility: "Claude Code 2.1.59+."
author: OrchestKit
description: "Query cross-project usage analytics. Use when reviewing agent, skill, hook, or team performance across OrchestKit projects. Also replay sessions, estimate costs, and view model delegation trends."
argument-hint: "[agents|models|skills|hooks|teams|session|cost|trends|summary]"
context: fork
version: 2.1.0
tags: [analytics, metrics, usage, teams, agents, skills, hooks, data-visualization, dashboard, recharts, charts, widgets, session, cost, tokens, model-delegation]
user-invocable: false
allowed-tools: [Bash, Read, Grep, Glob, AskUserQuestion]
complexity: low
model: haiku
metadata:
  category: document-asset-creation
---

# Cross-Project Analytics

Query local analytics data from `~/.claude/analytics/`. All data is local-only, privacy-safe (hashed project IDs, no PII).

## Subcommands

Parse the user's argument to determine which report to show. If no argument provided, use AskUserQuestion to let them pick.

| Subcommand | Description | Data Source | Reference |
|------------|-------------|-------------|-----------|
| `agents` | Top agents by frequency, duration, model breakdown | `agent-usage.jsonl` | `${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/jq-queries.md` |
| `models` | Model delegation breakdown (opus/sonnet/haiku) | `agent-usage.jsonl` | `${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/jq-queries.md` |
| `skills` | Top skills by invocation count | `skill-usage.jsonl` | `${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/jq-queries.md` |
| `hooks` | Slowest hooks and failure rates | `hook-timing.jsonl` | `${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/jq-queries.md` |
| `teams` | Team spawn counts, idle time, task completions | `team-activity.jsonl` | `${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/jq-queries.md` |
| `session` | Replay a session timeline with tools, tokens, timing | CC session JSONL | `${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/session-replay.md` |
| `cost` | Token cost estimation with cache savings | `stats-cache.json` | `${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/cost-estimation.md` |
| `trends` | Daily activity, model delegation, peak hours | `stats-cache.json` | `${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/trends-analysis.md` |
| `summary` | Unified view of all categories | All files | `${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/jq-queries.md` |

### Quick Start Example

```bash
# Top agents with model breakdown
jq -s 'group_by(.agent) | map({agent: .[0].agent, count: length}) | sort_by(-.count)' ~/.claude/analytics/agent-usage.jsonl

# All-time token costs
jq '.modelUsage | to_entries | map({model: .key, input: .value.inputTokens, output: .value.outputTokens})' ~/.claude/stats-cache.json
```

### Quick Subcommand Guide

**`agents`, `models`, `skills`, `hooks`, `teams`, `summary`** — Run the jq query from `Read("${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/jq-queries.md")` for the matching subcommand. Present results as a markdown table.

**`session`** — Follow the 4-step process in `Read("${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/session-replay.md")`: locate session file, resolve reference (latest/partial/full ID), parse JSONL, present timeline.

**`cost`** — Apply model-specific pricing from `Read("${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/cost-estimation.md")` to CC's stats-cache.json. Show per-model breakdown, totals, and cache savings.

**`trends`** — Follow the 4-step process in `Read("${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/trends-analysis.md")`: daily activity, model delegation, peak hours, all-time stats.

**`summary`** — Run all subcommands and present a unified view: total sessions, top 5 agents, top 5 skills, team activity, unique projects.

## Data Files

Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/data-locations.md")` for complete data source documentation.

| File | Contents |
|------|----------|
| `agent-usage.jsonl` | Agent spawn events with model, duration, success |
| `skill-usage.jsonl` | Skill invocations |
| `hook-timing.jsonl` | Hook execution timing and failure rates |
| `session-summary.jsonl` | Session end summaries |
| `task-usage.jsonl` | Task completions |
| `team-activity.jsonl` | Team spawns and idle events |

## Rules

Each category has individual rule files in `rules/` loaded on-demand:

| Category | Rule | Impact | Key Pattern |
|----------|------|--------|-------------|
| Data Integrity | `${CLAUDE_PLUGIN_ROOT}/skills/analytics/rules/data-privacy.md` | CRITICAL | Hash project IDs, never log PII, local-only |
| Cost & Tokens | `${CLAUDE_PLUGIN_ROOT}/skills/analytics/rules/cost-calculation.md` | HIGH | Separate pricing per token type, cache savings |
| Performance | `${CLAUDE_PLUGIN_ROOT}/skills/analytics/rules/large-file-streaming.md` | HIGH | Streaming jq for >50MB, rotation-aware queries |
| Visualization | `${CLAUDE_PLUGIN_ROOT}/skills/analytics/rules/visualization-recharts.md` | HIGH | Recharts charts, ResponsiveContainer, tooltips |
| Visualization | `${CLAUDE_PLUGIN_ROOT}/skills/analytics/rules/visualization-dashboards.md` | HIGH | Dashboard grids, stat cards, widget registry |

**Total: 5 rules across 4 categories**

## References

| Reference | Contents |
|-----------|----------|
| `${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/jq-queries.md` | Ready-to-run jq queries for all JSONL subcommands |
| `${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/session-replay.md` | Session JSONL parsing, timeline extraction, presentation |
| `${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/cost-estimation.md` | Pricing table, cost formula, daily cost queries |
| `${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/trends-analysis.md` | Daily activity, model delegation, peak hours queries |
| `${CLAUDE_PLUGIN_ROOT}/skills/analytics/references/data-locations.md` | All data sources, file formats, CC session structure |

## Important Notes

- All files are JSONL (newline-delimited JSON) format
- For large files (>50MB), use streaming `jq` without `-s` — load `Read("${CLAUDE_PLUGIN_ROOT}/skills/analytics/rules/large-file-streaming.md")`
- Rotated files: `<name>.<YYYY-MM>.jsonl` — include for historical queries
- `team` field only present during team/swarm sessions
- `pid` is a 12-char SHA256 hash — irreversible, for grouping only

## Output Format

Present results as clean markdown tables. Include counts, percentages, and averages. If a file doesn't exist, note that no data has been collected yet for that category.

## Related Skills

- `ork:explore` - Codebase exploration and analysis
- `ork:feedback` - Capture user feedback
- `ork:remember` - Store project knowledge
- `ork:doctor` - Health check diagnostics
