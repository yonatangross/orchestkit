# Observability

How to see what OrchestKit's coordination layer is doing. For the full design see
[`docs/coordination-architecture.md`](./coordination-architecture.md).

## Coordination metrics (M168 Phase 5, #1915)

`lib/metrics-emitter` emits async, fire-and-forget counters for every write to
the SQLite coordination DB (`sessions.db`). It is wired into the single write
chokepoint, `writeWithRetry()` in `lib/session-registry.ts`.

| Property | Value |
|----------|-------|
| Metric | `sessions_db_write` (count of committed `sessions.db` writes) |
| Sink | `~/.local/state/orchestkit/coordination-metrics.jsonl` |
| Line shape | `{"ts": ISO8601, "metric": string, "count": number}` |
| Emit model | sync O(1) counter bump → single `setImmediate` flush → async `appendFile` |
| Hot-path cost | none — the disk write is deferred off the hook path |
| Failure mode | drop the counter + one stderr line; never throws, never blocks |
| Opt-out | `ORK_DISABLE_COORDINATION_METRICS=1` |

**Design intent:** coordination correctness must never depend on telemetry
landing. Counters are best-effort; a slow or full disk degrades to a dropped
sample, not a stalled hook. There is **no background process** — the short-lived
hook process stays alive via the Node event loop until the `setImmediate` flush
fires (same model as `lib/telemetry-jsonl`).

## Inspecting

`/ork:telemetry-inspect` surfaces the coordination layer:

- **live counts** (SELECT against `sessions.db`): running sessions, held locks,
  pending worktree links, skill invocations;
- **write throughput** (from `coordination-metrics.jsonl`): recent
  `sessions_db_write` rate.

Manual:

```bash
M="$HOME/.local/state/orchestkit/coordination-metrics.jsonl"
[ -f "$M" ] && tail -200 "$M" | grep -c '"sessions_db_write"'   # recent write count
```

If the file or `sqlite3` is missing, the layer is simply **idle** (no
multi-session activity yet) — not an error.

## Other telemetry

The per-project telemetry pipeline (`.claude/telemetry/`, `.claude/logs/`,
`.claude/state/`) is documented by the `/ork:telemetry-inspect` skill itself and
`lib/telemetry-schemas.ts` (schema-locked files). Upstream Claude Code OTel
metrics (`claude_code.*`) are out of scope here.
