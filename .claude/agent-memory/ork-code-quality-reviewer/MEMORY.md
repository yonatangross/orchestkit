# OrkKit Code Quality Reviewer Memory

## Topic Files (read on demand)
- [subagent-hook-input-normalization](subagent-hook-input-normalization.md) — run-hook.mjs:141 shims agent_type→tool_input.subagent_type; subagent hooks reading tool_input are correct
- [skill-guard-scope-gaps](skill-guard-scope-gaps.md) — multi-agent-safety guard scans SKILL.md only; 29 references/rules files kept bare ork names post-#2374
- [mcp-registry-oci-package-format](mcp-registry-oci-package-format.md) — registry rejects registryBaseUrl/version on OCI pkgs; tagged identifier only; GHCR private-by-default gotcha

## Hook System Analysis (2026-03-02)
Full CC-v3 vs OrchestKit hook comparison stored in `hook-comparison.md`.

Key confirmed findings:
- `pre-compact-saver.ts` fully covers CC-v3 pre-compact-continuity
- `tldr-summary.ts` fully covers CC-v3 tldr-context-inject (session dedup, 2MB cap, dual threshold)
- `auto-lint.ts` runs biome/ruff post-Write/Edit but NOT tsc --noEmit (gap)
- `context-injector.ts` runs on every UserPromptSubmit but returns outputSilentSuccess (dead output path)
- `unified-dispatcher.ts` uses Promise.allSettled — async hooks CANNOT emit systemMessage/additionalContext to user
- File-edit budget tracking is absent (no unique-file-path counter with handoff threshold)

## Top Gaps to Address
1. smart-search-router: grep/find → suggest native Grep/Glob (add to unified-advisory-dispatcher)
2. file-edit-budget: unique files edited, warn at 15/25 (must be sync path, not async dispatcher)
3. context-injector activation: already runs, just silenced — swap outputSilentSuccess for outputPromptContext
4. tsc in the loop: add tsc --noEmit to auto-lint.ts TypeScript case (10s cap)
5. memory-awareness: call getWorkflowSummary() from context-injector (already exported, already data)

## atomicWriteSync Retrofit Review (2026-03-03, PR #929)

### Biome Lint (3 fixable errors total across 13 files)
- `src/stop/handoff-writer.ts:129,169` — string concat instead of template literal (`lint/style/useTemplate`)
- `src/__tests__/stop/handoff-writer.test.ts:260` — same, in test

### Tests: 164 / 164 passed (5 test files)
- session-metrics: 5, context-gate: 30, memory-writer: 68, handoff-writer: 23, data-loss-risk: 38

### TypeCheck: clean (exit 0)

### Security: 1 high — rollup 4.0.0-4.58.0, GHSA-mw96-cpmx-2vgc. `npm audit fix` resolves.

### Mock Pattern Findings
- 4 different mock signatures for atomicWriteSync across 5 test files — inconsistent encoding arg.
  - `handoff-writer.test.ts`: `(path, content) => mockWriteFileSync(path, content, 'utf8')` — 3-arg
  - `session-metrics.test.ts`: `(path, content) => mockWriteFileSync(path, content)` — 2-arg (no 'utf8')
  - `context-gate.test.ts`: `fs.writeFileSync(path, content)` — dynamic import pattern
  - `data-loss-risk-hooks.test.ts`: `fs.writeFileSync(path, content, 'utf8')` — 3-arg
  - `memory-writer.test.ts`: `fs.writeFileSync(path, content)` — 2-arg
  Recommend a shared `__mocks__/lib/atomic-write.ts` stub.

### Logic Findings
- `memory-writer.ts:466` — double-header insert bug: if `header` is already prepended but not found at offset 0, `indexOf(header)` + `headerEnd` points to wrong insertion position.
- `memory-writer.ts:477` — truncation logic uses `lastIndexOf('- **[')` which is the LAST entry, not the 50th. The 50th entry is at a different offset; this discards all but the most recent entry when > 50 decisions.
- `audit-logger.ts:98` — log rotation uses bare `renameSync` (not atomicWriteSync); acceptable since it's a rename-to-backup, not a write; no crash risk.
- `context-gate.ts` — `incrementBlockedCount` / `incrementSessionTotal` do read-modify-write without a lock; concurrent spawns in a worktree can race. Low risk (only counter drift, not correctness).
- `auto-spawn-quality.ts:276` — `input.session_id` typed `string` in HookInput; no null guard needed; type-safe.

