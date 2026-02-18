---
name: analytics
license: MIT
compatibility: "Claude Code 2.1.34+."
author: OrchestKit
description: "Query cross-project usage analytics. Use when reviewing agent, skill, hook, or team performance across OrchestKit projects. Also replay sessions, estimate costs, and view model delegation trends."
argument-hint: "[agents|models|skills|hooks|teams|session|cost|trends|summary]"
context: fork
agent: metrics-architect
version: 2.0.0
tags: [analytics, metrics, usage, teams, agents, skills, hooks, data-visualization, dashboard, recharts, charts, widgets, session, cost, tokens, model-delegation]
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
| `agent-usage.jsonl` | Agent spawn events | `ts, pid, agent, model, duration_ms, success, output_len, team?` |
| `skill-usage.jsonl` | Skill invocations | `ts, pid, skill, team?` |
| `hook-timing.jsonl` | Hook execution timing | `ts, hook, duration_ms, ok, pid, team?` |
| `session-summary.jsonl` | Session end summaries | `ts, pid, total_tools, team?` |
| `task-usage.jsonl` | Task completions | `ts, pid, task_status, duration_ms, team?` |
| `team-activity.jsonl` | Team spawns and idle | `ts, pid, event, agent, member?, idle_ms?, model?, team` |

## Subcommands

Parse the user's argument to determine which report to show. If no argument provided, use AskUserQuestion to let them pick.

Available subcommands: `agents`, `models`, `skills`, `hooks`, `teams`, `session`, `cost`, `trends`, `summary`.

### `agents` — Top agents by frequency and average duration

```bash
jq -s 'group_by(.agent) | map({agent: .[0].agent, count: length, avg_ms: (map(.duration_ms // 0) | add / length | floor), success_rate: (map(select(.success)) | length) / length * 100 | floor, models: (group_by(.model) | map({model: .[0].model, count: length}) | sort_by(-.count))}) | sort_by(-.count)' ~/.claude/analytics/agent-usage.jsonl
```

### `models` — Model delegation breakdown

```bash
jq -s 'group_by(.model) | map({model: .[0].model, count: length, avg_ms: (map(.duration_ms // 0) | add / length | floor), agents: ([.[].agent] | unique)}) | sort_by(-.count)' ~/.claude/analytics/agent-usage.jsonl
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

### `session` — Replay a session timeline

Show what happened in a specific session: tool calls, agent spawns, hooks, token counts, timing.

**Usage:** `/ork:analytics session latest` or `/ork:analytics session <session-id>`

**How to implement this subcommand:**

1. Find the CC session JSONL file. Sessions live at `~/.claude/projects/{encoded-project-path}/`.
   The current project's encoded path: replace `/` with `-` in the project directory path.
   Example: `/Users/foo/coding/bar` → `-Users-foo-coding-bar`

2. Resolve the session reference:
   - `latest` → find the most recently modified `.jsonl` file in the project directory
   - Partial ID (e.g., `08ed1436`) → find file starting with that prefix
   - Full UUID → exact match

```bash
# Find project session dir
PROJECT_DIR=$(echo "$CLAUDE_PROJECT_DIR" | sed 's|/|-|g')
SESSION_DIR="$HOME/.claude/projects/$PROJECT_DIR"

