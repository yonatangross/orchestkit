# OrchestKit Telemetry File Inventory

Single source of truth listing every file that OrchestKit hooks write to. The `telemetry-inspect` skill reads this inventory to distinguish "expected" files from orphans.

Last updated: 2026-07-09 (live writer census)

## Path routing helpers

Writers do not hard-code directories — they go through four helpers. Know these to attribute any file:

| Helper | Source | Target directory |
|--------|--------|------------------|
| `writeTelemetryEvent()` | `lib/telemetry-jsonl.ts` | `.claude/telemetry/` (or plugin-data/telemetry on CC ≥ 2.1.78) |
| `appendEventLog(file, entry)` | `lib/event-logger.ts:17` | `<project>/.claude/logs/` |
| `appendAnalytics(file, entry)` | `lib/analytics.ts:55` | `getAnalyticsDir()` = `.claude/memory/analytics/` (NOT `.claude/logs/`) |
| `logHook()` / `logPermissionFeedback()` | `lib/log.ts:51,75` | `getLogDir()` = `.claude/logs/` |

Note: `appendAnalytics` writes its own filename set (`task-usage.jsonl`, `team-activity.jsonl`, `agent-usage.jsonl`, `subagent-quality.jsonl`, `session-summary.jsonl`) into the analytics dir — distinct from the `.claude/logs/` files below, and dual-writes to the yonatan-hq platform sink via `postAnalyticsToSink`.

## Schema-locked files (7) — validators in `lib/telemetry-schemas.ts` (`SCHEMA_LOCKED`)