### Unused Variable
- `context-gate.test.ts:771` — `const _callCount = 0` declared but never read. Biome would catch this as `noUnusedVariables` but it starts with `_` so Biome suppresses it.

### DRY Violations
- `queueSpawn` and `writeSpawnSuggestion` in `auto-spawn-quality.ts` are both called with identical arguments; could be merged into one write-two-files helper.
- `countActiveBackground` and `countCurrentResponseAgents` in `context-gate.ts` are near-identical functions differing only in the time window constant (5min vs 2s). Extract a `countRecentSpawns(windowMs)` helper.

## feat/v7-unified-plugin Review (2026-03-03)

### Test Failures (2 / 6466 total)
- `async-registry.test.ts:166` + `e2e/dispatcher-registry-wiring.test.ts:190` — both expect `Task` in the posttool/unified-dispatcher hooks.json matcher string, but hooks.json line 98 reads `"Bash|Write|Edit|Agent|TaskUpdate|TaskCreate|Skill|NotebookEdit"` (missing `Task`). Root cause: PR #902 renamed `Task` → `Agent` in the HOOKS array inside unified-dispatcher.ts but the top-level hooks.json matcher was updated to replace `Task` with `Agent` instead of adding `Agent` alongside `Task`.

### Biome Lint (14 errors, all FIXABLE)
- `context-exhaustion-warner.ts:97` — `isNaN()` (global) instead of `Number.isNaN()` — `lint/suspicious/noGlobalIsNan`
- `handoff-writer.ts:129,169` — string concat instead of template literal — `lint/style/useTemplate`
- `handoff-injector.ts:86` — same
- `model-cost-advisor.ts:14` — unused import `logHook` — `lint/correctness/noUnusedImports`
- Test files: 3x `useTemplate`, 4x `noUnusedImports`

### atomic-write.ts — Correctness Warning
- `acquireLock()` busy-wait spin: `while (Date.now() - start < LOCK_POLL_MS) {}` burns CPU for 50ms per retry. On a 5s timeout that's 100 iterations of busy spin. Use `Atomics.wait()` or accept the busy-wait but document it explicitly. NOT a blocker but noteworthy.
- `Date.now()` used in lock deadline — project prefers ISO 8601 for content but `Date.now()` for arithmetic is acceptable.

### New Files Quality Summary
- `atomic-write.ts`: Solid. Crash-safe pattern correct. Lock-on-timeout break-stale is a good defensive move.
- `analytics-buffer.ts`: Solid. SIGTERM/SIGINT handlers + process.on('exit') guard covers all exit paths. `handlersRegistered` flag prevents duplicate listener leak.
- `handoff-writer.ts`: Solid. Proper fallback chain (learnings → raw decisions). `atomicWriteSync` correctly used.
- `handoff-injector.ts`: Solid. Consume-on-read (rename to .consumed) is correct. Token budget cap at 600t.
- `dirty-file-tracker.ts`: Solid. Module-level load + disk persistence for cross-process state recovery is correct approach. `_resetForTesting()` export is clean test seam.
- `context-exhaustion-warner.ts`: One `isNaN` bug (global vs `Number.isNaN`). Otherwise solid tier escalation logic.

## v7.0.0 Hook Review (PR #835, 2026-03-02)
- Details archived in [review-v7-hooks-pr835](review-v7-hooks-pr835.md) — dead code, as-any casts, fork-bomb pattern fragmentation, 16 test failures.

## feat/836-versioned-notebooks Review (2026-03-03, PR #939)

### Test Failure (1 / 6503 total)
- `split-bundles.test.ts:320` — hook count snapshot not updated. Expects 166, receives 169. Fix: update to 169 with changelog comment.

### Biome Lint (3 errors, all in new PR files)
- `session-handoff-generator.ts:89,97` — 2x `lint/style/useTemplate` (string concat)
- `session-handoff-injector.ts:20` — `lint/correctness/noUnusedImports` (unused `join` from node:path)