# List recent sessions (newest first)
ls -t "$SESSION_DIR"/*.jsonl 2>/dev/null | head -5

# For "latest": use the first result
LATEST=$(ls -t "$SESSION_DIR"/*.jsonl 2>/dev/null | head -1)
```

3. Parse the JSONL and extract a timeline. Each line is a JSON object. Key patterns:

```bash
# Count messages by role
jq -r '.message.role // empty' "$SESSION_FILE" | sort | uniq -c | sort -rn

# Extract tool calls with timestamps
jq -r 'select(.message.role == "assistant") | .message.content[]? | select(.type == "tool_use") | .name' "$SESSION_FILE" | sort | uniq -c | sort -rn

# Sum token usage
jq -s '[.[].message.usage // empty | {i: .input_tokens, o: .output_tokens, cr: .cache_read_input_tokens, cw: .cache_creation_input_tokens}] | {input: (map(.i) | add), output: (map(.o) | add), cache_read: (map(.cr) | add), cache_write: (map(.cw) | add)}' "$SESSION_FILE"

# Get session metadata (branch, version)
jq -r 'select(.gitBranch) | .gitBranch' "$SESSION_FILE" | head -1
jq -r 'select(.version) | .version' "$SESSION_FILE" | head -1

# Get start/end timestamps
jq -r '.timestamp' "$SESSION_FILE" | head -1   # start
jq -r '.timestamp' "$SESSION_FILE" | tail -1   # end

# Count agent spawns
jq -r '.message.content[]? | select(.type == "tool_use" and .name == "Task") | .input.subagent_type' "$SESSION_FILE" | sort | uniq -c | sort -rn
```

4. Present as a readable timeline:

```markdown
## Session: 08ed1436 — 2026-02-18 10:50 → 11:35 (45min)
**Branch:** bugfix/windows-spawn | **CC Version:** 2.1.45
**Tokens:** 152K in, 38K out | **Cache hit rate:** 89%

### Timeline
| Time | Event | Details |
|------|-------|---------|
| 10:50:00 | SESSION START | branch: bugfix/windows-spawn |
| 10:50:01 | HOOK | SessionStart:startup |
| 10:50:05 | Read | src/hooks/bin/spawn-worker.mjs |
| 10:50:08 | Grep | "spawn" in src/ |
| 10:50:15 | Task (agent) | code-quality-reviewer |
| 10:51:00 | Edit | src/hooks/bin/spawn-worker.mjs |
| 10:52:30 | Bash | npm test → 8.3s |
| 11:35:00 | SESSION END | 23 tool calls, 3 agents |

### Tool Usage
| Tool | Count |
|------|-------|
| Read | 12 |
| Edit | 5 |
| Bash | 4 |
| Task | 2 |

### Token Breakdown
| Metric | Value |
|--------|-------|
| Input tokens | 152,340 |
| Output tokens | 38,210 |
| Cache read | 1,245,000 |
| Cache write | 18,500 |
| Cache hit rate | 89% |
```

### `cost` — Token cost estimation (Sprint 2)

Estimate session costs using model-specific pricing. Uses CC's `~/.claude/stats-cache.json` for pre-aggregated model token data.

```bash
# Read stats-cache.json for model usage
jq '.modelUsage' ~/.claude/stats-cache.json

# Read daily model tokens
jq '.dailyModelTokens[-7:]' ~/.claude/stats-cache.json
```

**Pricing table (Feb 2026):**
| Model | Input/MTok | Output/MTok | Cache Read/MTok | Cache Write/MTok |
|-------|-----------|------------|----------------|-----------------|
| opus-4-6 | $5.00 | $25.00 | $0.50 | $6.25 |
| sonnet-4-5 | $3.00 | $15.00 | $0.30 | $3.75 |
| haiku-4-5 | $1.00 | $5.00 | $0.10 | $1.25 |

Calculate: `(input_tokens / 1M * input_price) + (output_tokens / 1M * output_price) + cache costs`

### `trends` — Usage trends over time (Sprint 2)

Show daily token usage, session counts, and model delegation trends.

```bash
# Daily activity from stats-cache
jq '.dailyActivity[-7:]' ~/.claude/stats-cache.json

# Daily model tokens
jq '.dailyModelTokens[-7:] | .[] | {date: .date, models: (.tokensByModel | to_entries | map({model: .key, tokens: .value}))}' ~/.claude/stats-cache.json
```

Present as sparklines or simple bar charts. Show 7-day and 30-day rolling averages.

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

## CC Session Data Locations

| Source | Path | Contents |
|--------|------|----------|
| OrchestKit analytics | `~/.claude/analytics/*.jsonl` | Agent, skill, hook, team, task metrics |
| CC session logs | `~/.claude/projects/{encoded-path}/*.jsonl` | Full conversation with token usage |
| CC stats cache | `~/.claude/stats-cache.json` | Pre-aggregated daily model tokens, session counts |
| CC history | `~/.claude/history.jsonl` | Command history across all projects |

## Related Skills

- `explore` - Codebase exploration and analysis
- `feedback` - Capture user feedback
- `remember` - Store project knowledge
- `doctor` - Health check diagnostics
