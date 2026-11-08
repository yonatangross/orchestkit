# OrchestKit State Machines and Invariants Audit

This document catalogs the explicit and implicit state machines in OrchestKit, their state spaces, invariants, and transition tables, followed by confirmed reachable invalid states and transitions (with code and runtime evidence), suspected edge cases, and Pass 2 unenforced invariants.

## 1. Architectural Context

OrchestKit hooks run as short-lived Node.js subprocesses invoked by Claude Code via `src/hooks/bin/run-hook.mjs`. Because no in-memory state survives between hook invocations (except when daemon mode is opted into via `ORK_DAEMON=1`), state machines span multiple hook processes and persist state across four storage tiers:

1. **SQLite WAL database** (`~/.local/state/orchestkit/sessions.db`): cross-session registry and heartbeat tracking.
2. **Project state and orchestration files** (`.claude/state/*.json`, `.claude/state/*.jsonl`, `.claude/orchestration/*.json`): goal tracking, token accumulation, nudge markers, subagent orchestration, and task registries.
3. **Plugin/session storage** (`${CLAUDE_PLUGIN_DATA}/sessions/` or `.claude/memory/sessions/`): turn counters, once-per-session flags, handoff claims, and session title latches.
4. **System temp and user cache directories** (`/tmp/claude-session-*`, `${CLAUDE_PLUGIN_DATA}/cache/`): heartbeat snapshots, dev stack PIDs, and debt ledgers.

## 2. Explicit and Implicit State Machines

### SM-1: SQLite Session Registry (`sessions.db`)

* **Files**: `src/hooks/src/lib/session-registry.ts`, `src/hooks/src/lifecycle/session-registrar.ts`, `src/hooks/src/posttool/heartbeat.ts`, `src/hooks/src/lifecycle/session-finalizer.ts`, `src/hooks/src/lib/sqlite-migrations/001-initial-sessions.ts`
* **State space**: `status` column in `sessions` table with SQLite `CHECK (status IN ('running', 'completed', 'crashed'))`, paired with nullable `ended_at` (epoch ms) and `last_heartbeat` (epoch ms).
* **Invariants**:
  1. `status = 'running'` implies `ended_at IS NULL`.
  2. `status = 'completed'` implies `ended_at IS NOT NULL` and `last_heartbeat <= ended_at`.
  3. `status = 'crashed'` implies the session exceeded the 24-hour staleness threshold without a clean `SessionEnd`, so `ended_at IS NULL`.

<table>
<thead>
<tr><th>From State</th><th>Event / Hook</th><th>Guard</th><th>To State</th><th>Side Effects</th></tr>
</thead>
<tbody>
<tr><td>(none)</td><td>SessionStart (`session-registrar.ts:224`)</td><td>Valid `sid` and `cwd`</td><td><code>running</code></td><td>Inserts row with <code>started_at = now</code>, <code>last_heartbeat = now</code>, <code>ended_at = NULL</code></td></tr>
<tr><td><code>running</code> / <code>completed</code> / <code>crashed</code></td><td>SessionStart (`session-registrar.ts:227`)</td><td><code>ON CONFLICT(sid) DO UPDATE</code></td><td><code>running</code></td><td>Updates <code>last_heartbeat = now</code>, refreshes metadata, resets <code>ended_at = NULL</code></td></tr>
<tr><td><code>running</code></td><td>SessionStart sweep (`session-registrar.ts:198`)</td><td><code>last_heartbeat &lt; now - 86400000</code></td><td><code>crashed</code></td><td>Marks stale running sessions as crashed</td></tr>
<tr><td><code>running</code> / <code>crashed</code></td><td>PostToolUse (`posttool/heartbeat.ts:46`)</td><td>Throttled to once per 30s per <code>sid</code>; <code>status != 'completed'</code></td><td><code>running</code></td><td>Updates <code>last_heartbeat = now</code>; recovers <code>crashed</code> (when <code>ended_at IS NULL</code>) to <code>running</code></td></tr>
<tr><td><code>running</code></td><td>SessionEnd (`session-finalizer.ts:34`)</td><td><code>status = 'running'</code></td><td><code>completed</code></td><td>Sets <code>status = 'completed'</code>, <code>ended_at = now</code></td></tr>
</tbody>
</table>

### SM-2: Orchestration State and Dispatched Agent Retry Machine