### TypeCheck: clean (exit 0)
### Security: 0 vulnerabilities

### Architecture Findings
- `release-notebook-trigger.ts:71` — only posttool hook using `export default async function handler(...)`. All others use named exports. Inconsistency.
- SKILL.md `user-invocable: false` but trigger nudge message says "invoke the release-notebook skill" implying slash-command. Mismatch.
- `create-release-notebook.sh:86` — `grep -q "## \[${FULL_VERSION}\]"` should use `grep -qF` (fixed-string) for regex safety.
- No unit tests for 3 new hooks (session-handoff-generator, session-handoff-injector, release-notebook-trigger).

### What Was Correct
- Type safety clean, atomicWriteSync for all writes, outputSilentSuccess fallback pattern, project dir from input with fallback, hooks.json + entry file + CLAUDE.md counts all consistent (37 global / 98 total).
- Rotation logic in session-handoff-generator is correct (archive written first, then rotate, correct slice math).
- execSync uses cwd: option (not string interpolation) — no command injection.

## feat/v7.1.0-perf-sprint Review (2026-03-04)

### Test Failures (2 / 6543 total)
- `dispatcher-registry.test.ts:105` — stop/unified-dispatcher expected 20 hooks but got 21 (perf-snapshot added but test snapshot NOT updated)
- `dispatcher-registry.test.ts:197` — cross-dispatcher total expects 51, got 52 (same root cause)

### Biome Lint (1 error)
- `src/lib/git.ts:39` — `envVal && envVal.trim()` should use optional chain `envVal?.trim()` — `lint/complexity/useOptionalChain`

### TypeCheck: clean (exit 0)
### Security: 0 vulnerabilities

### Security Findings
- `agent-browser-safety.ts:414` — `isBlockedUrl()` localhost allowlist regex `/^https?:\/\/[a-z0-9-]+\.localhost(:\d+)?(\/|$)/i` is correct — requires subdomain (bare localhost still blocked by later BLOCKED_URL_PATTERNS). Env var `ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST !== '0'` is safe (allowlist requires opt-out, not opt-in).
- `perf-snapshot.ts` — uses `atomicWriteSync` correctly; home dir from `getHomeDir()` (no path traversal possible).
- `perf-compare.sh` — uses `node -e ... -- "$file"` pattern: no inline JSON interpolation, file paths via process.argv. CORRECT.
- `test-mcp-overhead.sh` — same node pattern for YAML frontmatter; no shell injection.
- `git.ts:getProtectedBranches()` — env var split on `,` with `.trim().filter(Boolean)` — safe, no injection.

