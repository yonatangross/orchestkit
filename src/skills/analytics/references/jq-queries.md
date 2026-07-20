# Analytics jq Queries

Ready-to-run jq queries for each analytics subcommand. All queries target `~/.claude/analytics/*.jsonl`.

## agents — Top agents by frequency and duration

```bash
jq -s 'group_by(.agent) | map({
  agent: .[0].agent,
  count: length,
  avg_ms: (map(.duration_ms // 0) | add / length | floor),
  success_rate: (map(select(.success)) | length) / length * 100 | floor,
  models: (group_by(.model) | map({model: .[0].model, count: length}) | sort_by(-.count))
}) | sort_by(-.count)' ~/.claude/analytics/agent-usage.jsonl
```

## models — Model delegation breakdown

```bash
jq -s 'group_by(.model) | map({
  model: .[0].model,
  count: length,
  avg_ms: (map(.duration_ms // 0) | add / length | floor),
  agents: ([.[].agent] | unique)
}) | sort_by(-.count)' ~/.claude/analytics/agent-usage.jsonl
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

Present all results as clean markdown tables with counts, percentages, and averages. If a file doesn't exist, note that no data has been collected yet for that category.

Example output:

```markdown
| Agent | Count | Avg Duration | Success Rate | Top Model |
|-------|-------|-------------|-------------|-----------|
| code-quality-reviewer | 45 | 8.2s | 98% | opus |
| test-generator | 32 | 12.1s | 94% | sonnet |
```

## Routing Analysis (SQLite)

The coordination DB (`~/.local/state/orchestkit/sessions.db`, populated by the
skill-tracker hook since 2026-07-10) ships a `routing_edge` view (migration 003):
for each `/ork:auto` or `/hq-ext:auto` invocation, the next skill invoked in the
same session IS the route taken. No jq needed.

```bash
# Route distribution per router
sqlite3 -column ~/.local/state/orchestkit/sessions.db \
  "SELECT router, routed_to, COUNT(*) n FROM routing_edge
   GROUP BY router, routed_to ORDER BY router, n DESC;"

# Median handoff latency (router invocation -> routed skill invocation)
sqlite3 -column ~/.local/state/orchestkit/sessions.db \
  "SELECT router, COUNT(*) n, AVG(handoff_ms)/1000.0 avg_s FROM routing_edge
   GROUP BY router;"

# Per-project routing volume (join sessions for cwd)
sqlite3 -column ~/.local/state/orchestkit/sessions.db \
  "SELECT replace(s.cwd,'/Users/','~') proj, e.router, COUNT(*) n
   FROM routing_edge e JOIN sessions s ON s.sid = e.session_id
   GROUP BY proj, e.router ORDER BY n DESC LIMIT 20;"
```

Caveats: a router followed by no further skill in that session produces no edge
(abandoned or answered inline); `hq-ext:auto -> hq-ext:auto` edges are re-entries
in multi-goal sessions, not misroutes. Decision-level context (goal text, chosen
intent) is intentionally NOT captured — routing decisions are in-prompt.