* **Files**: `src/hooks/src/lib/orchestration-types.ts`, `src/hooks/src/lib/orchestration-state.ts`, `src/hooks/src/lib/retry-manager.ts`, `src/hooks/src/subagent-stop/retry-handler.ts`, `src/hooks/src/subagent-stop/feedback-loop.ts`
* **State space**:
  * `OrchestrationState.phase`: `'idle' | 'exploring' | 'implementing' | 'testing' | 'reviewing' | 'completed'`
  * `DispatchedAgent.status`: `'pending' | 'running' | 'completed' | 'failed' | 'retrying'` with integer `retryCount` (`0 <= retryCount <= maxRetries`, where `maxRetries = 3`).
* **Invariants**:
  1. Each failed attempt that triggers a retry decision transitions `DispatchedAgent.status` to `'retrying'` and increments `retryCount` by 1 in `.claude/orchestration/state-${sessionId}.json`.
  2. Once `retryCount >= maxRetries` (or failure category is `'non_retryable'`), `makeRetryDecision` returns `shouldRetry: false` and stops recommending retries.
  3. Agent names in `activeAgents` and `ALTERNATIVE_AGENTS` use canonical bare identifiers (normalized without the `ork:` namespace prefix).

<table>
<thead>
<tr><th>From State</th><th>Event / Function</th><th>Guard</th><th>To State</th><th>Side Effects</th></tr>
</thead>
<tbody>
<tr><td>(none)</td><td><code>trackDispatchedAgent</code> (`orchestration-state.ts:118`)</td><td>Agent dispatched</td><td><code>running</code> (<code>retryCount: 0</code>)</td><td>Appends or replaces entry in <code>activeAgents</code></td></tr>
<tr><td><code>running</code> / <code>retrying</code> / (none)</td><td>SubagentStop failure (`retry-handler.ts:187`)</td><td><code>decision.shouldRetry === true</code></td><td><code>retrying</code> (<code>retryCount + 1</code>)</td><td>Upserts entry in <code>activeAgents</code>, increments <code>retryCount</code></td></tr>
<tr><td><code>running</code> / <code>retrying</code> / (none)</td><td>SubagentStop failure (`retry-handler.ts:187`)</td><td><code>decision.shouldRetry === false</code></td><td><code>failed</code></td><td>Records terminal failure in <code>activeAgents</code></td></tr>
<tr><td><code>running</code> / <code>retrying</code></td><td>SubagentStop (`feedback-loop.ts:261`)</td><td>Outcome is <code>success</code> or <code>partial</code></td><td><code>completed</code></td><td>Updates <code>activeAgents</code> status</td></tr>
</tbody>
</table>

### SM-3: Task Registry and Pipeline Dependency Cascade

* **Files**: `src/hooks/src/lib/task-integration.ts`, `src/hooks/src/posttool/task/agent-task-auto-register.ts`, `src/hooks/src/subagent-stop/feedback-loop.ts`, `src/hooks/src/stop/task-completion-check.ts`
* **State space**: `TaskRegistryEntry.status`: `'pending' | 'in_progress' | 'completed' | 'failed' | 'orphaned'` in `.claude/orchestration/task-registry-${sessionId}.json`.
* **Invariants**:
  1. Every task registered by `agent-task-auto-register` (`posttool/task/agent-task-auto-register.ts`) can be looked up by `getTaskByAgent` (`lib/task-integration.ts`) when `subagent-stop/feedback-loop.ts` runs.
  2. When a task transitions to `'completed'`, downstream tasks whose `blockedBy` entries are all `'completed'` become unblocked.
  3. When a task transitions to `'failed'`, downstream tasks whose `blockedBy` entries have all `'failed'` transition to `'orphaned'`.

<table>
<thead>
<tr><th>From State</th><th>Event / Hook</th><th>Guard</th><th>To State</th><th>Side Effects</th></tr>
</thead>
<tbody>
<tr><td>(none)</td><td>PostToolUse Agent (`agent-task-auto-register.ts:88`)</td><td><code>subagent_type</code> present, not already registered</td><td><code>pending</code></td><td>Writes normalized <code>agent</code> entry to <code>task-registry-${sessionId}.json</code></td></tr>
<tr><td><code>pending</code> / <code>in_progress</code></td><td>SubagentStop (`feedback-loop.ts:264`)</td><td>Outcome is <code>success</code> or <code>partial</code></td><td><code>completed</code></td><td>Calls <code>completeTaskAndUnblock</code></td></tr>
<tr><td><code>pending</code> / <code>in_progress</code></td><td>SubagentStop (`feedback-loop.ts:285`)</td><td>Outcome is <code>failed</code></td><td><code>failed</code></td><td>Calls <code>failTaskAndCascade</code>; marks dependents with all blockers failed as <code>orphaned</code></td></tr>
</tbody>
</table>

### SM-4: Goal Tracker, Turn Counter, and Token Accumulator

