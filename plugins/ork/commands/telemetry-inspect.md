---
description: "Inspects the OrchestKit telemetry pipeline for the current project — lists all known telemetry files with write counts, sizes, schema status, growth trend, and orphan detection. Use when verifying the observability pipeline is healthy, debugging a missing writer, or auditing which files have schema locks vs. which are drift-vulnerable. Read-only — never modifies telemetry files."
allowed-tools: [Bash, Read, Grep, Glob]
---

# Auto-generated from skills/telemetry-inspect/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# /ork:telemetry-inspect

One-shot health check for OrchestKit's telemetry pipeline. Reports writer activity, file sizes, schema lock coverage, orphan files, and growth warnings. Use when verifying the pipeline is flowing correctly or debugging a missing writer.

## When to use

- Before or after a risky hook refactor, to prove telemetry still writes as expected
- Weekly health check on a long-running project
- When `/ork:analytics` output looks suspicious — inspect the underlying data first
- When adding a new telemetry file and wanting to confirm it's picked up
- Auditing which files are schema-locked vs. drift-vulnerable

## What it checks

1. **Writer activity** — for each registered telemetry file, recent write count (from mtime scan) and last-write delta
2. **File health** — size (warn at 256 KB, critical at 1 MB), line count, mtime
3. **Schema lock status** — which files have validators in `lib/telemetry-schemas.ts`
4. **Orphan detection** — files on disk under `.claude/{telemetry,logs,state,feedback}/` that aren't in the registry (possible stale writer or new file needing schema)
5. **Growth trend** — bytes per hour since session start (fire alert if > 100 KB/hr)
6. **Coordination layer (M168)** — live counts from `sessions.db` (running sessions, held locks, pending worktree links, skill invocations) plus write throughput from `coordination-metrics.jsonl`

## Usage

```bash
/ork:telemetry-inspect
/ork:telemetry-inspect --session sess-abc123
/ork:telemetry-inspect --json
```

Default mode: terminal-friendly ASCII report. `--json` emits a structured result suitable for piping into another tool or uploading.

## Output shape (ASCII mode)

```
Telemetry Health — 2026-04-23 13:45
────────────────────────────────────

Schema-locked files (7)
  .claude/telemetry/pre-compact-decisions.jsonl  ◆ 3 lines  1.1 KB  ✓ healthy
  .claude/telemetry/image-responses.jsonl        ◆ 0 lines  —       ✗ no writes
  .claude/logs/decisions.jsonl                   ◆ 18 lines 12 KB   ✓ healthy
  .claude/logs/subagent-spawns.jsonl             ◆ 6 lines  3 KB    ✓ healthy
  .claude/state/edit-history.jsonl               ◆ 94 lines 412 KB  ⚠ rotate
  .claude/state/ork-metrics-*.json               ◆ (N/A)    2.1 KB  ✓ healthy
  .claude/feedback/skill-usage.json              ◆ (N/A)    1.2 KB  ✓ healthy

Unlocked telemetry files (14)
  .claude/feedback/changelog-decisions.json      ○ 4 KB    ✗ no schema
  .claude/feedback/code-style-profile.json       ○ 8 KB    ✗ no schema
  (...14 more...)

Orphan files (0)
  (none detected)

Summary
  Pipeline health:  GREEN  (21/21 expected writers active)
  Schema coverage:  7/21 (33%)
  Largest file:     edit-history.jsonl (412 KB)
  Hotspot:          edit-history.jsonl  +40 KB/hr
```

## Implementation plan (for an agent/LLM running this skill)

1. **List known files** — read `lib/telemetry-schemas.ts`'s `SCHEMA_LOCKED` inventory for the 7 locked paths. Extend with a hardcoded inventory of the other 14 unlocked paths (copy from the skill-local `references/telemetry-inventory.md`).
2. **For each file**:
   - Use `Glob` to resolve `.claude/state/ork-metrics-*.json` pattern → may be multiple
   - Use `Read` with `limit: 10` to see shape and `Bash wc -l` for line count
   - Use `Bash stat` for mtime + size
3. **Classify health**:
   - size > 1 MB → critical
   - size > 256 KB → warn
   - mtime > 7 days → "no recent writes"
   - line count 0 → "no writes"
4. **Orphan scan** — `Bash find .claude/{telemetry,logs,state,feedback} -type f` cross-check against registered paths. Any on-disk files not in inventory → orphan.
5. **Render report** — ASCII table by default, JSON if `--json` argument passed.

Core logic is deterministic + read-only. Do NOT write to any telemetry file — this skill is an observer.

## Coordination layer (M168 #1915)

The SQLite coordination layer lives **outside `.claude/`**, at `~/.local/state/orchestkit/`:

| Source | What it tells you |
|--------|-------------------|
| `sessions.db` | live session / lock / worktree state (SQLite) |
| `events.jsonl` | coordination event stream (goal_converged, chain_stale, …) |
| `coordination-metrics.jsonl` | `sessions.db` write throughput counters (#1915) |

**Live counts** — the DB file is a standard SQLite database; read it with `sqlite3` (read-only SELECTs only):

```bash
DB="$HOME/.local/state/orchestkit/sessions.db"
[ -f "$DB" ] || echo "coordination layer idle (no multi-session activity yet)"
sqlite3 "$DB" "SELECT COUNT(*) FROM sessions WHERE status='running'"                  # live sessions
sqlite3 "$DB" "SELECT COUNT(*) FROM locks WHERE expires_at > strftime('%s','now')"    # held locks
sqlite3 "$DB" "SELECT COUNT(*) FROM worktree_links WHERE result_status IS NULL"       # pending worktrees
sqlite3 "$DB" "SELECT COUNT(*) FROM skill_invocation"                                 # skill invocations
```

**Write throughput** — `coordination-metrics.jsonl` is append-only `{ts, metric, count}` lines emitted async by `lib/metrics-emitter.ts` on every `sessions.db` write. Event rate ≈ recent `sessions_db_write` lines:

```bash
M="$HOME/.local/state/orchestkit/coordination-metrics.jsonl"
[ -f "$M" ] && tail -200 "$M" | grep -c '"sessions_db_write"'
```

Degrade gracefully: if `sqlite3` is absent or the DB / metrics file doesn't exist, report **"coordination layer idle"** — never error. Like the rest of this skill, these are **read-only** observations.

## Upstream OTel metric notes

When inspecting Claude Code's own OTel metrics (downstream of this skill — `claude_code.*` in your collector):

- **CC 2.1.129+**: `claude_code.pull_request.count` now also counts PRs/MRs filed via MCP tools (e.g., GitHub MCP `create_pull_request`), not just shell commands run through the Bash tool. Dashboards built before 2.1.129 will see a step-function increase at the cutover — annotate, don't alert. See `references/../monitoring-observability/references/metrics-collection.md` for the join pattern that distinguishes MCP- from shell-filed PRs.
- **CC 2.1.161+**: `OTEL_RESOURCE_ATTRIBUTES` values are now attached as labels on all metric datapoints, enabling dimensional slicing (team, repo, environment). Existing dashboards keep working; new dashboards should use label selectors to segment usage.

## Related

- `lib/telemetry-schemas.ts` — source of truth for schema-locked paths
- `/ork:analytics` — aggregates data across sessions (different use case)
- M121 "Observability Consolidation" milestone
