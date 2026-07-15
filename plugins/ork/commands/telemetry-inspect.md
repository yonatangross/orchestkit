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
4. **Orphan detection** — files on disk under `.claude/{telemetry,logs,state,feedback}/` that aren't in the registry (possible stale writer or new file needing schema), plus inventory rows whose writer hook no longer exists in `src/hooks/src/` (dead writer → orphan)
5. **Growth trend** — bytes per hour since session start (fire alert if > 100 KB/hr)
6. **Coordination layer (M168)** — live counts from `sessions.db` (running sessions, held locks, pending worktree links, skill invocations) plus write throughput from `coordination-metrics.jsonl`
7. **Runtime fired-census** — which hooks actually *fired*, from the per-invocation records `run-hook.mjs` writes to `~/.claude/analytics/hook-timing.jsonl`. Checks 1–4 answer "is the file being written?"; this answers "is the *writer* running at all?" — the upstream question. A hook can be wired and reachable (the closure gate proves that statically) and still never fire: #2886 shipped exactly that with 12 green tests.

## Usage

```bash
/ork:telemetry-inspect
/ork:telemetry-inspect --session sess-abc123
/ork:telemetry-inspect --json
```

Default mode: terminal-friendly ASCII report. `--json` emits a structured result suitable for piping into another tool or uploading.

## Output shape (ASCII mode)

```
Telemetry Health — 2026-07-09 11:50
────────────────────────────────────

Schema-locked files (7)
  .claude/telemetry/pre-compact-decisions.jsonl  ◆ 3 lines  1.1 KB  ✓ healthy
  .claude/telemetry/image-responses.jsonl        ◆ 0 lines  —       ✗ no writes
  .claude/logs/decisions.jsonl                   ◆ 0 lines  —       ✗ no writes
  .claude/logs/subagent-spawns.jsonl             ◆ 6 lines  3 KB    ✓ healthy
  .claude/state/edit-history.jsonl               ◆ 94 lines 412 KB  ⚠ rotate
  .claude/state/ork-metrics-*.json               ◆ (N/A)    2.1 KB  ✓ healthy
  .claude/logs/skill-channels.jsonl              ◆ 12 lines 4 KB    ✓ healthy

Unlocked telemetry files (14)
  .claude/feedback/changelog-decisions.json      ○ 4 KB    ✗ no schema
  .claude/feedback/learned-patterns.json         ○ 8 KB    ✗ no schema
  (...14 more...)

Orphan files (1)
  .claude/feedback/skill-usage.json  — delisted, writer unwired since #959

Runtime fired-census (7d window)
  ALIVE  59   IDLE 3   NEVER 83   UNOBSERVABLE 54
  tree 8.75.0 · installed 8.73.0/8.74.0  <-- SKEW: NEVER is not a verdict
  never-fired writers (the ones that matter here):
    posttool/dirty-file-tracker   [PostToolUse]   0 fires, ever

Summary
  Pipeline health:  GREEN  (21/21 expected writers active)
  Schema coverage:  7/21 (33%)
  Largest file:     edit-history.jsonl (412 KB)
  Hotspot:          edit-history.jsonl  +40 KB/hr
```

## Implementation plan (for an agent/LLM running this skill)

1. **List known files** — read `lib/telemetry-schemas.ts`'s `SCHEMA_LOCKED` inventory for the 7 locked paths. Extend with the unlocked paths listed in the skill-local `references/telemetry-inventory.md`.
2. **Cross-check inventory writers against the registry closure** — never trust the inventory blindly:
   - Run `node src/hooks/scripts/validate-registry.mjs` (from the OrchestKit repo root; skip gracefully if not in the OrchestKit repo) and confirm it passes.
   - For every writer named in the inventory (e.g. `posttool/metrics-bridge`), verify the source file exists: `test -f src/hooks/src/<writer>.ts`.
   - Any inventory writer that is NOT a live `src/hooks/src/` file is **ORPHANED — report 🔴**, never "expected-but-empty". Its file(s) on disk are orphans regardless of freshness, and the inventory row is stale (flag it for removal).
3. **For each file**:
   - Use `Glob` to resolve `.claude/state/ork-metrics-*.json` pattern → may be multiple
   - Use `Read` with `limit: 10` to see shape and `Bash wc -l` for line count
   - Use `Bash stat` for mtime + size
4. **Classify health**:
   - size > 1 MB → critical
   - size > 256 KB → warn
   - mtime > 7 days → "no recent writes"
   - line count 0 → "no writes"
5. **Orphan scan** — `Bash find .claude/{telemetry,logs,state,feedback} -type f` cross-check against registered paths. Any on-disk files not in inventory → orphan. Merge in dead-writer orphans from step 2.
6. **Runtime fired-census** — steps 1–5 ask "is the file being written?". This asks the upstream question: "does the writer hook run at all?"
   - Run `node src/hooks/scripts/fired-census.mjs --json` (OrchestKit repo only; skip gracefully elsewhere — it exits 0 and prints an absent-census notice if `~/.claude/analytics/hook-timing.jsonl` doesn't exist yet).
   - Report the class counts (`totals`), and the `versions.skewed` line **verbatim when true** — the census is written by the INSTALLED plugin across ALL projects, while the closure comes from this tree, so `NEVER` on a hook newer than the installed build is expected, not a finding.
   - Cross-reference: for every inventory writer from step 2 that is a live file, look up its census row. A writer that is `ALIVE` but whose file has 0 lines is a **real defect** (it runs and produces nothing). A writer that is `NEVER` is the #2886 class — surface it, but as advisory.
   - **Never** call a hook dead from `NEVER` alone. `UNOBSERVABLE` rows (dispatcher children) *cannot* appear by construction, and rare events (`WorktreeRemove`, `PreCompact`) look identical to a broken guard from here. Read the guard before concluding.
7. **Render report** — ASCII table by default, JSON if `--json` argument passed.

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
- **CC 2.1.145+**: `claude_code.tool` OTEL spans carry `agent_id` + `parent_agent_id`, and background subagent spans nest under the dispatching Agent tool span. Build the trace tree by querying on `parent_agent_id` — enables per-skill fan-out timing and cost attribution for multi-agent skills (`brainstorm`, `explore`, `implement`); no schema change needed.
- **CC 2.1.174+**: `/usage` exposes CC-native per-component attribution — cache misses, long context, subagents, and per-skill/agent/plugin/MCP cost breakdowns over 24h/7d (surfaced first in the VSCode Account & usage dialog). Treat it as a cross-check source in the health report: if ork telemetry shows a skill/agent active but CC attribution shows zero usage for it (or vice versa), flag the divergence as a possible missing writer or stale install rather than trusting either side alone.
- **CC 2.1.202+**: telemetry from workflow-spawned agents (a `/workflows` run) carries `workflow.run_id` + `workflow.name` attributes, so a whole workflow run is reconstructable from OTel — group all agent events on `workflow.run_id` to rebuild one run's fan-out, and slice by `workflow.name`. See `../analytics/references/otel-fields.md` ("From 2.1.202") for the field table; filter `select(.["workflow.run_id"] != null)` first, since ordinary session events lack these attributes.

## Related

- `lib/telemetry-schemas.ts` — source of truth for schema-locked paths
- `/ork:analytics` — aggregates data across sessions (different use case)
- M121 "Observability Consolidation" milestone