* **Files**: `src/hooks/src/prompt/goal-tracker.ts`, `src/hooks/src/stop/goal-tracker.ts`, `src/hooks/src/lifecycle/goal-budget-guard.ts`, `src/hooks/src/lib/session-turn-counter.ts`, `src/hooks/src/prompt/cache-break-detector.ts`, `src/hooks/src/lib/session-token-accum.ts`, `src/hooks/src/posttool/context-crossing-warn.ts`
* **State space**:
  * Active goal file `.claude/state/active-goal.json` (absent = inactive; present with `session_id` = active; removed on exit reason `'completed' | 'max_turns' | 'circuit_broken' | 'timeout' | 'superseded'`).
  * Turn state file `${sessionStorageDir}/${sessionId}-cache-break.state` (`turnCount >= 1`).
  * Token accumulator `.claude/state/session-${sessionId}-token-accum.json` (`accumulated_tokens >= 0`, `crossed_thresholds` subset of `[60000, 120000, 180000]`).
* **Invariants**:
  1. Writers and readers of `session-${sessionId}-token-accum.json` resolve `sessionId` identically (`input.session_id || ctx.sessionId || getSessionId()`), so `started_tokens` and `computeRunTokens()` measure the same file that `posttool/context-crossing-warn.ts` updates.
  2. Every `UserPromptSubmit` with a valid `session_id` increments `turnCount` in `${sessionId}-cache-break.state`, regardless of prompt length.
  3. When `turnsElapsed >= max_turns` or `elapsedMs >= max_duration_ms` or `allAssertionsPassed`, `stop/goal-tracker.ts` archives the goal to `goal-history.jsonl` and unlinks `active-goal.json`.

<table>
<thead>
<tr><th>From State</th><th>Event / Hook</th><th>Guard</th><th>To State</th><th>Side Effects</th></tr>
</thead>
<tbody>
<tr><td>Inactive</td><td>UserPromptSubmit (`prompt/goal-tracker.ts:95`)</td><td>Prompt starts with <code>/goal</code></td><td>Active</td><td>Writes <code>active-goal.json</code> with <code>started_turn</code> and <code>started_tokens</code></td></tr>
<tr><td>Active</td><td>UserPromptSubmit (`prompt/goal-tracker.ts:95`)</td><td>New <code>/goal</code> prompt</td><td>Active (new)</td><td>Archives prior goal with <code>exit_reason: 'superseded'</code>, writes new <code>active-goal.json</code></td></tr>
<tr><td>Active</td><td>Stop (`stop/goal-tracker.ts:138`)</td><td><code>goal.session_id === sessionId</code> and assertions pass / max_turns / timeout</td><td>Archived (<code>completed</code> / <code>max_turns</code> / <code>timeout</code>)</td><td>Appends to <code>goal-history.jsonl</code>, unlinks <code>active-goal.json</code></td></tr>
<tr><td>Active</td><td>SessionEnd (`lifecycle/goal-budget-guard.ts:44`)</td><td><code>goal.session_id === sessionId</code> and budget exceeded</td><td>Archived (<code>circuit_broken</code>)</td><td>Appends to <code>goal-history.jsonl</code>, unlinks <code>active-goal.json</code></td></tr>
</tbody>
</table>

### SM-5: PreCompact Nudge Outcome and Compaction Recovery

* **Files**: `src/hooks/src/lib/nudge-outcome-state.ts`, `src/hooks/src/lifecycle/pre-compact-task-done-prompt.ts`, `src/hooks/src/lifecycle/post-compact-recovery.ts`, `src/hooks/src/lifecycle/nudge-outcome-resolver.ts`, `src/hooks/src/lifecycle/pre-compact-saver.ts`
* **State space**:
  * Marker file `.claude/state/nudge-outcome-${sessionId}.json` (present = pending resolution; unlinked after appending `user_action: 'compact' | 'clear' | 'ignore'` to `.claude/logs/pre-compact-nudge-outcomes.jsonl`).
  * Cooldown file `.claude/state/compact-done-nudge-${sessionId}.json` (`lastSuggestedAt` epoch ms).
  * Snapshot file `.claude/state/pre-compact-snapshot-${sessionId}.json` (written at `PreCompact`, consumed and unlinked at `PostCompact`).
* **Invariants**:
  1. All PreCompact, PostCompact, and SessionStart hooks resolve `sessionId` from `input.session_id || ctx.sessionId || getSessionId()` so each Claude Code session has a distinct marker key.
  2. If the user continues with compaction in the same session, `post-compact-recovery` resolves `nudge-outcome-${sessionId}.json` as `user_action: 'compact'` and deletes the marker.
  3. If the user runs `/clear` (starting a new `input.session_id`), `nudge-outcome-resolver` at `SessionStart` detects the prior session's marker as foreign (`sid !== currentSessionId`) and resolves it as `'clear'` (if `< 24h` old) or `'ignore'` (if `>= 24h` old).

