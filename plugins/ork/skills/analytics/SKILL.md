---
name: analytics
license: MIT
compatibility: "Claude Code 2.1.34+."
author: OrchestKit
description: "Query cross-project usage analytics. Use when reviewing agent, skill, hook, or team performance across OrchestKit projects."
argument-hint: "[subcommand]"
context: fork
agent: metrics-architect
version: 1.0.0
tags: [analytics, metrics, usage, teams, agents, skills, hooks, data-visualization, dashboard, recharts, charts, widgets]
user-invocable: true
allowed-tools: [Bash, Read, Grep, Glob, AskUserQuestion]
complexity: low
metadata:
  category: document-asset-creation
---

# Cross-Project Analytics

Query local analytics data from `~/.claude/analytics/`. All data is local-only, privacy-safe (hashed project IDs, no PII).

## Data Files

| File | Contents | Key Fields |
|------|----------|-----------|
| `agent-usage.jsonl` | Agent spawn events | `ts, pid, agent, duration_ms, success, output_len, team?` |
| `skill-usage.jsonl` | Skill invocations | `ts, pid, skill, team?` |
| `hook-timing.jsonl` | Hook execution timing | `ts, hook, duration_ms, ok, pid, team?` |
| `session-summary.jsonl` | Session end summaries | `ts, pid, total_tools, team?` |
| `task-usage.jsonl` | Task completions | `ts, pid, task_status, duration_ms, team?` |
| `team-activity.jsonl` | Team spawns and idle | `ts, pid, event, agent, member?, idle_ms?, model?, team` |

## Subcommands

Parse the user's argument to determine which report to show. If no argument provided, use AskUserQuestion to let them pick.

### `agents` — Top agents by frequency and average duration

```bash
jq -s 'group_by(.agent) | map({agent: .[0].agent, count: length, avg_ms: (map(.duration_ms // 0) | add / length | floor), success_rate: (map(select(.success)) | length) / length * 100 | floor}) | sort_by(-.count)' ~/.claude/analytics/agent-usage.jsonl
```

### `skills` — Top skills by invocation count

```bash
jq -s 'group_by(.skill) | map({skill: .[0].skill, count: length}) | sort_by(-.count)' ~/.claude/analytics/skill-usage.jsonl
```

### `hooks` — Slowest hooks and failure rates

```bash
jq -s 'group_by(.hook) | map({hook: .[0].hook, count: length, avg_ms: (map(.duration_ms) | add / length | floor), fail_rate: (map(select(.ok == false)) | length) / length * 100 | floor}) | sort_by(-.avg_ms) | .[0:15]' ~/.claude/analytics/hook-timing.jsonl
```

### `teams` — Team spawn counts, idle time, task completions

```bash
# Team activity (spawns + idle)
jq -s 'group_by(.team) | map({team: .[0].team, spawns: [.[] | select(.event == "spawn")] | length, idles: [.[] | select(.event == "idle")] | length, agents: [.[].agent] | unique}) | sort_by(-.spawns)' ~/.claude/analytics/team-activity.jsonl

# Task completions by team
jq -s '[.[] | select(.team != null)] | group_by(.team) | map({team: .[0].team, tasks: length, avg_ms: (map(.duration_ms // 0) | add / length | floor)})' ~/.claude/analytics/task-usage.jsonl
```

### `summary` — Overall cross-project summary

Run all of the above and present a unified view:
- Total sessions, total tool invocations
- Top 5 agents, top 5 skills
- Team activity overview (if team data exists)
- Unique project hashes count

```bash
# Quick counts
wc -l ~/.claude/analytics/*.jsonl 2>/dev/null
# Unique projects
jq -r .pid ~/.claude/analytics/agent-usage.jsonl 2>/dev/null | sort -u | wc -l
```

## Important Notes

- All files are in JSONL (newline-delimited JSON) format
- For large files (>50MB), use streaming `jq` without `-s` (slurp) flag
- Rotated files follow pattern `<name>.<YYYY-MM>.jsonl` — include them in queries if historical data is needed
- The `team` field is only present for entries recorded during team/swarm sessions
- `pid` is a 12-char SHA256 hash of the project path — irreversible, used for grouping

## Rules

Each category has individual rule files in `rules/` loaded on-demand:

| Category | Rule | Impact | Key Pattern |
|----------|------|--------|-------------|
| Visualization | `rules/visualization-recharts.md` | HIGH | Recharts charts, ResponsiveContainer, custom tooltips |
| Visualization | `rules/visualization-dashboards.md` | HIGH | Dashboard grids, stat cards, widget registry, SSE updates |

**Total: 2 rules across 1 category**

## Output Format

Present results as a clean markdown table. Include counts, percentages, and averages. If a file doesn't exist, note that no data has been collected yet for that category.

## Related Skills

- `explore` - Codebase exploration and analysis
- `feedback` - Capture user feedback
- `remember` - Store project knowledge
