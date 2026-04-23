# OrchestKit Telemetry File Inventory

Single source of truth listing every known file that OrchestKit hooks write to. The `telemetry-inspect` skill reads this inventory to distinguish "expected" files from orphans.

Last updated: 2026-04-23 (M121 #1491)

## Schema-locked files (7) — validators in `src/hooks/src/lib/telemetry-schemas.ts`

| Path | Writer | Readers | Schema |
|------|--------|---------|--------|
| `.claude/telemetry/image-responses.jsonl` | `posttool/context-crossing-warn` | #1479 cache-aware nudge (future) | `isValidImageResponseEntry` |
| `.claude/telemetry/pre-compact-decisions.jsonl` | `lifecycle/pre-compact-task-done-prompt` | #1476 outcome tracker (future) | `isValidPreCompactDecisionEntry` |
| `.claude/logs/decisions.jsonl` | multiple hooks | `handoff-writer`, `decision-history`, `/ork:analytics` | `isValidDecisionLogEntry` |
| `.claude/logs/subagent-spawns.jsonl` | subagent-start hooks | `pre-compact-guard`, `watchdog`, `pre-compact-task-done-prompt` | `isValidSubagentSpawnEntry` |
| `.claude/state/edit-history.jsonl` | `posttool/write/edit-history-tracker` | `edit-history-tracker`, `decision-history` | `isValidEditHistoryEntry` |
| `.claude/state/ork-metrics-*.json` | `posttool/metrics-bridge` | `lifecycle/session-metrics-summary` | `isValidOrkMetricsSnapshot` |
| `.claude/feedback/skill-usage.json` | `posttool/skill/skill-usage-optimizer` | `skill-usage-optimizer` | `isValidSkillUsageFile` |

## Unlocked telemetry files (14) — no schema validator yet

### `.claude/feedback/` (8)

| Path | Writer |
|------|--------|
| `.claude/feedback/changelog-decisions.json` | changelog-related hook |
| `.claude/feedback/code-style-profile.json` | `posttool/write/code-style-learner` |
| `.claude/feedback/consent-log.json` | `lifecycle/analytics-consent-check` |
| `.claude/feedback/consent-status.json` | `lifecycle/analytics-consent-check` |
| `.claude/feedback/dependency-check-cache.json` | `lifecycle/dependency-version-check` |
| `.claude/feedback/learned-patterns.json` | pattern sync |
| `.claude/feedback/naming-conventions.json` | `posttool/write/naming-convention-learner` |
| `.claude/feedback/patterns-queue.json` | pattern sync |
| `.claude/feedback/permission-denials.jsonl` | permission hooks |
| `.claude/feedback/sync-config.json` | pattern sync |

### `.claude/logs/` (3)

| Path | Writer |
|------|--------|
| `.claude/logs/agent-state.json` | agent state persistence |
| `.claude/logs/config-audit.jsonl` | `posttool/config-change/security-auditor` |
| `.claude/logs/config-changes.jsonl` | `config-change/settings-reload` |

### `.claude/state/` (2)

| Path | Writer |
|------|--------|
| `.claude/state/last-test-run.json` | test-aware hooks |
| `.claude/state/recent-deletes.json` | delete-tracking hook |

## Directory health budgets

| Directory | Target max total size | Action if exceeded |
|-----------|----------------------|-------------------|
| `.claude/telemetry/` | 5 MB | rotate oldest JSONL lines |
| `.claude/logs/` | 10 MB | archive to `.claude/logs/archive/` |
| `.claude/state/` | 2 MB | truncate; state is ephemeral |
| `.claude/feedback/` | 5 MB | consolidate patterns |

## How to add a new telemetry file

1. Add the writer (hook) that produces it
2. Add an entry to the appropriate section above
3. If the file has a stable shape, add a validator to `lib/telemetry-schemas.ts` + promote to Schema-locked table
4. Update the `SCHEMA_LOCKED` array export
5. Add tests to `__tests__/lib/telemetry-schemas.test.ts`