<table>
<thead>
<tr><th>From State</th><th>Event / Hook</th><th>Guard</th><th>To State</th><th>Side Effects</th></tr>
</thead>
<tbody>
<tr><td>No Marker</td><td>PreCompact (`pre-compact-task-done-prompt.ts:249`)</td><td>Completion signal detected and cooldown elapsed</td><td>Marker Pending</td><td>Writes <code>nudge-outcome-${sessionId}.json</code> and cooldown file</td></tr>
<tr><td>Marker Pending</td><td>PostCompact (`post-compact-recovery.ts:91`)</td><td>Same <code>sessionId</code></td><td>Resolved (<code>compact</code>)</td><td>Appends outcome to JSONL, unlinks marker</td></tr>
<tr><td>Marker Pending</td><td>SessionStart (`nudge-outcome-resolver.ts:37`)</td><td>Foreign <code>sid !== sessionId</code> and age &lt; 24h</td><td>Resolved (<code>clear</code>)</td><td>Appends outcome to JSONL, unlinks marker</td></tr>
<tr><td>Marker Pending</td><td>SessionStart (`nudge-outcome-resolver.ts:37`)</td><td>Foreign <code>sid !== sessionId</code> and age &gt;= 24h</td><td>Resolved (<code>ignore</code>)</td><td>Appends outcome to JSONL, unlinks marker</td></tr>
</tbody>
</table>

### SM-6: Session Heartbeat and Sibling Awareness (`/tmp/claude-session-${sid}/state.json`)

* **Files**: `src/hooks/src/lib/session-state.ts`, `src/hooks/src/posttool/bash/session-heartbeat-publisher.ts`, `src/hooks/src/stop/session-heartbeat-finalizer.ts`
* **State space**: `SessionStateSnapshot.status`: `'active' | 'idle' | 'stopped'`.
* **Invariants**:
  1. `session-heartbeat-publisher` writes `status: 'active'` (debounced to 15s unless branch or task changed).
  2. `session-heartbeat-finalizer` transitions `status` from `'active'` to `'stopped'` on `Stop` without resetting `started_at`.
  3. `readSiblingSessions` classifies snapshots older than 10 minutes as stale (unless `status === 'stopped'`).

### SM-7: Handoff Save/Restore and Exclusive Claim Machine

* **Files**: `src/hooks/src/lib/handoff-claim.ts`, `src/hooks/src/stop/handoff-writer.ts`, `src/hooks/src/lifecycle/session-handoff-generator.ts`, `src/hooks/src/lifecycle/session-handoff-injector.ts`, `src/hooks/src/prompt/handoff-injector.ts`, `src/hooks/src/prompt/unified-dispatcher.ts`
* **State space**:
  * Repo-local file `.claude/HANDOFF.md` -> `.claude/HANDOFF.md.consumed`.
  * Global file `~/.claude/analytics/handoffs/${projectHash}/latest.yaml`.
  * Exclusive session claim `${sessionStorageDir}/${sessionId}/once-flags/handoff-injected.claim` (created with `wx`).
* **Invariants**:
  1. At most one handoff injection occurs per session across both `SessionStart` (`session-handoff-injector`) and `UserPromptSubmit` (`prompt/handoff-injector`), enforced by `claimHandoffInjection` (`wx` file creation).
  2. When a fresh `.claude/HANDOFF.md` exists, `session-handoff-injector` yields at `SessionStart` so `prompt/handoff-injector` injects and renames it to `.claude/HANDOFF.md.consumed`.

### SM-8: Session Identity and Sticky Rename Latch

* **Files**: `src/hooks/src/lib/session-identity-state.ts`, `src/hooks/src/prompt/unified-dispatcher.ts`
* **State space**:
  * `identity.json` (`phase: 'pending' | 'ready'`, `topic`, `color`, `pid`).
  * `last-session-title.txt`, `session-branch.txt`, and `user-renamed.flag` in `${promptSessionDir}`.
* **Invariants**:
  1. Once `userRenamedTitle` detects a manual `/rename` in the transcript tail, `user-renamed.flag` is written and latches title emission off for the remainder of the session.
  2. `identity.json` transitions from `phase: 'pending'` to `phase: 'ready'` via detached Haiku worker or times out after `PENDING_STALE_MS` (30s) and re-spawns.

