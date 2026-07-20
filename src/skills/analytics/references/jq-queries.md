# Analytics jq Queries

Ready-to-run jq queries for each analytics subcommand. All queries target `~/.claude/analytics/*.jsonl`.

> **`agent-usage.jsonl` carries less signal than its schema suggests.** Measured against
> 11,249 real rows: `model`, `agent_name`, `output_len` and `duration_ms` are constant or
> absent on 100% of rows (#3034), and ~38% of rows are phantom `SubagentStop` events with no
> originating spawn (#3035). Only `ts`, `pid`, `agent` and `success` are usable. Every query
> below therefore filters phantoms before counting, and none of them group by `model` or
> average `duration_ms` — those columns cannot be recovered by a better query. See the
> Data-Quality Caveats section of `SKILL.md`.

## agents — Top agents by frequency and success rate

```bash
jq -s 'map(select(.agent != "unknown")) | group_by(.agent) | map({
  agent: .[0].agent,
  count: length,
  success_rate: (map(select(.success)) | length) / length * 100 | floor
}) | sort_by(-.count)' ~/.claude/analytics/agent-usage.jsonl
```

## models — Model delegation breakdown

Per-**spawn** model attribution is unavailable (#3034): `.model` is the literal string
`unknown` on every row of `agent-usage.jsonl`, so grouping by it yields one bucket. Answer
this question from token-level data in `stats-cache.json` instead, and say plainly that
per-spawn attribution is not recoverable.

```bash
jq '.modelUsage | to_entries | map({
  model: .key,
  input: .value.inputTokens,
  output: .value.outputTokens,
  cacheRead: .value.cacheReadInputTokens,
  costUSD: .value.costUSD
}) | sort_by(-.costUSD)' ~/.claude/stats-cache.json
```

## skills — Top skills by invocation count

```bash
jq -s 'group_by(.skill) | map({skill: .[0].skill, count: length}) | sort_by(-.count)' ~/.claude/analytics/skill-usage.jsonl
```

## hooks — Slowest hooks and failure rates

```bash
jq -s 'group_by(.hook) | map({
  hook: .[0].hook,
  count: length,
  avg_ms: (map(.duration_ms) | add / length | floor),
  fail_rate: (map(select(.ok == false)) | length) / length * 100 | floor
}) | sort_by(-.avg_ms) | .[0:15]' ~/.claude/analytics/hook-timing.jsonl
```

## teams — Team spawn counts, idle time, task completions

```bash
# Team activity (spawns + idle)
jq -s 'group_by(.team) | map({
  team: .[0].team,
  spawns: [.[] | select(.event == "spawn")] | length,
  idles: [.[] | select(.event == "idle")] | length,
  agents: [.[].agent] | unique
}) | sort_by(-.spawns)' ~/.claude/analytics/team-activity.jsonl

# Task completions by team
jq -s '[.[] | select(.team != null)] | group_by(.team) | map({
  team: .[0].team,
  tasks: length,
  avg_ms: (map(.duration_ms // 0) | add / length | floor)
})' ~/.claude/analytics/task-usage.jsonl
```

## summary — Quick counts

```bash
# Total sessions (excluding zero-tool sessions)
jq -s '[.[] | select(.total_tools > 0)] | length' ~/.claude/analytics/session-summary.jsonl

# Line counts per file
wc -l ~/.claude/analytics/*.jsonl 2>/dev/null

# Unique projects
jq -r .pid ~/.claude/analytics/agent-usage.jsonl 2>/dev/null | sort -u | wc -l
```

## Presentation Format

Present all results as clean markdown tables with counts, percentages, and averages. If a file doesn't exist, note that no data has been collected yet for that category. If the file exists but the field is dead (#3034), say the data is unavailable and cite the issue — never render a single-bucket group as if it were a breakdown.

Example output — note there is deliberately no Avg Duration or Top Model column, because
`agent-usage.jsonl` cannot support either (#3034):

```markdown
| Agent | Count | Success Rate |
|-------|-------|-------------|
| code-quality-reviewer | 45 | 98% |
| test-generator | 32 | 94% |
```

## Routing Analysis (SQLite)

The coordination DB (`~/.local/state/orchestkit/sessions.db`, populated by the
skill-tracker hook since 2026-07-10) ships a `routing_edge` view (migration 003):
for each `/ork:auto` or `/hq-ext:auto` invocation, the next skill invoked in the
same session **within 120 seconds** is treated as the route taken. No jq needed.

**Read the output as a lower bound, not a census.** The 120s window is
load-bearing: measured against real data, the unbounded version of this join had
a median gap of 43 minutes and a max of 27 hours, i.e. it was reporting "what the
user ran later in a long session", not routing. Bounding it cut 53 apparent
edges to 3 real ones. Rows are also missing whenever a router answers inline or
dispatches into a forked subagent whose skill calls land under a different
session id. Treat a low edge count as "not measurable this way", never as
"routing did not happen".

```bash
# Route distribution per router
sqlite3 -column ~/.local/state/orchestkit/sessions.db \
  "SELECT router, routed_to, COUNT(*) n FROM routing_edge
   GROUP BY router, routed_to ORDER BY router, n DESC;"

# Gap between the router call and the skill that followed it
sqlite3 -column ~/.local/state/orchestkit/sessions.db \
  "SELECT router, COUNT(*) n, AVG(gap_ms)/1000.0 avg_s FROM routing_edge
   GROUP BY router;"

# Per-project routing volume (join sessions for cwd)
sqlite3 -column ~/.local/state/orchestkit/sessions.db \
  "SELECT replace(s.cwd,'/Users/','~') proj, e.router, COUNT(*) n
   FROM routing_edge e JOIN sessions s ON s.sid = e.session_id
   GROUP BY proj, e.router ORDER BY n DESC LIMIT 20;"
```

Router-to-same-router pairs are excluded by the view: those are session
re-entries for a new goal, not a dispatch. Decision-level context (goal text,
chosen intent, mutating?) is NOT captured here and cannot be — routing decisions
are made in-prompt and never written anywhere. Capturing them needs a dedicated
decision-phase telemetry stream; this view is the zero-new-writers
approximation, not a substitute for it.
