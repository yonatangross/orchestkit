# OrchestKit Coordination Architecture (M168)

Canonical design for OrchestKit's multi-session coordination layer — the
SQLite-backed system that replaced `monitors.json` (milestone **M168**, umbrella
[#1908](https://github.com/yonatangross/orchestkit/issues/1908)).

> **Status:** shipped. Phases 1–4 (architecture) + Phase 5 (telemetry, #1915) +
> Phase 6 (this doc, #1916). `monitors.json` is hard-deleted; there is no
> backwards-compatibility path.

## Why monitors.json was removed

`src/monitors/monitors.json` shipped background polling shells. They:

- spawned zombie processes that outlived their session,
- had **no** awareness of other sessions, repos, or worktrees on the machine, and
- duplicated work (every session ran every monitor, even when irrelevant).

M168 replaced them with a coordination substrate that is **session-aware,
multi-repo-aware, and worktree-aware**, with no background processes — all state
lives in SQLite + append-only logs that hooks read/write on the events they
already fire on.

## The layers

All coordination state lives **outside `.claude/`**, under
`~/.local/state/orchestkit/` (machine-global, shared across repos/worktrees).

| Layer | Store | Written by | Purpose |
|-------|-------|-----------|---------|
| 1. Session registry | `sessions.db` (SQLite) | `lifecycle/session-registrar` (SessionStart), `session-finalizer` (SessionEnd), `posttool/heartbeat` (PostToolUse) | Live session table |
| 2. Settings overrides | removed (#3353, migration 005) | none | The `settings_overrides` table never held a row; per-session effort and model are CC-native now |
| 3. Event stream | `events.jsonl` | `stop/goal-convergence-emitter`, `posttool/chain-staleness-checker` | Append-only coordination events |
| 4. Worktree advisory | removed (#3315 retired the writers, #3353 dropped `worktree_links`) | none | Worktree provisioning is CC-native |
| Analytics | `sessions.db` `skill_invocation` | `recordInvocation()` | Skill usage (#2010) |
| Telemetry | `coordination-metrics.jsonl` | `lib/metrics-emitter` (#1915) | Async `sessions.db` write counters |

### sessions.db schema

Migrations live in `src/hooks/src/lib/sqlite-migrations/`:

- **sessions** (`sid` PK) — pid, cwd, repo_hash, repo_path, worktree_path, branch, parent_sid, status, started_at, last_heartbeat, ended_at, cc_version, ork_version
- **skill_invocation** — session_id (FK), skill, invoked_at
- `locks`, `settings_overrides` and `worktree_links` were declared in 001 and dropped in 005 (#3353): 0 rows ever written, no production writer.

### Write discipline

Every write routes through `writeWithRetry()` (`lib/session-registry.ts`), which
wraps the mutation in `BEGIN IMMEDIATE` + jittered backoff on `SQLITE_BUSY` (15
retries, ~1.3 s worst case). `DatabaseSync` (node:sqlite) is synchronous, so the
backoff is a bounded spin — acceptable because writes are tiny and rare relative
to the hook hot path. Reads never take the reserved lock.

### Telemetry (Phase 5, #1915)

`writeWithRetry()` calls `incrementMetric('sessions_db_write')` after each
`COMMIT`. `lib/metrics-emitter` keeps an in-process counter and flushes it via a
single `setImmediate` to `coordination-metrics.jsonl` — **never** blocking the
hot path, **no** background process. If disk is slow the counter is dropped with
one stderr line; coordination correctness never depends on metrics landing.
Inspect via `/ork:telemetry-inspect` (live SQLite counts + write throughput).
Opt out with `ORK_DISABLE_COORDINATION_METRICS=1`.

## Architecture Decision Record

**ADR-M168 — Replace monitors.json with SQLite-backed coordination**

- **Status:** Accepted (2026-05-21), shipped v8.0.0+ (Phase 1 hard-delete in #1911).
- **Context:** background polling shells produced zombies and had no
  cross-session awareness; the plugin needed coordination that survives
  concurrent sessions, multiple repos, and git worktrees.
- **Decision:** delete `monitors.json` entirely (no compat shim) and model
  coordination as SQLite tables + append-only JSONL written by the hooks that
  already fire on the relevant events. No daemon, no polling.
- **Consequences:**
  - (+) zero background processes; state is inspectable with `sqlite3`.
  - (+) correct under concurrent sessions/worktrees (BEGIN IMMEDIATE + TTL locks).
  - (+) telemetry is free — counters ride the existing write path (#1915).
  - (−) requires Node ≥ 22.5 for `node:sqlite` (`DatabaseSync`); degrades to
    best-effort no-op on older runtimes (analytics/coordination simply skip).
  - (−) BREAKING: anything that read `monitors.json` is gone with no fallback.
- **Alternatives rejected:** keeping a (lighter) polling daemon (still a process
  to supervise); a single JSON state file (no atomic multi-writer story).

## Inspecting the live system

```bash
DB="$HOME/.local/state/orchestkit/sessions.db"
sqlite3 "$DB" "SELECT sid, status, branch FROM sessions WHERE status='running'"
sqlite3 "$DB" "SELECT skill, COUNT(*) FROM skill_invocation GROUP BY skill ORDER BY 2 DESC LIMIT 10"
```

Or run `/ork:telemetry-inspect` for a health summary. See also
[`docs/observability.md`](./observability.md) for the metrics view and
[`docs/parallel-primitives.md`](./parallel-primitives.md) for the agent-spawn
primitives that ride on this layer.