### SM-9: Numbered Task Progress Bar

* **Files**: `src/hooks/src/task-created/task-progress-initializer.ts`, `src/hooks/src/task-completed/task-progress-tracker.ts`
* **State space**: `ProgressState` (`total`, `completed`, `task_ids`, `session_id`) in `task-progress-state.json`.
* **Invariants**:
  1. `0 <= completed <= total` when `total >= 2`, and `completed === task_ids.length`.
  2. Starting a new `[1/N]` numbered task batch resets `completed` to `0` and `task_ids` to `[]` with `total = N`.
  3. Completing a task on `TaskCompleted` records `taskId` once in `task_ids` whether `input.task_status` is explicitly `'completed'` or omitted (defaulting to `'completed'`).

### SM-10: Multi-Step Task Nudge and Stop Usage Telemetry

* **Files**: `src/hooks/src/prompt/multi-step-task-nudge.ts`, `src/hooks/src/lib/task-usage-signal.ts`, `src/hooks/src/stop/task-completion-check.ts`
* **State space**:
  * Prompt counter `${sessionStorageDir}/${safeSid}-task-nudge.count` (`0 -> 1 -> 2 -> 3 ...`).
  * Stop telemetry state `${sessionStorageDir}/${safeSid}-task-outcome.state` (`'' -> 'false' -> 'true'` or `'' -> 'true'`).
* **Invariants**:
  1. `${safeSid}-task-outcome.state` is monotonic: once `'true'` is written, no further `session_task_usage` events are appended for that session (`prev !== now && prev !== 'true'`).
  2. Non-explicit multi-step nudges fire at ordinal 1 (`mode: 'full'`), throttle until `DOWNGRADE_AFTER` (default 3, `mode: 'final'`), and stay silent for `n > DOWNGRADE_AFTER`.

### SM-11: PID File Lock and Deferred Debt Ledger

* **Files**: `src/hooks/src/lib/pidlock.ts`, `src/hooks/src/lib/debt-ledger.ts`
* **State space**:
  * Lockfile `${path}.lock`: absent -> created (`wx`) -> populated with holder PID -> released (`unlinkSync`) or reclaimed when stale/dead.
  * Debt ledger `debt-ledger.json`: `LedgerSource` (`'cache' | 'scan' | 'stale' | 'locked' | 'error'`).
* **Invariants**:
  1. While a lock holder is actively creating and writing its PID to `${path}.lock`, a concurrent contender hitting `EEXIST` must not unlink the newly created lockfile before the holder's PID write completes.
  2. Incremental updates in `updateLedgerForFile(projectDir, filePath, text)` only mutate a cached ledger whose `head` matches `resolveHead(projectDir) ?? 'no-git'`.

## 3. Confirmed Invalid States and Transitions (Prioritized by Impact)

### Confirmed Bug Group 1: Session ID Split-Brain and Turn-Counter Skip (High Impact)

1. **Token Accumulator vs Goal Tracker Split-Brain (`src/hooks/src/posttool/context-crossing-warn.ts:192` vs `src/hooks/src/prompt/goal-tracker.ts:98,133` and `src/hooks/src/stop/goal-tracker.ts:139,173`)**:
   * **Mechanism**: Claude Code supplies `session_id` (a UUID) in the hook stdin JSON payload (`input.session_id`) and does not set `CLAUDE_SESSION_ID` in the environment (`src/hooks/bin/run-hook.mjs:611-620`). `run-hook.mjs:789` calls `buildContext()` with no arguments, setting `ctx.sessionId = getSessionId()`, which generates/caches a smart ID in `.instance/session-id.json` (e.g. `orchestkit-main-1107-0906-59ba`) with a 24-hour TTL. `posttool/context-crossing-warn.ts:192` computes `const sessionId = ctx.sessionId || getSessionId();` (ignoring `input.session_id`) and writes `.claude/state/session-${smartId}-token-accum.json`. Meanwhile, `prompt/goal-tracker.ts` and `stop/goal-tracker.ts` compute `const sessionId = input.session_id || ctx.sessionId || 'unknown';` (the UUID) and call `loadAccumStateOrNull(projectDir, sessionId)`.
   * **Evidence**: Live inspection of `.claude/state/` shows 29 `session-*-token-accum.json` files, 100% keyed by smart ID and 0 keyed by UUID, while `.claude/state/goal-history.jsonl` entries are keyed by UUID with `started_tokens: 0`. As a result, `computeRunTokens()` in `stop/goal-tracker.ts:118-133` always gets `currentTokens = null` and falls back to prompt/message character estimates, blinding `lifecycle/goal-budget-guard.ts` to tool-output token spend.