| Path | Writer (hook) | Schema validator |
|------|--------------|------------------|
| `.claude/telemetry/image-responses.jsonl` | `posttool/context-crossing-warn` | `isValidImageResponseEntry` |
| `.claude/telemetry/pre-compact-decisions.jsonl` | `lifecycle/pre-compact-task-done-prompt` | `isValidPreCompactDecisionEntry` |
| `.claude/logs/decisions.jsonl` | **none — producer never built** (schema shipped in M121 `d5ea63562` without a writer; `lifecycle/pre-compact-saver`, `stop/handoff-writer`, `prompt/context-exhaustion-warner` are READERS that degrade gracefully on absence) | `isValidDecisionLogEntry` |
| `.claude/logs/subagent-spawns.jsonl` | `pretool/task/spawn-intent-logger`, `subagent-start/subagent-validator` | `isValidSubagentSpawnEntry` |
| `.claude/state/edit-history.jsonl` | `posttool/write/edit-history-tracker` | `isValidEditHistoryEntry` |
| `.claude/state/ork-metrics-*.json` | `posttool/metrics-bridge` | `isValidOrkMetricsSnapshot` |
| `.claude/logs/skill-channels.jsonl` | `pretool/skill/skill-tracker` (main channel — dispatch restored 2026-07-09 after the #959 drop), `subagent-stop/skill-channel-tracker` (subagent channel) | `isValidSkillChannelEntry` |

> `image-responses.jsonl` and `skill-channels.jsonl` are schema-locked but may be absent on disk for a given project — they are written only when their trigger fires (image bytes in a tool result; a Skill invocation). Absence is not an orphan.
>
> **Known gap:** `decisions.jsonl` is schema-locked with NO producer — the M121 observability consolidation shipped its schema, lock, and three readers, but the writer was never built. Absence is guaranteed, not conditional. Follow-up: build the producer or drop the lock.
>
> **Delisted 2026-07-09:** `.claude/feedback/skill-usage.json` was removed from `SCHEMA_LOCKED` — its writer has been unwired since 2026-03-06 (see Deprecated section). The validator / canonical / interface are retained for back-compat shape-checking of the frozen file, but the path is no longer schema-locked, so `telemetry-inspect` now correctly flags it as an orphan rather than an expected writer.

## Live unlocked writers — no schema validator yet

### `.claude/telemetry/`

| Path | Writer |
|------|--------|
| `.claude/telemetry/events.jsonl` | `lib/telemetry-jsonl` (`writeTelemetryEvent`, via `lib/jsonl-sink`) |

### `.claude/logs/`

| Path | Writer |
|------|--------|
| `.claude/logs/task-completions.jsonl` | `task-completed/completion-tracker` (`appendEventLog`) |
| `.claude/logs/task-creations.jsonl` | `task-created/creation-tracker` (`appendEventLog`) |
| `.claude/logs/memory-consult.jsonl` | `pretool/mcp/memory-validator` (`appendEventLog`) |
| `.claude/logs/teammate-activity.jsonl` | `posttool/task/team-member-start`, `teammate-idle/progress-reporter` (`appendEventLog`) |
| `.claude/logs/worktree-events.jsonl` | `worktree/exit-finalizer` (`appendEventLog`) |
| `.claude/logs/config-changes.jsonl` | `config-change/settings-reload` |
| `.claude/logs/config-audit.jsonl` | `posttool/config-change/security-auditor` |
| `.claude/logs/context7-telemetry.log` | `pretool/mcp/context7-tracker` |
| `.claude/logs/hooks.log` | `lib/log.ts` (`logHook`, all hooks) |
| `.claude/logs/permission-feedback.log` | `lib/log.ts` (`logPermissionFeedback`) |
| `.claude/logs/permission-denials.jsonl` | `permission-denied/denial-logger`, `permission-denied/denial-notification` |
| `.claude/logs/audit.log` | `posttool/audit-logger`, `lifecycle/session-cleanup`, `agent/security-command-audit` |
| `.claude/logs/agent-state.json` | `subagent-start/context-gate` |

### `.claude/state/`

| Path | Writer |
|------|--------|
| `.claude/state/goal-history.jsonl` | `lifecycle/goal-budget-guard`, `prompt/goal-tracker` |
| `.claude/state/goal-budget-tripped.json` | `lifecycle/goal-budget-guard`, `prompt/goal-tracker` |
| `.claude/state/last-test-run.json` | `pretool/bash/pre-commit-test-gate` |
| `.claude/state/plugins-snapshot.json` | `lifecycle/plugins-drift-snapshot`, `posttool/check-plugins-drift` |
| `.claude/state/dev-stack.json` | `lib/dev-stack-state` |
| `.claude/state/expect-auto-fires.json` | `posttool/ui-change-detector` |
| `.claude/state/expect-snapshots/` | `posttool/expect/snapshot-recorder` |
| `.claude/state/worktree-advisory-*.md` | `lib/worktree-advisory` (consumed by `prompt/worktree-advisory-consumer`) |
| `.claude/state/session-*-token-accum.json` | session token-accumulator hook |

### `.claude/feedback/`

| Path | Writer |
|------|--------|
| `.claude/feedback/code-style-profile.json` | `posttool/write/code-style-learner` |
| `.claude/feedback/naming-conventions.json` | `posttool/write/naming-convention-learner` |
| `.claude/feedback/tool-preferences.json` | `posttool/tool-preference-learner` |
| `.claude/feedback/learned-patterns.json` | `lifecycle/pattern-sync-push`, `lifecycle/pattern-sync-pull`, `permission/learning-tracker` |
| `.claude/feedback/patterns-queue.json` | `posttool/bash/pattern-extractor` |
| `.claude/feedback/consent-log.json` | `lifecycle/analytics-consent-check` |
| `.claude/feedback/dependency-check-cache.json` | `lifecycle/dependency-version-check` |
| `.claude/feedback/changelog-decisions.json` | `lib/decision-history` |
| `.claude/feedback/instruction-drift-cache.json` | `instructions-loaded/drift-detection` |

## Deprecated / orphaned files (writer removed or unwired — flag as orphans, do not re-create)

These files exist on disk from historical runs but have no reachable writer at HEAD. All froze on the dates shown.

| Path | Last write | Root cause |
|------|-----------|-----------|
| `.claude/feedback/skill-usage.json` | 2026-03-06 | Writer `posttool/skill/skill-usage-optimizer` unwired by commit `e3e99b2ff` (#959, "PostToolUse: 17→3 sub-hooks"). Function + dispatch-map entry survive but no `hooks.json` entry invokes the key → unreachable. Superseded by M168 (#2015) `skill_invocation` SQLite table. **Delisted from SCHEMA_LOCKED 2026-07-09.** |
| `.claude/logs/skill-usage.log` | ~~2026-03-06~~ **revived 2026-07-09** | Writer `pretool/skill/skill-tracker` was unwired in the same #959 prune, but unlike the optimizer it is NOT superseded — it is the sole feeder of the M168 `skill_invocation` SQLite table (`recordInvocation`) and of `skill-channels.jsonl` main (#2154). Dispatch restored in hooks.json; live again. |
| `.claude/logs/skill-analytics.jsonl` | 2026-03-03 | No current writer; last source touch was M168 (#2015), which moved skill usage to the SQLite `skill_invocation` table. |
| `.claude/logs/memory-metrics.jsonl` | 2026-03-03 | Referenced in `lifecycle/unified-dispatcher`; not currently emitting. Verify before re-wiring. |
| `.claude/logs/agent-patterns.jsonl` | 2026-02-12 | No writer source file has ever existed — pure disk orphan. |
| `.claude/logs/background-hooks.log` | 2026-02-08 | No writer source file has ever existed — pure disk orphan. |
| `.claude/feedback/satisfaction.json` / `satisfaction.log` | 2026-01-23 / 2026-03-06 | Writer source removed in #959. |
| `.claude/feedback/workflow-patterns.json` | 2026-03-06 | No writer in source — pure orphan. |
| `.claude/feedback/calibration-data.json` | 2026-03-06 | No writer in source — pure orphan. |
| `.claude/feedback/evolution-registry.json` | 2026-01-22 | No writer in source — pure orphan. |

## Directory health budgets

| Directory | Target max total size | Action if exceeded |
|-----------|----------------------|-------------------|
| `.claude/telemetry/` | 5 MB | rotate oldest JSONL lines (`rotateTelemetryIfNeeded`) |
| `.claude/logs/` | 10 MB | archive `*.old.*` to `.claude/logs/archive/` |
| `.claude/state/` | 2 MB | truncate; state is ephemeral |
| `.claude/feedback/` | 5 MB | consolidate patterns |

## How to add a new telemetry file

1. Add the writer (hook) that produces it — route through `appendEventLog` (`.claude/logs/`) or `writeTelemetryEvent` (`.claude/telemetry/`).
2. Add an entry to the appropriate section above.
3. If the file has a stable shape, add a validator to `lib/telemetry-schemas.ts`, append to the `SCHEMA_LOCKED` array (currently 7), and promote it to the Schema-locked table.
4. Add tests to `__tests__/lib/telemetry-schemas.test.ts` (including the `SCHEMA_LOCKED.length` count assertion).

## How to retire a telemetry file

1. Remove or unwire the writer.
2. Remove its `SCHEMA_LOCKED` entry (and update the length assertion in the test) so `telemetry-inspect` reports the leftover file as an orphan instead of an expected writer.
3. Move it to the Deprecated section above with the removal commit + date.
