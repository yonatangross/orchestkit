---
description: "Query cross-project usage analytics. Use when reviewing agent, skill, hook, or team performance across OrchestKit projects. Also replay sessions, estimate costs, and view model delegation trends."
allowed-tools: [Bash, Read, Grep, Glob, AskUserQuestion]
---

# Auto-generated from skills/analytics/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


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

### Quick Subcommand Guide

**`agents`, `models`, `skills`, `hooks`, `teams`, `summary`** — Run the jq query from `references/jq-queries.md` for the matching subcommand. Present results as a markdown table.

**`session`** — Follow the 4-step process in `references/session-replay.md`: locate session file, resolve reference (latest/partial/full ID), parse JSONL, present timeline.

**`cost`** — Apply model-specific pricing from `references/cost-estimation.md` to CC's stats-cache.json. Show per-model breakdown, totals, and cache savings.

**`trends`** — Follow the 4-step process in `references/trends-analysis.md`: daily activity, model delegation, peak hours, all-time stats.

**`summary`** — Run all subcommands and present a unified view: total sessions, top 5 agents, top 5 skills, team activity, unique projects.

## Data Files

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
| Data Integrity | `rules/data-privacy.md` | CRITICAL | Hash project IDs, never log PII, local-only |
| Cost & Tokens | `rules/cost-calculation.md` | HIGH | Separate pricing per token type, cache savings |
| Performance | `rules/large-file-streaming.md` | HIGH | Streaming jq for >50MB, rotation-aware queries |
| Visualization | `rules/visualization-recharts.md` | HIGH | Recharts charts, ResponsiveContainer, tooltips |
| Visualization | `rules/visualization-dashboards.md` | HIGH | Dashboard grids, stat cards, widget registry |

**Total: 5 rules across 4 categories**

## References

| Reference | Contents |
|-----------|----------|
| `references/jq-queries.md` | Ready-to-run jq queries for all JSONL subcommands |
| `references/session-replay.md` | Session JSONL parsing, timeline extraction, presentation |
| `references/cost-estimation.md` | Pricing table, cost formula, daily cost queries |
| `references/trends-analysis.md` | Daily activity, model delegation, peak hours queries |
| `references/data-locations.md` | All data sources, file formats, CC session structure |

## Important Notes

- All files are JSONL (newline-delimited JSON) format
- For large files (>50MB), use streaming `jq` without `-s` — see `rules/large-file-streaming.md`
- Rotated files: `<name>.<YYYY-MM>.jsonl` — include for historical queries
- `team` field only present during team/swarm sessions
- `pid` is a 12-char SHA256 hash — irreversible, for grouping only

## Output Format

Present results as clean markdown tables. Include counts, percentages, and averages. If a file doesn't exist, note that no data has been collected yet for that category.

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