2. **PreCompact Nudge Outcome Split-Brain Across `/clear` (`src/hooks/src/lifecycle/pre-compact-task-done-prompt.ts:166,249`, `src/hooks/src/lifecycle/nudge-outcome-resolver.ts:37`, `src/hooks/src/lifecycle/post-compact-recovery.ts:91`, `src/hooks/src/lifecycle/pre-compact-saver.ts:58`)**:
   * **Mechanism**: All four hooks resolve `sessionId` via `ctx.sessionId || getSessionId()` without checking `input.session_id` first. Because `.instance/session-id.json` reuses the same smart ID for 24 hours (`maxAge = 86,400,000ms`), when a user takes the `/clear` recommendation after a PreCompact nudge, the new session receives the exact same smart `sessionId`. At `SessionStart`, `nudgeOutcomeResolver` calls `listForeignMarkers(projectDir, sessionId)` (`src/hooks/src/lib/nudge-outcome-state.ts:100`), which executes `if (sid === currentSessionId) continue;` and skips the prior session's marker. If the user later compacts in the new session, `postCompactRecovery` falsely records `user_action: 'compact'` for the earlier session's marker; otherwise, the marker only becomes foreign after 24 hours, which equals `IGNORE_THRESHOLD_MS` (`24 * 60 * 60 * 1000`), making `user_action: 'clear'` unreachable when `CLAUDE_SESSION_ID` is unset.
3. **Turn Counter Skipped on Short Prompts (`src/hooks/src/prompt/cache-break-detector.ts:203-227`)**:
   * **Mechanism**: `cache-break-detector.ts` is the sole writer of the session turn counter file (`getTurnStateFilePath(sessionId)`), which `prompt/goal-tracker.ts` and `stop/goal-tracker.ts` read via `getCurrentTurn(sessionId)`. However, `cacheBreakDetector` returns early at line 204 when `prompt.length < 50` before incrementing `turnCount` at line 220. Any `/goal` invocation or follow-up prompt shorter than 50 characters (such as `/goal until npm test passes` or `continue`) fails to initialize or increment `turnCount`, leaving `turnsElapsed` stuck at `0` so `max_turns` never triggers.
   * **Regression tests**: `src/hooks/src/__tests__/state-machine-session-id-regressions.test.ts`

### Confirmed Bug Group 2: SQLite Session Registry (`sessions.db`) Invalid State Transitions (High Impact)

1. **Resumed Session Retains Non-Null `ended_at` While `running` or `crashed` (`src/hooks/src/lifecycle/session-registrar.ts:224-245`)**:
   * **Mechanism**: When a session ends cleanly, `session-finalizer.ts:34-37` sets `status = 'completed', ended_at = ?`. When that session is later resumed, `session-registrar.ts:227-237` executes `ON CONFLICT(sid) DO UPDATE SET ... status = 'running', last_heartbeat = excluded.last_heartbeat` without setting `ended_at = NULL`. The row enters `status = 'running'` with a non-null `ended_at` in the past (`ended_at < last_heartbeat`), and if it later times out via `sweep()`, it enters `status = 'crashed'` with the stale `ended_at`.
   * **Evidence**: Live query on `~/.local/state/orchestkit/sessions.db` found 94 rows in `status = 'crashed'` with `ended_at IS NOT NULL AND last_heartbeat > ended_at`.
2. **Heartbeat Updates `last_heartbeat` Without Transitioning `crashed -> running` or Guarding `completed` (`src/hooks/src/posttool/heartbeat.ts:46-48`)**:
   * **Mechanism**: `posttool/heartbeat.ts` runs `UPDATE sessions SET last_heartbeat = ? WHERE sid = ?`. When a long-lived session sits idle for >24 hours, another session's `SessionStart` `sweep()` marks it `status = 'crashed'`. When the user resumes running tools in that still-open session, `posttool/heartbeat` updates `last_heartbeat` on every tool window while leaving `status = 'crashed'` permanently. Conversely, if an async `posttool/heartbeat` lands after `SessionEnd` (`session-finalizer`), it advances `last_heartbeat > ended_at` on a `'completed'` row.
   * **Evidence**: Live query on `~/.local/state/orchestkit/sessions.db` found 4 rows with `status = 'completed' AND last_heartbeat > ended_at`.
   * **Regression tests**: `src/hooks/src/__tests__/state-machine-session-db-regressions.test.ts`

### Confirmed Bug Group 3: Subagent Task Registry, Retry Counter, and Task Progress Stuck States (Medium-High Impact)