### Architecture Findings
- `perf-snapshot` registered in stop/unified-dispatcher but dispatcher-registry.test.ts snapshot not updated (blocker).
- `perf-snapshot.ts:136-137` — returns `{ continue: true, systemMessage: ... }` but stop dispatcher is ASYNC and uses Promise.allSettled; per CC docs, systemMessage from async Stop hooks IS surfaced (it's a Stop hook, not PostToolUse). This is correct and intentional.
- `outputWithNotification` userMessage guard: does NOT gate on empty string — empty userMessage would set `result.systemMessage = ""`. Low risk (empty systemMessage harmless) but inconsistent with #865 pattern.
- `common.ts:222` — comment typo: `/ #865:` missing leading `/` (should be `// #865:`). Cosmetic only.

### What Was Correct
- All 5 TS files: type-safe, no `any` casts, correct error handling with fallback to `outputSilentSuccess()`.
- `perf-compare.sh` rewrite eliminates shell injection completely.
- `ork.settings.json` — valid JSON, 6 new env vars all have proper defaults, schema valid.
- Phase 3.5 wizard logic is complete: 5 questions, merge-not-overwrite pattern, env quick-reference table matches getCommitScopeMode() / getProtectedBranches() / isPerfSnapshotEnabled() semantics.
- `isBlockedUrl()` localhost allowlist regex correctly requires subdomain before `.localhost`.

## feat/ci-automation-1002-1005 Review (2026-03-07, PR #1006)

### Tests: 1 / 5819 failing (pre-existing, not introduced by PR)
- `home-environment.test.ts:246` — `patternSyncPull` SKIP test asserts `existsSync` not called, but `getLogLevel()` in common.ts reads `~/.claude/logs/ork/debug-mode.flag` unconditionally via `logHook()`. Test expectation is too strict; fix by not asserting `existsSync` call count in skip tests.

### Biome Lint: 0 errors (all new/modified files clean)
### TypeCheck: clean (exit 0)
### Security: 0 vulnerabilities

### Blocker
- `settings-reload.ts:128` — bare `writeFileSync` for debug-mode.flag; must use `atomicWriteSync`. `failure-handler.ts:87` has same issue for the same flag path.

### Logic Issues
- `commit-nudge.ts:113` — time-based nudge level `'time'` has no exit; once set, time-based nudging is permanently suppressed regardless of elapsed time and cooldown. State machine dead-end.
- `restrict-bash.ts:52-54` — defines its own `hasCompoundOperators()` using `.includes()` on raw operator strings. False-positives for quoted operators. Should use `isCompoundCommand()` from `normalize-command.ts` (the hardened implementation used everywhere else).
- `claude-health.yml:96` — `\$GITHUB_STEP_SUMMARY` backslash-escapes the `$`; GH Actions `run:` block does not require this. Step summary output likely broken.

### DRY Violations
- `pre-commit-quality-runner.ts:74,91` — `runCheck` and `runCheckWithArgs` duplicate the error-output extraction logic.
- `TRACKED_TOOLS` Set and `COOLDOWN_MS` in `commit-nudge.ts` defined inside function body — should be module-scope constants.

### Patterns Confirmed Working
- `execFileSync` with array args for eslint/jest (SEC-001) — correct, well-tested.
- Phase ordering in sync-bash-dispatcher (security first, quality last) — correct.
- task-commit-linker + task-progress-tracker: clean separation of concerns, both early-exit correctly.
- `--allowedTools` restriction in claude-health.yml headless mode — correct.
- `ci-automation/SKILL.md` explicitly warns against `pull_request_target` fork injection — notable.

### New Patterns to Watch
- CI workflow model IDs (`--model sonnet`, `--model haiku`) are not pinned — can drift silently as new models release.
- `commit-nudge.ts` state machine uses level strings (`'none'|'info'|'warn'|'urgent'|'time'`) — ordering is implicit; consider a numeric level for comparison.

## split-bundles.test.ts Pattern
- Every PR adding new hook exports MUST update `expect(totalHooks).toBe(N)` at split-bundles.test.ts:320.
- Each PR adds a changelog comment: `// N -> M: description of change (#PR)`
- This is the most common missed step in hook PRs.

## Architecture Patterns Confirmed
- All hooks: TypeScript, compiled via esbuild, tested in __tests__/
- Dispatcher pattern: sync dispatchers (short-circuit on block), async dispatchers (Promise.allSettled, fire-and-forget)
- Async hooks: hooks.json `async: true` → CC ignores systemMessage/continue/decision fields
- Session state: `.claude/logs/sessions/<sessionId>-state.json`
- Memory files: `.claude/memory/*.json`, `.claude/logs/*.jsonl`

## Key File Paths
- hooks.json: `src/hooks/hooks.json`
- PostToolUse dispatcher: `src/hooks/src/posttool/unified-dispatcher.ts`
- Bash PreToolUse dispatcher: `src/hooks/src/pretool/bash/sync-bash-dispatcher.ts`
- Context injector (currently silenced): `src/hooks/src/prompt/context-injector.ts`
- Auto-lint (biome/ruff, missing tsc): `src/hooks/src/posttool/auto-lint.ts`
- Pre-compact saver: `src/hooks/src/lifecycle/pre-compact-saver.ts`
- TLDR summary: `src/hooks/src/pretool/read/tldr-summary.ts`
- Workflow preference learner: `src/hooks/src/stop/workflow-preference-learner.ts`
  - Exports: getWorkflowSummary(), getPrimaryWorkflowPreference() — ready for prompt injection
- [docs/site review gotchas](docs-site-review-gotchas.md) — vitest needs -c flag; fumadocs search limit=60 (not unbounded); cc-support policy string went stale at #2295
