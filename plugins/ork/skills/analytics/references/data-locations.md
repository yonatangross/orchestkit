# Data Sources & File Locations

All analytics data sources used by the analytics skill.

## OrchestKit Analytics Files

Location: `~/.claude/analytics/`

| File | Contents | Key Fields |
|------|----------|-----------|
| `agent-usage.jsonl` | Agent spawn events | `ts, pid, agent, model, duration_ms, success, output_len, team?` |
| `skill-usage.jsonl` | Skill invocations | `ts, pid, skill, team?` |
| `hook-timing.jsonl` | Hook execution timing | `ts, hook, duration_ms, ok, pid, team?` |
| `session-summary.jsonl` | Session end summaries | `ts, pid, total_tools, team?` |
| `task-usage.jsonl` | Task completions | `ts, pid, task_status, duration_ms, team?` |
| `team-activity.jsonl` | Team spawns and idle | `ts, pid, event, agent, member?, idle_ms?, model?, team` |

## CC Native Data Sources

| Source | Path | Contents |
|--------|------|----------|
| CC session logs | `~/.claude/projects/{encoded-path}/*.jsonl` | Full conversation with per-turn token usage |
| CC stats cache | `~/.claude/stats-cache.json` | Pre-aggregated daily model tokens, session counts |
| CC history | `~/.claude/history.jsonl` | Command history across all projects |

## JSONL Format Notes

- All OrchestKit files use newline-delimited JSON (JSONL)
- Each line is a self-contained JSON object
- Rotated files follow pattern `<name>.<YYYY-MM>.jsonl` — include them in queries for historical data
- The `team` field is only present for entries recorded during team/swarm sessions
- `pid` is a 12-char SHA256 hash of the project path — irreversible, used for grouping

## CC Session JSONL Structure

Each line in a CC session JSONL file is a JSON object. Key entry types:

| Entry Pattern | How to Identify | Key Fields |
|---------------|-----------------|------------|
| Session metadata | Has `sessionId`, `gitBranch`, `version` | First entries in file |
| Assistant message | `.message.role == "assistant"` | `.message.content[]`, `.message.usage` |
| User message | `.message.role == "user"` | `.message.content` |
| Tool use | `.message.content[].type == "tool_use"` | `.name`, `.input` |
| Hook progress | `.type == "progress"` + `.data.type == "hook_progress"` | `.data.hookName` |

## Encoded Project Path

CC encodes project paths by replacing `/` with `-`:
- `/Users/foo/coding/bar` becomes `-Users-foo-coding-bar`
- The encoded path is the directory name under `~/.claude/projects/`