1. **Task Registry Namespace Mismatch and Top-Level Field Lookup Leave Auto-Registered Tasks Stuck (`src/hooks/src/posttool/task/agent-task-auto-register.ts:53,88` vs `src/hooks/src/subagent-stop/feedback-loop.ts:236-241,262`)**:
   * **Mechanism**: `agent-task-auto-register.ts` reads `getField(input, 'subagent_type')` (top-level instead of `input.tool_input.subagent_type`) and registers `subagent_type` raw (e.g. `"ork:backend-system-architect"`), whereas `feedback-loop.ts` strips `"ork:"` via `normalizeAgentName()` before calling `getTaskByAgent(agentType)` (`src/hooks/src/lib/task-integration.ts:319`), which compares `t.agent === agent` by exact equality. Every `ork:*` subagent task never matches at `SubagentStop` and remains stuck in `status: 'pending'`.
   * **Related namespace mismatch**: `src/hooks/src/subagent-stop/retry-handler.ts:209` passes raw `agentType` (`"ork:..."`) to `makeRetryDecision`, where `ALTERNATIVE_AGENTS` (`src/hooks/src/lib/retry-manager.ts:40-51`) is keyed by bare agent names, so `getAlternativeAgent` always returns `undefined` for `ork:*` agents. Similarly, `src/hooks/src/subagent-start/context-gate.ts:31,196` tests raw `subagentType` against `EXPENSIVE_TYPES = /^(test-generator|...)$`, which never matches `ork:*` agents.
2. **Subagent Retry Counter Never Increments Across Failures (`src/hooks/src/subagent-stop/retry-handler.ts:194-229` and `src/hooks/src/lib/orchestration-state.ts:146-161`)**:
   * **Mechanism**: `trackDispatchedAgent` (`orchestration-state.ts:118`) is never called by any hook in `src/hooks/src/`. When `retryHandler` runs on a subagent failure, `state.activeAgents` has no entry for `agentType`, so `currentRetryCount` is `0`. `retryHandler` then calls `updateAgentStatus(agentType, 'retrying')`, which looks up `state.activeAgents.find(a => a.agent === agent)` and silently does nothing when no entry exists. In addition, `executionHistory` in `retry-handler.ts:31` is an in-memory `Map` that resets when the hook subprocess exits. Consequently, `retryCount` remains `0` on every failure (`Attempt: 2 of 3` forever) and never reaches `maxRetries`.
3. **Numbered Task Progress Bar Fails to Reset on Second Batch in Same Session (`src/hooks/src/task-created/task-progress-initializer.ts:76-83`, `src/hooks/src/task-completed/task-progress-tracker.ts:78-111`)**:
   * **Mechanism**: When a numbered batch `[1/5]..[5/5]` completes (`state.total = 5, state.completed = 5`) and a second batch `[1/3]..[3/3]` starts in the same session, `taskProgressInitializer` only checks `if (total > state.total)` without resetting when `[1/N]` is created after `state.completed >= state.total`. Subsequent completions push new `taskId`s into `state.task_ids`, driving `state.completed > state.total`.
   * **Regression tests**: `src/hooks/src/__tests__/state-machine-subagent-retry-regressions.test.ts`

### Confirmed Bug Group 4: PID Lock Creation Race and Debt Ledger Head Drift (Medium Impact)

1. **`acquirePidLock` TOCTOU Race on Newly Created Lockfile (`src/hooks/src/lib/pidlock.ts:26-45`)**:
   * **Mechanism**: `writeFileSync(lockPath, String(process.pid), { flag: 'wx' })` performs `open(O_CREAT | O_EXCL | O_WRONLY)` followed by `write()`. If a second process hits `EEXIST` in the window after `open()` but before `write()` flushes, `readFileSync(lockPath, 'utf8')` reads `""`, `Number.parseInt("", 10)` yields `NaN`, and `!Number.isInteger(holderPid)` evaluates to `true`. Because `abandoned` is defined as `age > staleMs || !Number.isInteger(holderPid) || !isProcessAlive(holderPid)`, the contender immediately `unlinkSync(lockPath)`s the brand-new lockfile (`age ~ 0ms`) and steals the lock.
2. **Debt Ledger Incremental Update Ignores `head` Mismatch (`src/hooks/src/lib/debt-ledger.ts:238-255`)**:
   * **Mechanism**: `updateLedgerForFile(projectDir, filePath, text)` reads the shared `debt-ledger.json` and overwrites entries for `file` while preserving `ledger.head`, without checking whether `ledger.head` matches `resolveHead(projectDir) ?? 'no-git'`. If `debt-ledger.json` was generated on another branch/worktree or repository (when `CLAUDE_PLUGIN_DATA` is set), incremental edits splice entries from the current working tree into a ledger stamped with a foreign `head`.
   * **Regression tests**: `src/hooks/src/__tests__/state-machine-pidlock-ledger-regressions.test.ts`

## 4. Suspected / Unconfirmed Issues (Tracked Only, Not Refactored)

1. **Handoff Injection Skipped When Turn 1 Runs at Low Effort (`src/hooks/src/lifecycle/session-handoff-injector.ts:60` and `src/hooks/src/prompt/unified-dispatcher.ts:434`)**:
   * If a fresh `.claude/HANDOFF.md` exists at `SessionStart`, `session-handoff-injector` yields to the repo-local `UserPromptSubmit` loop. If the user runs the session with `/effort low`, `unified-dispatcher.ts:434` skips all `runOnce && producesContext` hooks (including `handoff-injector`), so neither hook injects the handoff while effort remains `'low'`. Kept as suspected because skipping heavy context at `/effort low` may be intentional.
2. **`edit-history.jsonl` Read-Modify-Write Truncation Under Concurrent Sessions (`src/hooks/src/prompt/thrash-detector.ts:68-75` vs `src/hooks/src/posttool/write/edit-history-tracker.ts:43`)**:
   * `thrash-detector` trims `.claude/state/edit-history.jsonl` in place via `writeFileSync` when `entries.length > 50`, which can race with concurrent `appendFileSync` calls in `edit-history-tracker`. Impact is advisory-only (one missed edit event in thrash counting).
3. **`commit-nudge-state.json` Shared Across Sessions in `getLogDir()` (`src/hooks/src/posttool/commit-nudge.ts:42-44`)**:
   * `commit-nudge-state.json` is stored at `${logDir}/commit-nudge-state.json` without a `session_id` key, so a commit in one session resets `last_commit_ts` and `last_nudge_level` for concurrent sessions sharing the log dir.

## 5. Pass 2: Unenforced Invariants Across the Codebase

1. **Hook Context `sessionId` vs `HookInput.session_id` Equivalence (`src/hooks/src/lib/context.ts:15-31`, `src/hooks/bin/run-hook.mjs:789`)**:
   * Many hooks assume `ctx.sessionId` equals the active Claude Code session ID, but `buildContext()` is called before `input` is passed and reads `process.env.CLAUDE_SESSION_ID` (which Claude Code does not set), falling back to `.instance/session-id.json` (24h smart ID). Only hooks that explicitly read `input.session_id || ctx.sessionId` see the real session UUID.
2. **Single-Writer Assumption on Per-Session JSON State Files (`.claude/orchestration/state-${sessionId}.json`, `.claude/orchestration/task-registry-${sessionId}.json`, `.claude/state/session-${sessionId}-token-accum.json`)**:
   * `mutateOrchestrationState` (`src/hooks/src/lib/orchestration-state.ts:81`) and `mutateRegistry` (`src/hooks/src/lib/task-integration.ts:95`) use `atomicWriteSync` (temp file + rename) to prevent torn reads, but do not hold a cross-process lock across the read-modify-write cycle when parallel `SubagentStop` or `PostToolUse` hooks fire concurrently in the same session.
3. **Hook Dispatcher Order Dependency Between `unified-dispatcher` and `prompt/goal-tracker` (`src/hooks/hooks.json:700-730`)**:
   * `prompt/goal-tracker.ts` relies on `prompt/unified-dispatcher` (specifically its internal sub-hook `cache-break-detector`) having already run synchronously on the same `UserPromptSubmit` event to update `${sessionId}-cache-break.state` before `goal-tracker` reads `getCurrentTurn(sessionId)`. This ordering invariant exists only in the array order of `hooks.json` and a comment in `cache-break-detector.ts:35-38`.
4. **Tail-Read Window Completeness (`src/hooks/src/lib/task-usage-signal.ts:26`, `src/hooks/src/prompt/unified-dispatcher.ts:331`)**:
   * `sessionHasTasks` assumes a session's `task_created` entry lies within the last 16 KiB of `.claude/logs/task-creations.jsonl`, and `userRenamedTitle` assumes a manual `/rename` record lies within the last 64 KiB of the session transcript (mitigated after first detection by the sticky `user-renamed.flag` latch).
5. **Component Count Synchronization Across Manifests and Docs (`manifests/ork.json`, `src/hooks/hooks.json`, `CLAUDE.md`)**:
   * Hook, skill, and agent counts are duplicated in `manifests/ork.json`, `src/hooks/hooks.json` (`description`), and `CLAUDE.md`. They are not enforced at runtime, only by `npm run test:manifests` in CI.
