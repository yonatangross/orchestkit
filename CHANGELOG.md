# Changelog

All notable changes to the OrchestKit Claude Code Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [7.29.0] - 2026-04-05

### Added

- **CC 2.1.92 version compatibility** — 12 new entries in version-compatibility.md, 8 features in cc-version-matrix.ts (#1263)
  - `forceRemoteSettingsRefresh` policy: fail-closed startup for enterprise managed settings
  - Stop hook `preventContinuation:true` semantics restored
  - Tool input JSON-string streaming fix
  - Plugin MCP stuck "connecting" fix
  - Write tool 60% faster diff computation
  - Remote Control hostname-based session naming
  - Per-model `/cost` breakdown
  - Subagent tmux pane count fix
  - `/tag` and `/vim` commands removed (no OrchestKit impact)
- **`forceRemoteSettingsRefresh` in configure/doctor skills** — enterprise policy docs, health check outputs for managed settings and MCP connector conflicts
- **Defensive JSON-string unwrap in `run-hook.mjs`** — `normalizeInput()` auto-parses string-encoded array/object `tool_input` fields while preserving known string fields via allowlist (defense against CC streaming regression)

### Changed

- **HookContext DI migration completed** — all 208 hook source files migrated to `(input, ctx)` signature with `NOOP_CTX` default fallback
  - `buildContext()` factory + `createTestContext()` test helper for dependency injection
  - Shared mock factory replaces inline mocks across 137 test files
  - `common.ts` god module split into `output.ts`, `env.ts`, `log.ts`
  - Telemetry decoupled — inline webhookForwarder removed from common module
  - All unused `testCtx` scaffolding removed from lib/utility test files (16 files)
  - All biome lint errors resolved: 0 errors, 0 warnings across 530 files

## [7.28.0] - 2026-04-03

### Added

- **Telemetry Provider Architecture (M105)** — pluggable sink system with Grafana Echo-style interface
  - `TelemetrySink` interface: `{ name, supportedEvents, addEvent, flush }` for pluggable sinks
  - `emit()` API: central fan-out to registered sinks with per-sink failure isolation
  - `JsonlSink`: local JSONL backup via `appendFile` (async, non-blocking). Always-on safety net — events never lost even when HTTP sink is down
  - `HttpSink`: HMAC-signed POST with 3x retry (full-jitter exponential backoff) and circuit breaker (5 fails → OPEN, 30s cooldown → HALF_OPEN)
  - `telemetry-sync.mjs`: batch replay CLI — reads JSONL, POSTs to `/batch-ingest` as NDJSON, deletes synced rotated files
  - Config-based sink registry: plugin.json and settings.local.json can register custom HTTP sinks
  - Webhook forwarder coverage validator: CI gate ensuring all 27 CC events have forwarder coverage
  - Rotation: files >10MB renamed on SessionEnd, rotated files >7 days cleaned up
- **Payload sanitization** — 15 secret patterns redacted before transmission
  - API keys: `sk-ant-` (Anthropic), `sk-` (OpenAI), `AKIA` (AWS), `AIza` (Google/Firebase)
  - Tokens: GitHub PATs (`ghp_`, `gho_`, `github_pat_`), Slack (`xoxb-`, `xoxp-`), Bearer
  - Database URLs: MongoDB, PostgreSQL, MySQL connection strings
  - Environment variable assignments with secret names
  - Recursive sanitization with 500-char truncation
- **27/27 CC event coverage** — all documented (20) and undocumented (7) CC hook events forwarded

### Fixed

- Webhook forwarder coverage: 9 gaps fixed (FileChanged standalone, 8 dispatcher inlines)
- `JsonlSink` always registers (was gated behind HTTP config — silent data loss when webhooks disabled)
- Telemetry directory permissions: 0o755 → 0o700 (world-readable on shared systems)
- `hook_event_name` → `hook_event` normalization in `run-hook.mjs` (all events logged as "unknown")
- Plugin/user `HttpSink` instances now receive config URL/token (were all hitting env-configured default)
- Stale test assertions: async hook counts, split-bundle counts, description totals, cross-reference prefixes
- GitHub push protection: replaced realistic-looking test fixtures with obviously-fake tokens

- **CC 2.1.91 integration**: MCP result size override, disableSkillShellExecution, plugin bin/ executables, Edit shorter anchors
  - `mcp-output-transform` "Trust CC's decision" heuristic: results > 50K chars were explicitly kept by CC (likely `_meta["anthropic/maxResultSizeChars"]`), so skip truncation. Results 2K–50K get token-saving truncation. PII redaction always runs regardless of size. Best-effort `_meta` extraction kept as fallback.
  - `ORCHESTKIT_MCP_TRUNCATION_THRESHOLD` env var to override default 2K truncation threshold
  - 7 new unit tests for CC trust heuristic (large result skip, PII on large results, _meta extraction, invalid _meta, env override)
  - Fixed pre-existing test mock: `getProjectDir` + `webhookForwarder` missing from mcp-output-transform test mocks
  - `disableSkillShellExecution` fallback notes added to 4 skills with invocation_hooks (cover, expect, commit, devops-deployment)
  - cc-version-matrix.ts: +8 entries for CC 2.1.91 features
  - mcp-patterns skill: added `_meta` annotation documentation, code example in server-setup rule
  - cc-version-settings.md: new section covering disableSkillShellExecution, plugin bin/, Edit anchors, auto permission validation
  - version-compatibility.md: +8 feature matrix entries, v7.29.x history row, 2.1.91 compatibility level

### Changed

- `webhookForwarder()` simplified to thin wrapper around `emit()` (public API unchanged — dispatchers need zero changes)
- `signPayload()` extracted from `usage-summary-reporter.ts` to shared `lib/crypto.ts`
- `sanitizePayload()` extracted from `session-tracker.ts` to shared `lib/crypto.ts` with expanded patterns
- Hook count: 131 → 132 (added `telemetry-sync` on SessionEnd)
- Minimum Claude Code version: 2.1.90 → 2.1.91
- README badge updated from 2.1.90 to 2.1.91
- mcp-patterns skill compatibility bumped from 2.1.76+ to 2.1.91+
- mcp-output-transform uses "Trust CC's decision" heuristic for results > 50K instead of blindly truncating everything to 2K

## [7.27.0] - 2026-04-02

### Added

- **shadcn/ui v4 style system** across 7 design skills: `ui-components`, `design-to-code`, `component-search`, `design-context-extract`, `json-render-catalog`, `design-system-tokens`, `ai-ui-generation`
  - 6 styles documented: Vega, Nova, Maia, Lyra, Mira, Luma
  - Preset code system (`npx shadcn@latest init --preset <code>`)
  - Style detection from `components.json` → `"style"` field
  - Style-aware component adaptation in design-to-code pipeline
  - Best-fit style recommender in design-context-extract
  - Style-aware catalog overrides in json-render-catalog
  - Luma elevation tokens (shadow-md + ring) in design-system-tokens
- `ui-components/rules/shadcn-v4-styles.md` — new rule file for v4 style detection, class mapping, and preset codes (622 total rules)

### Fixed

- **P0 BUG** denial-notification.ts: in-memory `denialTimestamps` array reset on every hook invocation (fresh Node.js process per call). Now reads persisted timestamps from `permission-denials.jsonl` written by denial-logger, with cooldown state in separate JSON file
- **P1 SEC** project-write-retry.ts: added `resolveRealPath()` before `isInsideDir()` to prevent symlink bypass attacks (replicates ME-001 fix from file-guard.ts)
- **P1 SEC** auto-approve-project-writes.ts: added matching `resolveRealPath()` call to close asymmetry between approval and retry hooks
- denial-logger.ts: JSDoc incorrectly said "Async" but uses `appendFileSync` — corrected to "Sync"
- `hasExcludedDir()` now catches terminal path segments (e.g., `/project/.git` without trailing slash)
- Stale hook count "110 hooks" updated to "112 hooks" across 11 doc pages
- Stale skill count "100/101 skills" updated to "102 skills" across 11 doc pages

### Added

- **CC 2.1.88 integration**: 5 PermissionDenied hooks via unified-dispatcher (denial-logger, denial-notification, safe-command-retry, project-write-retry)
- **CC 2.1.89 integration**: `headless-defer` PreToolUse hook returns `{decision:"defer"}` in headless `-p` mode for destructive ops (force push, npm publish, terraform apply, kubectl, docker push, gh merge). Configurable via `ORCHESTKIT_DEFER_TOOLS` env var
- **`/ork:release-sync` skill**: post-release content sync to NotebookLM + HQ Knowledge Base. Reads CHANGELOG, CLAUDE.md, hook README, updates notebook sources
- `lib/path-containment.ts` — shared EXCLUDED_DIRS, isInsideDir(), hasExcludedDir(), resolveRealPath() (extracted from 2 duplicating hooks)
- `lib/bash-patterns.ts` — unified REJECT_PATTERNS (was duplicated with inconsistencies between auto-approve-safe-bash and safe-command-retry)
- `outputDefer()` helper in lib/common.ts for PreToolUse permission deferral
- types.ts: `permissionDecision` union extended with `'defer'` (CC 2.1.89)
- cc-version-matrix.ts: +9 entries for CC 2.1.89 features (defer permission, TaskCreated hook, autocompact thrash detection, cleanup validation, MCP nonblocking, named subagent typeahead, hook output disk spill, edit after bash view, symlink permission check)
- `MCP_CONNECTION_NONBLOCKING=true` in ork.settings.json for faster headless `-p` mode startup
- yarn read-only patterns added to RETRY_SAFE_PATTERNS
- PermissionDenied section added to `src/hooks/README.md`
- 167 new unit tests (152 PermissionDenied + 15 headless-defer)
- `tests/skills/test-upstream-refs.sh` — CI freshness check for vendor references
- **Candlekeep batch** (CC 2.1.89 architecture insights — #1227-#1236):
  - **CwdChanged hook** (#1229): Detects tech stack on directory change, returns watchPaths, suggests relevant skills via path_patterns
  - **FileChanged hook** (#1230): Reacts to watched file changes (CLAUDE.md, package.json, .env, rules/), injects context
  - **mcp-output-transform hook**: PostToolUse PII redaction (emails, phones) and token-saving truncation for MCP results
  - **cache-break-detector hook** (#1234): Analytics-only — tracks prompt injection shape changes across turns for cache hit monitoring
  - **frustration-detector hook**: Analytics-only — privacy-first DX signal (boolean only, no matched text logged)
  - **fork() pattern** (#1227): Reference doc, explore + brainstorm skills annotated fork-friendly, context-stager skips forks, cache_hit_pct analytics
  - **path_patterns** (#1228): Added to 15 skills, CwdChanged consumer with 2-level directory scan (94% pattern match rate)
  - **critical_system_reminder** (#1231): Added to 8 agents, injected at spawn via subagent-context-stager
  - **required_mcp_servers** (#1232): Added to 4 agents, pre-flight availability check via CLAUDE_MCP_SERVERS env var
  - **invocation_hooks** (#1235): Shell precondition commands on 4 skills (cover, expect, commit, devops-deployment)
  - **MCP channels** (#1233): evalApiKey + notebookLmToken sensitive userConfig slots (CC keychain storage)
  - **Token budget carry-forward** (#1236): Pre/post compact preserves effort level and budget across compaction
  - **Transcript quality analysis**: SubagentStop bounded JSONL reads for tool counts, errors, token usage
  - **SessionStart perf measurement**: sync-session-dispatcher logs duration_ms to analytics
  - **CC field name diagnostic**: Debug-level log of input field names on first SubagentStop for runtime verification
  - 167 new Candlekeep tests (cwd-changed 21, file-changed 14, mcp-output-transform 35, cache-break 21, frustration 28, post-compact 20, analyze-transcript 17, fork detection 4, sync-session perf 3, materialize-rules 4)
  - Cache audit documented in hooks README: only 2 genuinely volatile per-turn hooks, rest migrated or gated

### Changed

- **Option E**: Replaced 32 copied Vercel Labs skills with upstream references. Their SKILL.md content deposited as `references/upstream-*.md` inside 6 existing OrchestKit skill directories (browser-tools, json-render-catalog, mcp-visual-output, multi-surface-render, emulate-seed, portless). Skill count: 132 → 102 (101 after Option E + 1 release-sync)
- `scripts/sync-vercel-skills.sh` enhanced with JSON mapping file, content-hash dedup (no timestamp-only diffs), SHA pinning in manifest, `--check` and `--dry-run` modes
- `vendor/vercel-skills/mapping.json` — 37 refs across 4 Vercel repos → 6 skill dirs (committed for offline builds)
- `docs/site/lib/generated/agents-data.ts` — now auto-generated from `src/agents/*.md` frontmatter on every build (was hand-maintained, 8 agents missing, 9 phantom agents). Added `taskTypes`, `keywords`, `examplePrompts` to all 36 agent frontmatter files
- Removed 32 `vercel-*.mdx` pages from fumadocs, updated meta.json and category pages
- Agent descriptions improved for @mention typeahead discoverability: `genui-architect`, `ui-feedback`
- Dead code removed: memory-bridge entity extraction (132→33 lines), antipattern-warning function deleted (was no-op since #1145), speculative `mcp_connections` HookInput field removed
- Updated specs: CONTRIBUTING-SKILLS.md (path_patterns, invocation_hooks), agent-authoring.md (critical_system_reminder, required_mcp_servers), frontmatter validator (critical_system_reminder length check)
- Stale counts fixed across 22 fumadocs pages (102→103 skills, 112→115 hooks)
- Bounded JSONL read (last 4KB) + `atomicWriteSync` for crash-safe state persistence
- Minimum Claude Code version: 2.1.86 → 2.1.90
- **CC 2.1.90 integration**: version matrix +11 entries (powerup, plugin-keep-marketplace, husky-protected, exit code 2 fix, format-on-save fix, resume prompt cache fix, 3x perf, resume hides -p sessions, DNS auto-allow removal)
- `.husky/` added to file-guard PROTECTED_PATTERNS (CC 2.1.90 parity — prevent git hook tampering)
- Path resolution comments updated from "backward compat" to "defense in depth" — fallbacks retained as defensive programming rather than removed
- README badge updated from 2.1.86 to 2.1.90
- version-compatibility.md: +25 entries for CC 2.1.88–2.1.90, compatibility levels updated, v7.27.x version history row
- cc-version-settings.md: added CC 2.1.90 section (PLUGIN_KEEP_MARKETPLACE env var, format-on-save hook pattern, /powerup reference)

---


## [7.26.4] - 2026-03-29

### Fixed

- Flaky analytics-consent-check test (daysAgo boundary jitter at exact 30 days)
- path-to-regexp ReDoS vulnerability (8.3.0 → 8.4.0)

### Added

- 568 unit tests across 17 files — hook coverage 67% → 82%
- Tests for: decision-history, problem-tracker, task-integration, guards,
  decision-flow-tracker, session-parser, setup-repair, first-run-setup,
  setup-check, setup-maintenance, naming-convention-learner, code-style-learner,
  issue-subtask-updater, readme-sync, context7-tracker,
  workflow-preference-learner, model-cost-advisor

---


## [7.26.3] - 2026-03-29

### Fixed

- Agent attribution: race condition in session state (lockedAtomicWriteSync)
- Agent attribution: path traversal in sanitizeBranch (allowlist-based)
- Agent attribution: double ork: prefix in Co-Authored-By trailers
- Agent attribution: filterByThreshold now checks duration only, not success flag
- Agent attribution: cleanupStaleLedgers uses TTL only (branch name reversal was lossy)

### Changed

- Split agent-attribution.ts into 3 files (types, core, formatters)

### Added

- 35 unit tests for agent attribution (sanitize, ledger, format, deduplicate)
- 16 integration + E2E tests (session state pipeline, concurrent access, full flow)
- Agent attribution docs page in fumadocs site

---


## [7.26.2] - 2026-03-28

### Changed

- Refactored `run-hook.mjs`: extracted `SILENT_OK` constant replacing 5 hardcoded JSON strings

---


## [7.26.1] - 2026-03-28

### Fixed

- Bumped `path-to-regexp` to fix ReDoS vulnerabilities (Dependabot alerts #47, #48, #53, #54)

---


## [7.26.0] - 2026-03-28

### Added

- **`/ork:expect` improvements** — reliability and DX upgrades (#1185, #1186, #1187):
  - Route-map script: framework-aware file→URL mapping for Next.js App Router, Pages Router, Remix, SvelteKit — replaces Phase 3 prompt guessing with deterministic detection (#1185)
  - `--init` scaffolder: `bash scripts/init.sh` creates `.expect/` directory with config.yaml template, .gitignore, and flows/ directory in 5 seconds (#1186)
  - Rich expect-agent directive: 194-line agent body (was 61) with full agent-browser command reference, ARIA selector patterns, form interaction workflow, status protocol examples, and failure decision tree (#1187)
  - Report script: parses status protocol to terminal/CI/JSON output, auto-saves to `.expect/reports/` (#1189)
  - Example saved flows: login.md, crud.md, navigation.md — ARIA-first templates for common test patterns (#1190)
  - Fingerprint auto-save hook: PostToolUse dispatcher saves fingerprint after successful run, enabling zero-cost skip on next invocation (#1191)
- **CC 2.1.86 adoption**: bumped minimum from 2.1.85 → 2.1.86 for config disk write fix (eliminates unnecessary writes on every skill invocation) and Write/Edit fix for files outside project root

---


## [7.25.0] - 2026-03-26

### Added

- **`/ork:expect` — Diff-Aware AI Browser Testing** (M99, 18 issues):
  - Skill scaffold: SKILL.md (301 lines), 13 reference files, 5 rules, 3 scripts, 12 test cases (#1165)
  - Git diff scanner: 4 target modes (changes/unstaged/branch/commit), 3 data levels (files/stats/preview), magnitude-based 12-file prioritization (#1166)
  - SHA-256 fingerprint gating: check/save/clear commands, zero-cost skip when unchanged (#1167)
  - Scope-aware test depth: commit=narrow(2-4), unstaged=exact(2-3), changes=combined(3-5), branch=thorough(5-8) (#1168)
  - AI test plan generation: 8-section prompt template with coverage context, ARIA-first interaction, anti-rabbit-hole heuristics (#1169)
  - Machine-parseable status protocol: STEP_START/STEP_DONE/ASSERTION_FAILED/RUN_COMPLETED with parser (#1170)
  - Failure categorization: 6 types (app-bug, env-issue, auth-blocked, missing-test-data, selector-drift, agent-misread) (#1171)
  - ARIA snapshot diffing: semantic UI change detection via accessibility tree comparison (#1172)
  - Saved test flows: Markdown+YAML format_version 1 with adaptive replay (#1173)
  - Test coverage context: cross-reference changed files with existing tests, 4 patterns (#1174)
  - Execution engine: agent-browser orchestration, auth profiles, failure decision tree (#1175)
  - Report generator: terminal/CI/JSON output, GitHub Actions annotations, exit codes (#1176)
  - `.expect/config.yaml` convention: base_url, route_map, auth, ARIA snapshots, accessibility (#1177)
  - rrweb session recording: DOM event replay without video encoding (#1178)
  - Human-in-the-loop plan review: AskUserQuestion gate before execution (#1179)
  - CI integration: GitHub Actions workflow, pre-push hook, fingerprint-gated zero-cost skip (#1180)
  - Research reference: millionco/expect architecture analysis + feature comparison (#1181)
  - `expect-agent`: specialized browser test execution subagent (#1182)
- **Skill count** 99 → 100, **agent count** 35 → 36, **invocable commands** 20 → 21
- **CC 2.1.85 integration**:
  - Hook `if` conditionals: Bash PreToolUse and PermissionRequest now use CC 2.1.85 `if` field to skip process spawning for irrelevant commands (~40% fewer hook spawns)
  - Headless AskUserQuestion: new `pretool/ask/headless-responder` hook auto-selects first option when `CI=true` or `ORCHESTKIT_HEADLESS=1`, using CC 2.1.85 `updatedInput` + `permissionDecision`
  - **Hook count** 109 → 110 (41 global + 47 agent + 22 skill), **CC minimum** 2.1.84 → 2.1.85

---


## [7.24.2] - 2026-03-26

### Added

- **fal.ai MCP integration** — added fal MCP server to configure skill reference (1000+ models: FLUX.2, Kling 3.0, LTX 2.0, Veo 3.1, Chatterbox TTS), new "Generative media" project type
- **Video model pricing refresh** — updated stale fal.ai pricing in multimodal-llm skill ($0.90/10s → Kling $0.07/s, Veo 3.1 $0.40/s, Wan 2.5 $0.05/s)

### Fixed

- **Scorecard #132** — added nosemgrep annotation for npm pinned-dependencies advisory

---


## [7.24.1] - 2026-03-26

### Fixed

- **Stop hook version display** — replaced hardcoded `ork@7.22.0` with build-time injection from `manifests/ork.json` via `__PLUGIN_VERSION__` placeholder
- **Security: picomatch CVE-2026-33671 + CVE-2026-33672** — bumped picomatch to 4.0.4 across 3 directories; also bumped express-rate-limit (GHSA-46wh-pxpv-q5gq)
- **Stale counts** — synced hook count (106→109), skill count (94/98→99), CC version (2.1.75→2.1.84) across 6 docs pages

---

## [7.24.0] - 2026-03-26

### Added

- **CC 2.1.84 adoption — Phase 1 quick wins**:
  - `paths:` YAML glob lists on 13 skills — auto-loads relevant context files when skill activates (implement, design-to-code, memory, storybook-mcp, mcp-patterns, database-patterns, cover, fix-issue, devops-deployment, security-patterns, architecture-patterns, configure, explore)
  - `CLAUDE_STREAM_IDLE_TIMEOUT_MS=180000` — prevents long-running agents (audit-full, implement) from hitting the 90s default idle timeout
  - WorktreeCreate `type: "http"` support — returns worktree path via `hookSpecificOutput.worktreePath` for API-driven orchestration
  - 21 CC 2.1.84 features added to doctor version compatibility matrix
  - MCP 2KB tool description cap documented in CONTRIBUTING-SKILLS.md
- **TaskCreated hook event** (CC 2.1.84) — 3 new handlers:
  - `creation-tracker` — logs task creation events to JSONL + cross-project analytics
  - `task-context-injector` — enriches tasks with branch/commit context via `additionalContext`
  - `task-progress-initializer` — detects `[N/M]` numbered task patterns and initializes progress bar state
- **38 unit tests** for TaskCreated hooks (creation-tracker, task-context-injector, task-progress-initializer)
- **Fuzzy search with Fuse.js** — replaced `.includes()` substring matching in skill browser and agent selector with Fuse.js fuzzy search:
  - Typo tolerance (threshold 0.35), multi-word queries, word-order-independent matching
  - Relevance ranking with field weighting (name 3x, tags 2x, description 1x)
  - 150ms debounced input to prevent result flashing
  - `<Highlight>` component renders match ranges with yellow highlights
  - "Did you mean?" smart empty state with relaxed-threshold suggestions
  - Shared `useFuzzySearch` hook and `createSearch()` / `createRelaxedSearch()` in `lib/search.ts`
  - 23 unit tests covering fuzzy matching, relevance ranking, match metadata, and relaxed suggestions
- **RTK (Rust Token Killer) documentation** — added Git Validator section to safety-hooks docs covering `stripProxyPrefix()` flow, RTK v0.33.1 coexistence guide, `--hook-only` setup, and git status output change warning; added RTK FAQ entry

### Changed

- **CC version requirement** bumped to >= 2.1.84 (from >= 2.1.83)
- **Hook count** 106 → 109 (37 → 40 global hooks)
- **HookEvent type** updated: added `TaskCreated` event
- **HookInput type** updated: added `type` field for WorktreeCreate HTTP, `task_description` for TaskCreated
- **HookSpecificOutput type** updated: added `worktreePath` field for WorktreeCreate HTTP

---

## [7.23.0] - 2026-03-25

### Added

- **CC 2.1.83 adoption — Tier 1 quick wins**:
  - `sandbox.failIfUnavailable: true` — fail-fast when sandbox runtime unavailable instead of running unsandboxed
  - `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` — strip Anthropic/cloud credentials from all subprocess environments (Bash, hooks, MCP servers)
  - `initialPrompt` for all 15 background agents — zero-wasted-turn bootstrap on spawn
  - `userConfig` with `sensitive:true` — keychain-backed webhook token storage via manifest
- **RTK proxy compatibility** — git-validator and guardGitCommand now strip `rtk ` prefix before pattern matching, ensuring commit/branch validation works with RTK-rewritten commands

### Changed

- **Deprecated `TaskOutput` removed** from 6 agents (eval-runner, release-engineer, monitoring-engineer, data-pipeline-engineer, market-intelligence, web-research-analyst) — replaced by `Read` on background task output file per CC 2.1.83 deprecation
- **CC version requirement** bumped to >= 2.1.83 (from >= 2.1.81)

---

## [7.22.1] - 2026-03-24

### Fixed

- **YAML parser `>-` folded scalar support**: `parse-frontmatter.js` now handles `>-`, `|-`, `>`, `|` multiline scalars — prevents "description too short (2 chars)" CI failures for new skills/agents
- **test-cases.json 100% coverage**: created missing test-cases.json for 8 skills (component-search, cover, design-context-extract, testing-e2e, testing-llm, testing-patterns, testing-perf, testing-unit)

### Added

- **Pre-commit frontmatter schema validator**: checks agent required fields (category, context, mcpServers, description ≤250 bytes) and skill required fields before commit
- **Pre-commit test-case rule validator**: verifies each `rule:` reference in test-cases.json has a matching `rules/*.md` file
- **MDX count drift scanner** (`bin/validate-mdx-counts.sh`): detects stale hardcoded total counts in docs
- **Parser test suite**: 10 tests covering all YAML scalar types

---


## [7.22.0] - 2026-03-23

### Added

- **json-render + emulate integration** (Milestone #98): 4 new skills, 2 agents, 3 skill upgrades wrapping Vercel Labs' json-render (AI-safe GenUI) and emulate (stateful API emulation)
  - `json-render-catalog` skill: Zod-typed component catalogs for AI-safe UI generation, 36 shadcn components, YAML token optimization
  - `emulate-seed` skill: stateful API emulation config generation for GitHub (:4001), Vercel (:4000), Google OAuth (:4002)
  - `mcp-visual-output` skill: interactive dashboards via @json-render/mcp in Claude/Cursor conversations
  - `multi-surface-render` skill: same JSON spec renders to React, PDF, email, Remotion video, OG images
  - `genui-architect` agent: json-render catalog design specialist
  - `emulate-engineer` agent: stateful API emulation specialist

### Changed

- `ai-ui-generation`: json-render added as **first choice** option alongside v0/Bolt/Cursor
- `testing-integration`: emulate added as **first choice** for GitHub/Vercel/Google API tests (new `emulate-stateful-testing` rule)
- `testing-e2e`: emulate backends for Playwright E2E (new `emulate-e2e` rule with port isolation)
- `design-to-code`: Stage 4 RENDER added — register adapted components as json-render catalog entries
- Component counts: 94→98 skills, 33→35 agents

### Fixed

- `ai-review-checklist.md`: impact value `CRITICAL` → `HIGH` (invalid enum)
- `integration-api.md`: trimmed from 165 to 140 lines (was over 150 limit)
- Added missing `test-cases.json` for `testing-integration` and `design-to-code` skills
- Quoted `impactDescription` in 3 rule files for YAML consistency

---

## [7.21.1] - 2026-03-22

### Fixed

- **Brace expansion false positive on jq syntax**: `--jq '{name, os, status}'` was blocked as "brace expansion with command-like pattern". Bash brace expansion requires NO spaces between elements (`{cat,/etc/passwd}`), so spaced patterns (`{name, os}`) and JSON/jq colon syntax (`{key: .value}`) are now correctly allowed.

---

## [7.21.0] - 2026-03-21

### Added

- **Portless + agent-browser in debug workflows**: all debug-related skills/agents now instruct to use Portless named URLs and agent-browser for visual inspection
  - `debug-investigator` agent: service discovery step, visual inspection, updated examples
  - `fix-issue` skill: service discovery + agent-browser phase before hypothesis formation
  - `errors` skill: ECONNREFUSED/connection refused pattern with Portless fix
  - `doctor` skill: Portless health check in external dependencies
  - `performance` skill: local profiling target section with Portless URLs
  - `browser-tools` skill: new `portless-local-dev` rule file with incorrect/correct patterns
- **CC 2.1.81 integration**: `--bare` mode for eval pipeline, version-compatibility matrix, configure skill docs
- **bare-eval skill**: new skill for isolated eval/grading calls using `--bare` (SKILL.md, 3 references, 3 rules, test-cases.json)
- **triggers: frontmatter**: all 20 user-invocable skills declare keywords, examples, and anti-triggers
- **test-trigger-keywords.sh**: deterministic keyword-based trigger matching — $0, 5 seconds, 17/17 pass (replaces $3/45min LLM classifier)
- **Content hash cache**: skip re-eval if SKILL.md + .eval.yaml unchanged (`--force` to bypass)
- **`--changed` mode**: git-diff eval — only eval skills changed vs main (ideal for CI)
- **`--skip-baseline --force-skill`**: fastest quality eval mode (1 call per prompt instead of 3)

### Changed

- Default eval model: **Haiku** for all generation AND grading (was Sonnet — 12x cost reduction)
- Trigger reps: 5→3 (95%+ detection with 40% fewer calls)
- Trigger eval: parallel prompt execution (6 workers via `EVAL_MAX_PARALLEL`), skip non-invocable skills
- Trigger timeout: 120s→60s for classification calls
- agent-browser safety: allow localhost, 127.0.0.1, and *.localhost URLs (dev servers should never be blocked)
- Min CC version: >= 2.1.81 (was 2.1.80)

### Fixed

- **Hook resilience — 5 fail-silent bugs made visible**:
  - `run-hook.mjs`: stderr warning when stdin >512KB truncated (was silent data loss)
  - `run-hook.mjs`: stderr warning when truncated JSON falls back to `{}` (was silent no-op)
  - `run-hook.mjs`: appendFile error callbacks replace fire-and-forget `() => {}` (was silent write failure)
  - `run-hook.mjs`: session ID validation strengthened to UUID + smart-ID structural patterns (was permissive regex)
  - `stop-failure-handler`: tries fallback field names, logs available keys when reason unknown (was always "unknown")
  - `unified-dispatcher`: webhook health check on SessionStart — warns if endpoint unreachable
- agent-browser blocking localhost:PORT and 127.0.0.1:PORT URLs
- Keyword collision: "grade" removed from verify (owned by assess)
- `set -e` crash on `((x++))` when x=0 in trigger test
- Agent frontmatter test labels updated from stale "CC 2.1.6 compliant" to "valid"

---

## [7.20.0] - 2026-03-21

### Added

- feat(eval): unified `npm run eval:skill` command — trigger + quality in one command per skill
- feat(eval): `npm run eval:optimize-desc` — iterative description improvement with train/test split
- feat(eval): `check-eval-regression.sh` — CI regression gate comparing eval baselines (no API calls)

---


## [7.19.0](https://github.com/yonatangross/orchestkit/compare/v7.18.0...v7.19.0) (2026-03-21)


### Features

* add ci-automation skill + GitHub Actions workflows ([#1006](https://github.com/yonatangross/orchestkit/issues/1006)) ([8b328a7](https://github.com/yonatangross/orchestkit/commit/8b328a7dc3e06428c17b2349dae1d8b92eb57350))
* CC 2.1.78 adoption — StopFailure, PLUGIN_DATA, effort frontmatter, worktree ([#1104](https://github.com/yonatangross/orchestkit/issues/1104)) ([de50151](https://github.com/yonatangross/orchestkit/commit/de501510ea39940312a74efe30270c634332f413))
* **compat:** update OrchestKit for CC 2.1.80 features ([#1124](https://github.com/yonatangross/orchestkit/issues/1124)) ([1f0e578](https://github.com/yonatangross/orchestkit/commit/1f0e578a27f2aa953d18784ab77362950d73a8c6))
* **cover:** add /ork:cover skill + bump to 7.11.0 ([#1096](https://github.com/yonatangross/orchestkit/issues/1096)) ([36f14c6](https://github.com/yonatangross/orchestkit/commit/36f14c6f3266460a5a1afe14e1927bba2fa0a948))
* **docs:** docs site overhaul — CTA, categories, sidebar, dep graph, quiz ([#1114](https://github.com/yonatangross/orchestkit/issues/1114)) ([edd84e5](https://github.com/yonatangross/orchestkit/commit/edd84e545c4955c06d99ca0e19ff625e6506ac90))
* **docs:** integrate @yonatan-hq/analytics for cross-project tracking ([#1090](https://github.com/yonatangross/orchestkit/issues/1090)) ([3e294dc](https://github.com/yonatangross/orchestkit/commit/3e294dce69fbf112d48b4b1521383c398e871f29))
* **eval:** Sprint 1 — trigger runner + CONTRIBUTING-SKILLS eval docs ([#1065](https://github.com/yonatangross/orchestkit/issues/1065)) ([8d845c7](https://github.com/yonatangross/orchestkit/commit/8d845c7090ff8d799789ff1b24c34360261c8f49))
* **notebooklm:** update skill for notebooklm-mcp-cli v0.4.8 ([#1094](https://github.com/yonatangross/orchestkit/issues/1094)) ([0b72024](https://github.com/yonatangross/orchestkit/commit/0b72024d3a866bd4fb43daa2ed2f6bc79e1e9c07))
* **skills:** add 13 cognitive-science UX rules across 5 existing skills ([#1011](https://github.com/yonatangross/orchestkit/issues/1011)) ([91b62ac](https://github.com/yonatangross/orchestkit/commit/91b62ac1ab43a1d3296b84e05b402d0102600531))
* **skills:** adopt CC 2.1.72 features — ExitWorktree, model override ([#1036](https://github.com/yonatangross/orchestkit/issues/1036)) ([#1060](https://github.com/yonatangross/orchestkit/issues/1060)) ([96fd3a0](https://github.com/yonatangross/orchestkit/commit/96fd3a0ece399e3f843b11d3f018a0792eea9d46))
* **skills:** skills health — CC 2.1.72 alignment (all phases) ([#1040](https://github.com/yonatangross/orchestkit/issues/1040)) ([b9db695](https://github.com/yonatangross/orchestkit/commit/b9db695763654ade01009ad439a16b7cd6179121))
* **skills:** update notebooklm skill for v0.5.2 + cinematic video ([#1130](https://github.com/yonatangross/orchestkit/issues/1130)) ([28d3726](https://github.com/yonatangross/orchestkit/commit/28d37263c5fa11257cf781843e1d8b6520ed3adf))
* **skills:** version management — renamed_from, targets, ref validation ([#1132](https://github.com/yonatangross/orchestkit/issues/1132)) ([2766fd9](https://github.com/yonatangross/orchestkit/commit/2766fd91f8c82a8ee88e3b2d2dac4f4b0072e76b))
* Sprint 2 Wave A — eval runner, 1M context GA, RFC 9457 agent errors (v7.6.0) ([#1067](https://github.com/yonatangross/orchestkit/issues/1067)) ([12968a5](https://github.com/yonatangross/orchestkit/commit/12968a54e86446bf83773f0e098cf48f3c95ae9d))


### Bug Fixes

* **ci:** add bootstrap-sha to release-please config ([#997](https://github.com/yonatangross/orchestkit/issues/997)) ([0d46843](https://github.com/yonatangross/orchestkit/commit/0d468437e75ffc7d3842f46972bd19836c565435))
* **ci:** add plugins[0].version to release-please extra-files ([#1001](https://github.com/yonatangross/orchestkit/issues/1001)) ([8a4faad](https://github.com/yonatangross/orchestkit/commit/8a4faadf651d822d3c4e748360a27ca23cc9af14))
* **ci:** auto-bump docs site version on release ([#1117](https://github.com/yonatangross/orchestkit/issues/1117)) ([ddf5f3b](https://github.com/yonatangross/orchestkit/commit/ddf5f3bb17e41f19669442a4c3e120efb871deb6))
* **docs:** fix hooks spotlights generation in build script ([#1126](https://github.com/yonatangross/orchestkit/issues/1126)) ([c74ebf4](https://github.com/yonatangross/orchestkit/commit/c74ebf4f38d876134ebd19b0c44d2353f863f584))
* **docs:** parse release-please changelog format in data generator ([#1128](https://github.com/yonatangross/orchestkit/issues/1128)) ([6efbf19](https://github.com/yonatangross/orchestkit/commit/6efbf19f62b46ec5123bd44de3754b94136096fb))
* **docs:** replace broken ASCII diagrams with fumadocs Steps ([#999](https://github.com/yonatangross/orchestkit/issues/999)) ([2c1b6fe](https://github.com/yonatangross/orchestkit/commit/2c1b6fee670c4e1c8be2855bb23596792f354874))
* **docs:** update CC version requirement from 2.1.72 to 2.1.74 ([#1062](https://github.com/yonatangross/orchestkit/issues/1062)) ([622ba4c](https://github.com/yonatangross/orchestkit/commit/622ba4cfa0d5d4b9b1707c2f93897a311b3a1586))
* **docs:** update generated plugins-data version to 7.2.0 ([#1012](https://github.com/yonatangross/orchestkit/issues/1012)) ([dca7243](https://github.com/yonatangross/orchestkit/commit/dca72432fd9982b3457d3423aad1124155a94584))
* **docs:** update generated plugins-data version to 7.4.0 ([#1058](https://github.com/yonatangross/orchestkit/issues/1058)) ([e2693b1](https://github.com/yonatangross/orchestkit/commit/e2693b16b3f8cddb40348b5790611a004f37009e))
* **security:** resolve CodeQL and Scorecard alerts ([#1027](https://github.com/yonatangross/orchestkit/issues/1027)) ([ab9136c](https://github.com/yonatangross/orchestkit/commit/ab9136c09593632a9c10a7d44ca4c9799df297ed))
* **security:** resolve yauzl CVE and pinned-dependencies alert ([#1101](https://github.com/yonatangross/orchestkit/issues/1101)) ([d96d68d](https://github.com/yonatangross/orchestkit/commit/d96d68d1bbaf55a8f41e982b0debfcf71fc792a6))
* **skills:** add ExitWorktree + model override to Agent Teams teardown paths ([#1061](https://github.com/yonatangross/orchestkit/issues/1061)) ([c326666](https://github.com/yonatangross/orchestkit/commit/c3266663634912450ed965fae5ca6df752019705))


### Miscellaneous

* **deps-dev:** bump flatted ([#1119](https://github.com/yonatangross/orchestkit/issues/1119)) ([5aa1606](https://github.com/yonatangross/orchestkit/commit/5aa16068568f732a28a1ae639c832f5bcea0045c))
* **deps-dev:** bump the npm_and_yarn group across 2 directories with 1 update ([#1025](https://github.com/yonatangross/orchestkit/issues/1025)) ([f924b27](https://github.com/yonatangross/orchestkit/commit/f924b27a7ef02dd1f53be0400390d4a1f4d4600c))
* fix hono CVE + organize playgrounds by date ([#1039](https://github.com/yonatangross/orchestkit/issues/1039)) ([b43cf2d](https://github.com/yonatangross/orchestkit/commit/b43cf2dc8f9d62d54b727de72928e123c2330e51))
* **main:** release 7.1.10 ([#1000](https://github.com/yonatangross/orchestkit/issues/1000)) ([d0c48a1](https://github.com/yonatangross/orchestkit/commit/d0c48a1f8f135fa741bb16a39166c1f0e5ebc965))
* **main:** release 7.1.7 ([#998](https://github.com/yonatangross/orchestkit/issues/998)) ([c4607ad](https://github.com/yonatangross/orchestkit/commit/c4607ad811ec43b9cd6dc5ac323af953eca4096a))
* **main:** release 7.11.0 ([#1099](https://github.com/yonatangross/orchestkit/issues/1099)) ([d20b85d](https://github.com/yonatangross/orchestkit/commit/d20b85dc2391eeeb32f3c140900ab38ff83e901b))
* **main:** release 7.11.1 ([#1102](https://github.com/yonatangross/orchestkit/issues/1102)) ([4716cfe](https://github.com/yonatangross/orchestkit/commit/4716cfe837663fc7170b8e6bcb19d585bb05e6ce))
* **main:** release 7.14.0 ([#1115](https://github.com/yonatangross/orchestkit/issues/1115)) ([648cdea](https://github.com/yonatangross/orchestkit/commit/648cdea25943c7377b1fede0fe208d5e47583c9d))
* **main:** release 7.14.1 ([#1118](https://github.com/yonatangross/orchestkit/issues/1118)) ([93002f3](https://github.com/yonatangross/orchestkit/commit/93002f3235042fecb6c2d4be2abecf1d200a8fc0))
* **main:** release 7.16.0 ([#1125](https://github.com/yonatangross/orchestkit/issues/1125)) ([6c86fe6](https://github.com/yonatangross/orchestkit/commit/6c86fe696eda1856cbd5f0050471599c68ab21c9))
* **main:** release 7.16.1 ([#1127](https://github.com/yonatangross/orchestkit/issues/1127)) ([ac3879f](https://github.com/yonatangross/orchestkit/commit/ac3879f2cc55e3f318c52e582326eccd1665935b))
* **main:** release 7.16.2 ([#1129](https://github.com/yonatangross/orchestkit/issues/1129)) ([c48d70b](https://github.com/yonatangross/orchestkit/commit/c48d70b90bb2dbc1df66f6f430c0f24629e60abf))
* **main:** release 7.17.0 ([#1131](https://github.com/yonatangross/orchestkit/issues/1131)) ([e2e42f4](https://github.com/yonatangross/orchestkit/commit/e2e42f4e975d4df85070a2c901889896ae5fcfb3))
* **main:** release 7.2.0 ([#1010](https://github.com/yonatangross/orchestkit/issues/1010)) ([a6420bb](https://github.com/yonatangross/orchestkit/commit/a6420bbd4c50e234ccad3eeba676846e36b68a3d))
* **main:** release 7.2.1 ([#1013](https://github.com/yonatangross/orchestkit/issues/1013)) ([2a83685](https://github.com/yonatangross/orchestkit/commit/2a8368559de636960593f3258e79afeb511d3311))
* **main:** release 7.3.0 ([#1024](https://github.com/yonatangross/orchestkit/issues/1024)) ([490317f](https://github.com/yonatangross/orchestkit/commit/490317fdc2c397f54a9bd067edc7ecd4043b0777))
* **main:** release 7.3.1 ([#1026](https://github.com/yonatangross/orchestkit/issues/1026)) ([363a44f](https://github.com/yonatangross/orchestkit/commit/363a44fcb9f69c4866a6e3fa7bde9ee4be4b2b26))
* **main:** release 7.3.2 ([#1028](https://github.com/yonatangross/orchestkit/issues/1028)) ([9f67f37](https://github.com/yonatangross/orchestkit/commit/9f67f378c1aa81a9653b5c6a1a482eba7870d4de))
* **main:** release 7.4.0 ([#1057](https://github.com/yonatangross/orchestkit/issues/1057)) ([f8a7bfd](https://github.com/yonatangross/orchestkit/commit/f8a7bfde3221cf196bc7ec8678d7301278777ce3))
* **main:** release 7.5.0 ([#1059](https://github.com/yonatangross/orchestkit/issues/1059)) ([059f43d](https://github.com/yonatangross/orchestkit/commit/059f43d19db7fa61d4a01eafadc73077e615e248))
* **main:** release 7.5.1 ([#1063](https://github.com/yonatangross/orchestkit/issues/1063)) ([6c14540](https://github.com/yonatangross/orchestkit/commit/6c145408a4f3bda6cc6f74c403b33a0622f4c024))
* **main:** release 7.9.0 ([#1066](https://github.com/yonatangross/orchestkit/issues/1066)) ([8aa0b27](https://github.com/yonatangross/orchestkit/commit/8aa0b2763d9f458680fba777905414ee83a252f8))
* override release-please to 7.9.1 ([#1093](https://github.com/yonatangross/orchestkit/issues/1093)) ([caa4efd](https://github.com/yonatangross/orchestkit/commit/caa4efd87a0afa640f2e63d7c2aecc508dcf3f33))
* pin release-as to 7.11.0 ([#1100](https://github.com/yonatangross/orchestkit/issues/1100)) ([06acb3f](https://github.com/yonatangross/orchestkit/commit/06acb3fdf8e7bc3020bae216e8c94d5af3887ad5))
* remove release-as pin after 7.11.0 release ([#1103](https://github.com/yonatangross/orchestkit/issues/1103)) ([5fd681c](https://github.com/yonatangross/orchestkit/commit/5fd681cf73bf1362c4b4fd254c4100e86185f51e))


### Documentation

* update README What's New to v7.18.0, link to docs site changelog ([#1134](https://github.com/yonatangross/orchestkit/issues/1134)) ([d8aebef](https://github.com/yonatangross/orchestkit/commit/d8aebef11f99b45f20261a52c96059b91dd74318))


### Code Refactoring

* split testing-patterns, CC 2.1.72 upgrade, HTTP hooks fix ([#1015](https://github.com/yonatangross/orchestkit/issues/1015)) ([7bcab43](https://github.com/yonatangross/orchestkit/commit/7bcab430a21abdaaba714b8c7153351877387646))


### CI/CD

* bump actions/download-artifact from 8.0.0 to 8.0.1 ([#1097](https://github.com/yonatangross/orchestkit/issues/1097)) ([ac52e6a](https://github.com/yonatangross/orchestkit/commit/ac52e6a47089114ec454c1a3e34c779432c49810))
* bump actions/setup-node from 6.2.0 to 6.3.0 ([#1008](https://github.com/yonatangross/orchestkit/issues/1008)) ([61f73f5](https://github.com/yonatangross/orchestkit/commit/61f73f5f49327e0a773110aefb387d4b2bb2113b))
* bump github/codeql-action from 4.32.4 to 4.32.6 ([#1009](https://github.com/yonatangross/orchestkit/issues/1009)) ([13a0975](https://github.com/yonatangross/orchestkit/commit/13a097584115d899681c321d15e2b8c05bda68ac))
* update anthropics/claude-code-action requirement to 26ec041249acb0a944c0a47b6c0c13f05dbc5b44 ([#1098](https://github.com/yonatangross/orchestkit/issues/1098)) ([8a7600e](https://github.com/yonatangross/orchestkit/commit/8a7600e2b9270547dcfc522d95dde26e9b8f3bc3))

## [7.18.0] - 2026-03-21

### Added

- feat(skills): `targets` frontmatter with library version ranges on 14 skills
- test: validate all `skills:` cross-references point to existing skills (93 refs)
- test: validate `targets:` entries have library declarations

---


## [7.17.0](https://github.com/yonatangross/orchestkit/compare/v7.16.2...v7.17.0) (2026-03-21)


### Features

* **skills:** update notebooklm skill for v0.5.2 + cinematic video ([#1130](https://github.com/yonatangross/orchestkit/issues/1130)) ([28d3726](https://github.com/yonatangross/orchestkit/commit/28d37263c5fa11257cf781843e1d8b6520ed3adf))

## [7.16.2](https://github.com/yonatangross/orchestkit/compare/v7.16.1...v7.16.2) (2026-03-20)


### Bug Fixes

* **docs:** parse release-please changelog format in data generator ([#1128](https://github.com/yonatangross/orchestkit/issues/1128)) ([6efbf19](https://github.com/yonatangross/orchestkit/commit/6efbf19f62b46ec5123bd44de3754b94136096fb))

## [7.16.1](https://github.com/yonatangross/orchestkit/compare/v7.16.0...v7.16.1) (2026-03-20)


### Miscellaneous

* **deps-dev:** bump flatted ([#1119](https://github.com/yonatangross/orchestkit/issues/1119)) ([5aa1606](https://github.com/yonatangross/orchestkit/commit/5aa16068568f732a28a1ae639c832f5bcea0045c))

## [7.16.0](https://github.com/yonatangross/orchestkit/compare/v7.15.0...v7.16.0) (2026-03-20)


### Features

* add ci-automation skill + GitHub Actions workflows ([#1006](https://github.com/yonatangross/orchestkit/issues/1006)) ([8b328a7](https://github.com/yonatangross/orchestkit/commit/8b328a7dc3e06428c17b2349dae1d8b92eb57350))
* CC 2.1.78 adoption — StopFailure, PLUGIN_DATA, effort frontmatter, worktree ([#1104](https://github.com/yonatangross/orchestkit/issues/1104)) ([de50151](https://github.com/yonatangross/orchestkit/commit/de501510ea39940312a74efe30270c634332f413))
* **compat:** update OrchestKit for CC 2.1.80 features ([#1124](https://github.com/yonatangross/orchestkit/issues/1124)) ([1f0e578](https://github.com/yonatangross/orchestkit/commit/1f0e578a27f2aa953d18784ab77362950d73a8c6))
* **cover:** add /ork:cover skill + bump to 7.11.0 ([#1096](https://github.com/yonatangross/orchestkit/issues/1096)) ([36f14c6](https://github.com/yonatangross/orchestkit/commit/36f14c6f3266460a5a1afe14e1927bba2fa0a948))
* **docs:** docs site overhaul — CTA, categories, sidebar, dep graph, quiz ([#1114](https://github.com/yonatangross/orchestkit/issues/1114)) ([edd84e5](https://github.com/yonatangross/orchestkit/commit/edd84e545c4955c06d99ca0e19ff625e6506ac90))
* **docs:** integrate @yonatan-hq/analytics for cross-project tracking ([#1090](https://github.com/yonatangross/orchestkit/issues/1090)) ([3e294dc](https://github.com/yonatangross/orchestkit/commit/3e294dce69fbf112d48b4b1521383c398e871f29))
* **eval:** Sprint 1 — trigger runner + CONTRIBUTING-SKILLS eval docs ([#1065](https://github.com/yonatangross/orchestkit/issues/1065)) ([8d845c7](https://github.com/yonatangross/orchestkit/commit/8d845c7090ff8d799789ff1b24c34360261c8f49))
* **notebooklm:** update skill for notebooklm-mcp-cli v0.4.8 ([#1094](https://github.com/yonatangross/orchestkit/issues/1094)) ([0b72024](https://github.com/yonatangross/orchestkit/commit/0b72024d3a866bd4fb43daa2ed2f6bc79e1e9c07))
* **skills:** add 13 cognitive-science UX rules across 5 existing skills ([#1011](https://github.com/yonatangross/orchestkit/issues/1011)) ([91b62ac](https://github.com/yonatangross/orchestkit/commit/91b62ac1ab43a1d3296b84e05b402d0102600531))
* **skills:** adopt CC 2.1.72 features — ExitWorktree, model override ([#1036](https://github.com/yonatangross/orchestkit/issues/1036)) ([#1060](https://github.com/yonatangross/orchestkit/issues/1060)) ([96fd3a0](https://github.com/yonatangross/orchestkit/commit/96fd3a0ece399e3f843b11d3f018a0792eea9d46))
* **skills:** skills health — CC 2.1.72 alignment (all phases) ([#1040](https://github.com/yonatangross/orchestkit/issues/1040)) ([b9db695](https://github.com/yonatangross/orchestkit/commit/b9db695763654ade01009ad439a16b7cd6179121))
* Sprint 2 Wave A — eval runner, 1M context GA, RFC 9457 agent errors (v7.6.0) ([#1067](https://github.com/yonatangross/orchestkit/issues/1067)) ([12968a5](https://github.com/yonatangross/orchestkit/commit/12968a54e86446bf83773f0e098cf48f3c95ae9d))


### Bug Fixes

* **ci:** add bootstrap-sha to release-please config ([#997](https://github.com/yonatangross/orchestkit/issues/997)) ([0d46843](https://github.com/yonatangross/orchestkit/commit/0d468437e75ffc7d3842f46972bd19836c565435))
* **ci:** add plugins[0].version to release-please extra-files ([#1001](https://github.com/yonatangross/orchestkit/issues/1001)) ([8a4faad](https://github.com/yonatangross/orchestkit/commit/8a4faadf651d822d3c4e748360a27ca23cc9af14))
* **ci:** auto-bump docs site version on release ([#1117](https://github.com/yonatangross/orchestkit/issues/1117)) ([ddf5f3b](https://github.com/yonatangross/orchestkit/commit/ddf5f3bb17e41f19669442a4c3e120efb871deb6))
* **docs:** fix hooks spotlights generation in build script ([#1126](https://github.com/yonatangross/orchestkit/issues/1126)) ([c74ebf4](https://github.com/yonatangross/orchestkit/commit/c74ebf4f38d876134ebd19b0c44d2353f863f584))
* **docs:** replace broken ASCII diagrams with fumadocs Steps ([#999](https://github.com/yonatangross/orchestkit/issues/999)) ([2c1b6fe](https://github.com/yonatangross/orchestkit/commit/2c1b6fee670c4e1c8be2855bb23596792f354874))
* **docs:** update CC version requirement from 2.1.72 to 2.1.74 ([#1062](https://github.com/yonatangross/orchestkit/issues/1062)) ([622ba4c](https://github.com/yonatangross/orchestkit/commit/622ba4cfa0d5d4b9b1707c2f93897a311b3a1586))
* **docs:** update generated plugins-data version to 7.2.0 ([#1012](https://github.com/yonatangross/orchestkit/issues/1012)) ([dca7243](https://github.com/yonatangross/orchestkit/commit/dca72432fd9982b3457d3423aad1124155a94584))
* **docs:** update generated plugins-data version to 7.4.0 ([#1058](https://github.com/yonatangross/orchestkit/issues/1058)) ([e2693b1](https://github.com/yonatangross/orchestkit/commit/e2693b16b3f8cddb40348b5790611a004f37009e))
* **security:** resolve CodeQL and Scorecard alerts ([#1027](https://github.com/yonatangross/orchestkit/issues/1027)) ([ab9136c](https://github.com/yonatangross/orchestkit/commit/ab9136c09593632a9c10a7d44ca4c9799df297ed))
* **security:** resolve yauzl CVE and pinned-dependencies alert ([#1101](https://github.com/yonatangross/orchestkit/issues/1101)) ([d96d68d](https://github.com/yonatangross/orchestkit/commit/d96d68d1bbaf55a8f41e982b0debfcf71fc792a6))
* **skills:** add ExitWorktree + model override to Agent Teams teardown paths ([#1061](https://github.com/yonatangross/orchestkit/issues/1061)) ([c326666](https://github.com/yonatangross/orchestkit/commit/c3266663634912450ed965fae5ca6df752019705))


### Miscellaneous

* **deps-dev:** bump the npm_and_yarn group across 2 directories with 1 update ([#1025](https://github.com/yonatangross/orchestkit/issues/1025)) ([f924b27](https://github.com/yonatangross/orchestkit/commit/f924b27a7ef02dd1f53be0400390d4a1f4d4600c))
* fix hono CVE + organize playgrounds by date ([#1039](https://github.com/yonatangross/orchestkit/issues/1039)) ([b43cf2d](https://github.com/yonatangross/orchestkit/commit/b43cf2dc8f9d62d54b727de72928e123c2330e51))
* **main:** release 7.1.10 ([#1000](https://github.com/yonatangross/orchestkit/issues/1000)) ([d0c48a1](https://github.com/yonatangross/orchestkit/commit/d0c48a1f8f135fa741bb16a39166c1f0e5ebc965))
* **main:** release 7.1.7 ([#998](https://github.com/yonatangross/orchestkit/issues/998)) ([c4607ad](https://github.com/yonatangross/orchestkit/commit/c4607ad811ec43b9cd6dc5ac323af953eca4096a))
* **main:** release 7.11.0 ([#1099](https://github.com/yonatangross/orchestkit/issues/1099)) ([d20b85d](https://github.com/yonatangross/orchestkit/commit/d20b85dc2391eeeb32f3c140900ab38ff83e901b))
* **main:** release 7.11.1 ([#1102](https://github.com/yonatangross/orchestkit/issues/1102)) ([4716cfe](https://github.com/yonatangross/orchestkit/commit/4716cfe837663fc7170b8e6bcb19d585bb05e6ce))
* **main:** release 7.14.0 ([#1115](https://github.com/yonatangross/orchestkit/issues/1115)) ([648cdea](https://github.com/yonatangross/orchestkit/commit/648cdea25943c7377b1fede0fe208d5e47583c9d))
* **main:** release 7.14.1 ([#1118](https://github.com/yonatangross/orchestkit/issues/1118)) ([93002f3](https://github.com/yonatangross/orchestkit/commit/93002f3235042fecb6c2d4be2abecf1d200a8fc0))
* **main:** release 7.2.0 ([#1010](https://github.com/yonatangross/orchestkit/issues/1010)) ([a6420bb](https://github.com/yonatangross/orchestkit/commit/a6420bbd4c50e234ccad3eeba676846e36b68a3d))
* **main:** release 7.2.1 ([#1013](https://github.com/yonatangross/orchestkit/issues/1013)) ([2a83685](https://github.com/yonatangross/orchestkit/commit/2a8368559de636960593f3258e79afeb511d3311))
* **main:** release 7.3.0 ([#1024](https://github.com/yonatangross/orchestkit/issues/1024)) ([490317f](https://github.com/yonatangross/orchestkit/commit/490317fdc2c397f54a9bd067edc7ecd4043b0777))
* **main:** release 7.3.1 ([#1026](https://github.com/yonatangross/orchestkit/issues/1026)) ([363a44f](https://github.com/yonatangross/orchestkit/commit/363a44fcb9f69c4866a6e3fa7bde9ee4be4b2b26))
* **main:** release 7.3.2 ([#1028](https://github.com/yonatangross/orchestkit/issues/1028)) ([9f67f37](https://github.com/yonatangross/orchestkit/commit/9f67f378c1aa81a9653b5c6a1a482eba7870d4de))
* **main:** release 7.4.0 ([#1057](https://github.com/yonatangross/orchestkit/issues/1057)) ([f8a7bfd](https://github.com/yonatangross/orchestkit/commit/f8a7bfde3221cf196bc7ec8678d7301278777ce3))
* **main:** release 7.5.0 ([#1059](https://github.com/yonatangross/orchestkit/issues/1059)) ([059f43d](https://github.com/yonatangross/orchestkit/commit/059f43d19db7fa61d4a01eafadc73077e615e248))
* **main:** release 7.5.1 ([#1063](https://github.com/yonatangross/orchestkit/issues/1063)) ([6c14540](https://github.com/yonatangross/orchestkit/commit/6c145408a4f3bda6cc6f74c403b33a0622f4c024))
* **main:** release 7.9.0 ([#1066](https://github.com/yonatangross/orchestkit/issues/1066)) ([8aa0b27](https://github.com/yonatangross/orchestkit/commit/8aa0b2763d9f458680fba777905414ee83a252f8))
* override release-please to 7.9.1 ([#1093](https://github.com/yonatangross/orchestkit/issues/1093)) ([caa4efd](https://github.com/yonatangross/orchestkit/commit/caa4efd87a0afa640f2e63d7c2aecc508dcf3f33))
* pin release-as to 7.11.0 ([#1100](https://github.com/yonatangross/orchestkit/issues/1100)) ([06acb3f](https://github.com/yonatangross/orchestkit/commit/06acb3fdf8e7bc3020bae216e8c94d5af3887ad5))
* remove release-as pin after 7.11.0 release ([#1103](https://github.com/yonatangross/orchestkit/issues/1103)) ([5fd681c](https://github.com/yonatangross/orchestkit/commit/5fd681cf73bf1362c4b4fd254c4100e86185f51e))


### Code Refactoring

* split testing-patterns, CC 2.1.72 upgrade, HTTP hooks fix ([#1015](https://github.com/yonatangross/orchestkit/issues/1015)) ([7bcab43](https://github.com/yonatangross/orchestkit/commit/7bcab430a21abdaaba714b8c7153351877387646))


### CI/CD

* bump actions/download-artifact from 8.0.0 to 8.0.1 ([#1097](https://github.com/yonatangross/orchestkit/issues/1097)) ([ac52e6a](https://github.com/yonatangross/orchestkit/commit/ac52e6a47089114ec454c1a3e34c779432c49810))
* bump actions/setup-node from 6.2.0 to 6.3.0 ([#1008](https://github.com/yonatangross/orchestkit/issues/1008)) ([61f73f5](https://github.com/yonatangross/orchestkit/commit/61f73f5f49327e0a773110aefb387d4b2bb2113b))
* bump github/codeql-action from 4.32.4 to 4.32.6 ([#1009](https://github.com/yonatangross/orchestkit/issues/1009)) ([13a0975](https://github.com/yonatangross/orchestkit/commit/13a097584115d899681c321d15e2b8c05bda68ac))
* update anthropics/claude-code-action requirement to 26ec041249acb0a944c0a47b6c0c13f05dbc5b44 ([#1098](https://github.com/yonatangross/orchestkit/issues/1098)) ([8a7600e](https://github.com/yonatangross/orchestkit/commit/8a7600e2b9270547dcfc522d95dde26e9b8f3bc3))

## [7.15.0] - 2026-03-20

### Added

- feat(skills): effort frontmatter on 40 skills — CC 2.1.80 overrides model effort level (18 high, 22 low)
- feat(hooks): rate_limits display in statusline — shows rate limit usage alongside context percentage
- feat(compat): version-compatibility matrix updated with 13 CC 2.1.80 entries
- docs: simplified plugin install commands (`/plugin install` single-step flow)

---


## [7.14.1](https://github.com/yonatangross/orchestkit/compare/v7.14.0...v7.14.1) (2026-03-19)


### Bug Fixes

* **ci:** auto-bump docs site version on release ([#1117](https://github.com/yonatangross/orchestkit/issues/1117)) ([ddf5f3b](https://github.com/yonatangross/orchestkit/commit/ddf5f3bb17e41f19669442a4c3e120efb871deb6))

## [7.14.0](https://github.com/yonatangross/orchestkit/compare/v7.13.0...v7.14.0) (2026-03-19)


### Features

* add ci-automation skill + GitHub Actions workflows ([#1006](https://github.com/yonatangross/orchestkit/issues/1006)) ([8b328a7](https://github.com/yonatangross/orchestkit/commit/8b328a7dc3e06428c17b2349dae1d8b92eb57350))
* CC 2.1.78 adoption — StopFailure, PLUGIN_DATA, effort frontmatter, worktree ([#1104](https://github.com/yonatangross/orchestkit/issues/1104)) ([de50151](https://github.com/yonatangross/orchestkit/commit/de501510ea39940312a74efe30270c634332f413))
* **cover:** add /ork:cover skill + bump to 7.11.0 ([#1096](https://github.com/yonatangross/orchestkit/issues/1096)) ([36f14c6](https://github.com/yonatangross/orchestkit/commit/36f14c6f3266460a5a1afe14e1927bba2fa0a948))
* **docs:** docs site overhaul — CTA, categories, sidebar, dep graph, quiz ([#1114](https://github.com/yonatangross/orchestkit/issues/1114)) ([edd84e5](https://github.com/yonatangross/orchestkit/commit/edd84e545c4955c06d99ca0e19ff625e6506ac90))
* **docs:** integrate @yonatan-hq/analytics for cross-project tracking ([#1090](https://github.com/yonatangross/orchestkit/issues/1090)) ([3e294dc](https://github.com/yonatangross/orchestkit/commit/3e294dce69fbf112d48b4b1521383c398e871f29))
* **eval:** Sprint 1 — trigger runner + CONTRIBUTING-SKILLS eval docs ([#1065](https://github.com/yonatangross/orchestkit/issues/1065)) ([8d845c7](https://github.com/yonatangross/orchestkit/commit/8d845c7090ff8d799789ff1b24c34360261c8f49))
* **notebooklm:** update skill for notebooklm-mcp-cli v0.4.8 ([#1094](https://github.com/yonatangross/orchestkit/issues/1094)) ([0b72024](https://github.com/yonatangross/orchestkit/commit/0b72024d3a866bd4fb43daa2ed2f6bc79e1e9c07))
* **skills:** add 13 cognitive-science UX rules across 5 existing skills ([#1011](https://github.com/yonatangross/orchestkit/issues/1011)) ([91b62ac](https://github.com/yonatangross/orchestkit/commit/91b62ac1ab43a1d3296b84e05b402d0102600531))
* **skills:** adopt CC 2.1.72 features — ExitWorktree, model override ([#1036](https://github.com/yonatangross/orchestkit/issues/1036)) ([#1060](https://github.com/yonatangross/orchestkit/issues/1060)) ([96fd3a0](https://github.com/yonatangross/orchestkit/commit/96fd3a0ece399e3f843b11d3f018a0792eea9d46))
* **skills:** skills health — CC 2.1.72 alignment (all phases) ([#1040](https://github.com/yonatangross/orchestkit/issues/1040)) ([b9db695](https://github.com/yonatangross/orchestkit/commit/b9db695763654ade01009ad439a16b7cd6179121))
* Sprint 2 Wave A — eval runner, 1M context GA, RFC 9457 agent errors (v7.6.0) ([#1067](https://github.com/yonatangross/orchestkit/issues/1067)) ([12968a5](https://github.com/yonatangross/orchestkit/commit/12968a54e86446bf83773f0e098cf48f3c95ae9d))


### Bug Fixes

* **ci:** add bootstrap-sha to release-please config ([#997](https://github.com/yonatangross/orchestkit/issues/997)) ([0d46843](https://github.com/yonatangross/orchestkit/commit/0d468437e75ffc7d3842f46972bd19836c565435))
* **ci:** add plugins[0].version to release-please extra-files ([#1001](https://github.com/yonatangross/orchestkit/issues/1001)) ([8a4faad](https://github.com/yonatangross/orchestkit/commit/8a4faadf651d822d3c4e748360a27ca23cc9af14))
* **docs:** replace broken ASCII diagrams with fumadocs Steps ([#999](https://github.com/yonatangross/orchestkit/issues/999)) ([2c1b6fe](https://github.com/yonatangross/orchestkit/commit/2c1b6fee670c4e1c8be2855bb23596792f354874))
* **docs:** update CC version requirement from 2.1.72 to 2.1.74 ([#1062](https://github.com/yonatangross/orchestkit/issues/1062)) ([622ba4c](https://github.com/yonatangross/orchestkit/commit/622ba4cfa0d5d4b9b1707c2f93897a311b3a1586))
* **docs:** update generated plugins-data version to 7.2.0 ([#1012](https://github.com/yonatangross/orchestkit/issues/1012)) ([dca7243](https://github.com/yonatangross/orchestkit/commit/dca72432fd9982b3457d3423aad1124155a94584))
* **docs:** update generated plugins-data version to 7.4.0 ([#1058](https://github.com/yonatangross/orchestkit/issues/1058)) ([e2693b1](https://github.com/yonatangross/orchestkit/commit/e2693b16b3f8cddb40348b5790611a004f37009e))
* **security:** resolve CodeQL and Scorecard alerts ([#1027](https://github.com/yonatangross/orchestkit/issues/1027)) ([ab9136c](https://github.com/yonatangross/orchestkit/commit/ab9136c09593632a9c10a7d44ca4c9799df297ed))
* **security:** resolve yauzl CVE and pinned-dependencies alert ([#1101](https://github.com/yonatangross/orchestkit/issues/1101)) ([d96d68d](https://github.com/yonatangross/orchestkit/commit/d96d68d1bbaf55a8f41e982b0debfcf71fc792a6))
* **skills:** add ExitWorktree + model override to Agent Teams teardown paths ([#1061](https://github.com/yonatangross/orchestkit/issues/1061)) ([c326666](https://github.com/yonatangross/orchestkit/commit/c3266663634912450ed965fae5ca6df752019705))


### Miscellaneous

* **deps-dev:** bump the npm_and_yarn group across 2 directories with 1 update ([#1025](https://github.com/yonatangross/orchestkit/issues/1025)) ([f924b27](https://github.com/yonatangross/orchestkit/commit/f924b27a7ef02dd1f53be0400390d4a1f4d4600c))
* fix hono CVE + organize playgrounds by date ([#1039](https://github.com/yonatangross/orchestkit/issues/1039)) ([b43cf2d](https://github.com/yonatangross/orchestkit/commit/b43cf2dc8f9d62d54b727de72928e123c2330e51))
* **main:** release 7.1.10 ([#1000](https://github.com/yonatangross/orchestkit/issues/1000)) ([d0c48a1](https://github.com/yonatangross/orchestkit/commit/d0c48a1f8f135fa741bb16a39166c1f0e5ebc965))
* **main:** release 7.1.7 ([#998](https://github.com/yonatangross/orchestkit/issues/998)) ([c4607ad](https://github.com/yonatangross/orchestkit/commit/c4607ad811ec43b9cd6dc5ac323af953eca4096a))
* **main:** release 7.11.0 ([#1099](https://github.com/yonatangross/orchestkit/issues/1099)) ([d20b85d](https://github.com/yonatangross/orchestkit/commit/d20b85dc2391eeeb32f3c140900ab38ff83e901b))
* **main:** release 7.11.1 ([#1102](https://github.com/yonatangross/orchestkit/issues/1102)) ([4716cfe](https://github.com/yonatangross/orchestkit/commit/4716cfe837663fc7170b8e6bcb19d585bb05e6ce))
* **main:** release 7.2.0 ([#1010](https://github.com/yonatangross/orchestkit/issues/1010)) ([a6420bb](https://github.com/yonatangross/orchestkit/commit/a6420bbd4c50e234ccad3eeba676846e36b68a3d))
* **main:** release 7.2.1 ([#1013](https://github.com/yonatangross/orchestkit/issues/1013)) ([2a83685](https://github.com/yonatangross/orchestkit/commit/2a8368559de636960593f3258e79afeb511d3311))
* **main:** release 7.3.0 ([#1024](https://github.com/yonatangross/orchestkit/issues/1024)) ([490317f](https://github.com/yonatangross/orchestkit/commit/490317fdc2c397f54a9bd067edc7ecd4043b0777))
* **main:** release 7.3.1 ([#1026](https://github.com/yonatangross/orchestkit/issues/1026)) ([363a44f](https://github.com/yonatangross/orchestkit/commit/363a44fcb9f69c4866a6e3fa7bde9ee4be4b2b26))
* **main:** release 7.3.2 ([#1028](https://github.com/yonatangross/orchestkit/issues/1028)) ([9f67f37](https://github.com/yonatangross/orchestkit/commit/9f67f378c1aa81a9653b5c6a1a482eba7870d4de))
* **main:** release 7.4.0 ([#1057](https://github.com/yonatangross/orchestkit/issues/1057)) ([f8a7bfd](https://github.com/yonatangross/orchestkit/commit/f8a7bfde3221cf196bc7ec8678d7301278777ce3))
* **main:** release 7.5.0 ([#1059](https://github.com/yonatangross/orchestkit/issues/1059)) ([059f43d](https://github.com/yonatangross/orchestkit/commit/059f43d19db7fa61d4a01eafadc73077e615e248))
* **main:** release 7.5.1 ([#1063](https://github.com/yonatangross/orchestkit/issues/1063)) ([6c14540](https://github.com/yonatangross/orchestkit/commit/6c145408a4f3bda6cc6f74c403b33a0622f4c024))
* **main:** release 7.9.0 ([#1066](https://github.com/yonatangross/orchestkit/issues/1066)) ([8aa0b27](https://github.com/yonatangross/orchestkit/commit/8aa0b2763d9f458680fba777905414ee83a252f8))
* override release-please to 7.9.1 ([#1093](https://github.com/yonatangross/orchestkit/issues/1093)) ([caa4efd](https://github.com/yonatangross/orchestkit/commit/caa4efd87a0afa640f2e63d7c2aecc508dcf3f33))
* pin release-as to 7.11.0 ([#1100](https://github.com/yonatangross/orchestkit/issues/1100)) ([06acb3f](https://github.com/yonatangross/orchestkit/commit/06acb3fdf8e7bc3020bae216e8c94d5af3887ad5))
* remove release-as pin after 7.11.0 release ([#1103](https://github.com/yonatangross/orchestkit/issues/1103)) ([5fd681c](https://github.com/yonatangross/orchestkit/commit/5fd681cf73bf1362c4b4fd254c4100e86185f51e))


### Code Refactoring

* split testing-patterns, CC 2.1.72 upgrade, HTTP hooks fix ([#1015](https://github.com/yonatangross/orchestkit/issues/1015)) ([7bcab43](https://github.com/yonatangross/orchestkit/commit/7bcab430a21abdaaba714b8c7153351877387646))


### CI/CD

* bump actions/download-artifact from 8.0.0 to 8.0.1 ([#1097](https://github.com/yonatangross/orchestkit/issues/1097)) ([ac52e6a](https://github.com/yonatangross/orchestkit/commit/ac52e6a47089114ec454c1a3e34c779432c49810))
* bump actions/setup-node from 6.2.0 to 6.3.0 ([#1008](https://github.com/yonatangross/orchestkit/issues/1008)) ([61f73f5](https://github.com/yonatangross/orchestkit/commit/61f73f5f49327e0a773110aefb387d4b2bb2113b))
* bump github/codeql-action from 4.32.4 to 4.32.6 ([#1009](https://github.com/yonatangross/orchestkit/issues/1009)) ([13a0975](https://github.com/yonatangross/orchestkit/commit/13a097584115d899681c321d15e2b8c05bda68ac))
* update anthropics/claude-code-action requirement to 26ec041249acb0a944c0a47b6c0c13f05dbc5b44 ([#1098](https://github.com/yonatangross/orchestkit/issues/1098)) ([8a7600e](https://github.com/yonatangross/orchestkit/commit/8a7600e2b9270547dcfc522d95dde26e9b8f3bc3))

## [7.13.0] - 2026-03-18

### Added

- Invocation CTA on all 93 skill reference pages — copy-to-clipboard `/ork:skillname` for commands, auto-activated notice for reference skills (#1082)
- 8 category index pages at `/skills/by-category/` — backend, frontend, testing, security, AI/LLM, devops, product, workflows (#1082)
- ContextualSkillSidebar on all skill reference pages — shows dependencies, reverse deps, related skills, agent link (#1080)
- Skill dependency graph data generation from frontmatter `skills:` field — 93 nodes, 101 edges (#1084)
- SkillRecommender quiz on skills overview — 3-step role/task/stack flow with tag-based scoring (#1079)

### Fixed

- Dependency graph readability — 800px viewport, LR layout, focus dropdown, auto-focus on hub nodes, node dimming on hover
- Category false positives — removed overly broad tags from AI/LLM and product categories
- Quiz UX — added 200ms selection feedback delay before step advancement

---


## [7.12.0] - 2026-03-18

### Features

- **StopFailure hook** (CC 2.1.78): new `stop/stop-failure-handler.ts` flushes state and writes emergency handoff on API error/rate limit — error-loop safe by design (#1106)
- **CLAUDE_PLUGIN_DATA persistence** (CC 2.1.78): `getPluginDataDir/getSessionStorageDir/getAnalyticsStorageDir` in `paths.ts`; session storage migrates to persistent directory that survives plugin updates (#1107)
- **effort frontmatter defaults**: 21 agents annotated with `effort: low/medium`; remaining 12 default to `high` (#1108)
- **worktree hook validation**: tests confirming `WorktreeCreate/WorktreeRemove` registration and handler correctness after CC 2.1.78 `--worktree` flag fix (#1109)

### Changed

- Minimum Claude Code engine bumped to `>= 2.1.78`
- Hook count: 105 → 106

---

## [7.11.2] - 2026-03-17

### Fixed

- TODO: Describe your changes here

---


## [7.11.1](https://github.com/yonatangross/orchestkit/compare/v7.11.0...v7.11.1) (2026-03-16)


### Bug Fixes

* **security:** resolve yauzl CVE and pinned-dependencies alert ([#1101](https://github.com/yonatangross/orchestkit/issues/1101)) ([d96d68d](https://github.com/yonatangross/orchestkit/commit/d96d68d1bbaf55a8f41e982b0debfcf71fc792a6))


### Miscellaneous

* remove release-as pin after 7.11.0 release ([#1103](https://github.com/yonatangross/orchestkit/issues/1103)) ([5fd681c](https://github.com/yonatangross/orchestkit/commit/5fd681cf73bf1362c4b4fd254c4100e86185f51e))

## [7.11.0](https://github.com/yonatangross/orchestkit/compare/v7.11.0...v7.11.0) (2026-03-16)


### Features

* add ci-automation skill + GitHub Actions workflows ([#1006](https://github.com/yonatangross/orchestkit/issues/1006)) ([8b328a7](https://github.com/yonatangross/orchestkit/commit/8b328a7dc3e06428c17b2349dae1d8b92eb57350))
* **cover:** add /ork:cover skill + bump to 7.11.0 ([#1096](https://github.com/yonatangross/orchestkit/issues/1096)) ([36f14c6](https://github.com/yonatangross/orchestkit/commit/36f14c6f3266460a5a1afe14e1927bba2fa0a948))
* **docs:** integrate @yonatan-hq/analytics for cross-project tracking ([#1090](https://github.com/yonatangross/orchestkit/issues/1090)) ([3e294dc](https://github.com/yonatangross/orchestkit/commit/3e294dce69fbf112d48b4b1521383c398e871f29))
* **eval:** Sprint 1 — trigger runner + CONTRIBUTING-SKILLS eval docs ([#1065](https://github.com/yonatangross/orchestkit/issues/1065)) ([8d845c7](https://github.com/yonatangross/orchestkit/commit/8d845c7090ff8d799789ff1b24c34360261c8f49))
* **notebooklm:** update skill for notebooklm-mcp-cli v0.4.8 ([#1094](https://github.com/yonatangross/orchestkit/issues/1094)) ([0b72024](https://github.com/yonatangross/orchestkit/commit/0b72024d3a866bd4fb43daa2ed2f6bc79e1e9c07))
* **skills:** add 13 cognitive-science UX rules across 5 existing skills ([#1011](https://github.com/yonatangross/orchestkit/issues/1011)) ([91b62ac](https://github.com/yonatangross/orchestkit/commit/91b62ac1ab43a1d3296b84e05b402d0102600531))
* **skills:** adopt CC 2.1.72 features — ExitWorktree, model override ([#1036](https://github.com/yonatangross/orchestkit/issues/1036)) ([#1060](https://github.com/yonatangross/orchestkit/issues/1060)) ([96fd3a0](https://github.com/yonatangross/orchestkit/commit/96fd3a0ece399e3f843b11d3f018a0792eea9d46))
* **skills:** skills health — CC 2.1.72 alignment (all phases) ([#1040](https://github.com/yonatangross/orchestkit/issues/1040)) ([b9db695](https://github.com/yonatangross/orchestkit/commit/b9db695763654ade01009ad439a16b7cd6179121))
* Sprint 2 Wave A — eval runner, 1M context GA, RFC 9457 agent errors (v7.6.0) ([#1067](https://github.com/yonatangross/orchestkit/issues/1067)) ([12968a5](https://github.com/yonatangross/orchestkit/commit/12968a54e86446bf83773f0e098cf48f3c95ae9d))


### Bug Fixes

* **ci:** add bootstrap-sha to release-please config ([#997](https://github.com/yonatangross/orchestkit/issues/997)) ([0d46843](https://github.com/yonatangross/orchestkit/commit/0d468437e75ffc7d3842f46972bd19836c565435))
* **ci:** add plugins[0].version to release-please extra-files ([#1001](https://github.com/yonatangross/orchestkit/issues/1001)) ([8a4faad](https://github.com/yonatangross/orchestkit/commit/8a4faadf651d822d3c4e748360a27ca23cc9af14))
* **docs:** replace broken ASCII diagrams with fumadocs Steps ([#999](https://github.com/yonatangross/orchestkit/issues/999)) ([2c1b6fe](https://github.com/yonatangross/orchestkit/commit/2c1b6fee670c4e1c8be2855bb23596792f354874))
* **docs:** update CC version requirement from 2.1.72 to 2.1.74 ([#1062](https://github.com/yonatangross/orchestkit/issues/1062)) ([622ba4c](https://github.com/yonatangross/orchestkit/commit/622ba4cfa0d5d4b9b1707c2f93897a311b3a1586))
* **docs:** update generated plugins-data version to 7.2.0 ([#1012](https://github.com/yonatangross/orchestkit/issues/1012)) ([dca7243](https://github.com/yonatangross/orchestkit/commit/dca72432fd9982b3457d3423aad1124155a94584))
* **docs:** update generated plugins-data version to 7.4.0 ([#1058](https://github.com/yonatangross/orchestkit/issues/1058)) ([e2693b1](https://github.com/yonatangross/orchestkit/commit/e2693b16b3f8cddb40348b5790611a004f37009e))
* **security:** resolve CodeQL and Scorecard alerts ([#1027](https://github.com/yonatangross/orchestkit/issues/1027)) ([ab9136c](https://github.com/yonatangross/orchestkit/commit/ab9136c09593632a9c10a7d44ca4c9799df297ed))
* **skills:** add ExitWorktree + model override to Agent Teams teardown paths ([#1061](https://github.com/yonatangross/orchestkit/issues/1061)) ([c326666](https://github.com/yonatangross/orchestkit/commit/c3266663634912450ed965fae5ca6df752019705))


### Miscellaneous

* **deps-dev:** bump the npm_and_yarn group across 2 directories with 1 update ([#1025](https://github.com/yonatangross/orchestkit/issues/1025)) ([f924b27](https://github.com/yonatangross/orchestkit/commit/f924b27a7ef02dd1f53be0400390d4a1f4d4600c))
* fix hono CVE + organize playgrounds by date ([#1039](https://github.com/yonatangross/orchestkit/issues/1039)) ([b43cf2d](https://github.com/yonatangross/orchestkit/commit/b43cf2dc8f9d62d54b727de72928e123c2330e51))
* **main:** release 7.1.10 ([#1000](https://github.com/yonatangross/orchestkit/issues/1000)) ([d0c48a1](https://github.com/yonatangross/orchestkit/commit/d0c48a1f8f135fa741bb16a39166c1f0e5ebc965))
* **main:** release 7.1.7 ([#998](https://github.com/yonatangross/orchestkit/issues/998)) ([c4607ad](https://github.com/yonatangross/orchestkit/commit/c4607ad811ec43b9cd6dc5ac323af953eca4096a))
* **main:** release 7.2.0 ([#1010](https://github.com/yonatangross/orchestkit/issues/1010)) ([a6420bb](https://github.com/yonatangross/orchestkit/commit/a6420bbd4c50e234ccad3eeba676846e36b68a3d))
* **main:** release 7.2.1 ([#1013](https://github.com/yonatangross/orchestkit/issues/1013)) ([2a83685](https://github.com/yonatangross/orchestkit/commit/2a8368559de636960593f3258e79afeb511d3311))
* **main:** release 7.3.0 ([#1024](https://github.com/yonatangross/orchestkit/issues/1024)) ([490317f](https://github.com/yonatangross/orchestkit/commit/490317fdc2c397f54a9bd067edc7ecd4043b0777))
* **main:** release 7.3.1 ([#1026](https://github.com/yonatangross/orchestkit/issues/1026)) ([363a44f](https://github.com/yonatangross/orchestkit/commit/363a44fcb9f69c4866a6e3fa7bde9ee4be4b2b26))
* **main:** release 7.3.2 ([#1028](https://github.com/yonatangross/orchestkit/issues/1028)) ([9f67f37](https://github.com/yonatangross/orchestkit/commit/9f67f378c1aa81a9653b5c6a1a482eba7870d4de))
* **main:** release 7.4.0 ([#1057](https://github.com/yonatangross/orchestkit/issues/1057)) ([f8a7bfd](https://github.com/yonatangross/orchestkit/commit/f8a7bfde3221cf196bc7ec8678d7301278777ce3))
* **main:** release 7.5.0 ([#1059](https://github.com/yonatangross/orchestkit/issues/1059)) ([059f43d](https://github.com/yonatangross/orchestkit/commit/059f43d19db7fa61d4a01eafadc73077e615e248))
* **main:** release 7.5.1 ([#1063](https://github.com/yonatangross/orchestkit/issues/1063)) ([6c14540](https://github.com/yonatangross/orchestkit/commit/6c145408a4f3bda6cc6f74c403b33a0622f4c024))
* **main:** release 7.9.0 ([#1066](https://github.com/yonatangross/orchestkit/issues/1066)) ([8aa0b27](https://github.com/yonatangross/orchestkit/commit/8aa0b2763d9f458680fba777905414ee83a252f8))
* override release-please to 7.9.1 ([#1093](https://github.com/yonatangross/orchestkit/issues/1093)) ([caa4efd](https://github.com/yonatangross/orchestkit/commit/caa4efd87a0afa640f2e63d7c2aecc508dcf3f33))
* pin release-as to 7.11.0 ([#1100](https://github.com/yonatangross/orchestkit/issues/1100)) ([06acb3f](https://github.com/yonatangross/orchestkit/commit/06acb3fdf8e7bc3020bae216e8c94d5af3887ad5))


### Code Refactoring

* split testing-patterns, CC 2.1.72 upgrade, HTTP hooks fix ([#1015](https://github.com/yonatangross/orchestkit/issues/1015)) ([7bcab43](https://github.com/yonatangross/orchestkit/commit/7bcab430a21abdaaba714b8c7153351877387646))


### CI/CD

* bump actions/download-artifact from 8.0.0 to 8.0.1 ([#1097](https://github.com/yonatangross/orchestkit/issues/1097)) ([ac52e6a](https://github.com/yonatangross/orchestkit/commit/ac52e6a47089114ec454c1a3e34c779432c49810))
* bump actions/setup-node from 6.2.0 to 6.3.0 ([#1008](https://github.com/yonatangross/orchestkit/issues/1008)) ([61f73f5](https://github.com/yonatangross/orchestkit/commit/61f73f5f49327e0a773110aefb387d4b2bb2113b))
* bump github/codeql-action from 4.32.4 to 4.32.6 ([#1009](https://github.com/yonatangross/orchestkit/issues/1009)) ([13a0975](https://github.com/yonatangross/orchestkit/commit/13a097584115d899681c321d15e2b8c05bda68ac))
* update anthropics/claude-code-action requirement to 26ec041249acb0a944c0a47b6c0c13f05dbc5b44 ([#1098](https://github.com/yonatangross/orchestkit/issues/1098)) ([8a7600e](https://github.com/yonatangross/orchestkit/commit/8a7600e2b9270547dcfc522d95dde26e9b8f3bc3))

## [7.9.1] - 2026-03-15

### Added

- Integrate `@yonatan-hq/analytics` for cross-project page view tracking in docs site
- Add Edge route handler for HMAC-signed analytics event forwarding to HQ API

---


## [7.9.0](https://github.com/yonatangross/orchestkit/compare/v7.8.0...v7.9.0) (2026-03-15)


### Features

* add ci-automation skill + GitHub Actions workflows ([#1006](https://github.com/yonatangross/orchestkit/issues/1006)) ([8b328a7](https://github.com/yonatangross/orchestkit/commit/8b328a7dc3e06428c17b2349dae1d8b92eb57350))
* **eval:** Sprint 1 — trigger runner + CONTRIBUTING-SKILLS eval docs ([#1065](https://github.com/yonatangross/orchestkit/issues/1065)) ([8d845c7](https://github.com/yonatangross/orchestkit/commit/8d845c7090ff8d799789ff1b24c34360261c8f49))
* **skills:** add 13 cognitive-science UX rules across 5 existing skills ([#1011](https://github.com/yonatangross/orchestkit/issues/1011)) ([91b62ac](https://github.com/yonatangross/orchestkit/commit/91b62ac1ab43a1d3296b84e05b402d0102600531))
* **skills:** adopt CC 2.1.72 features — ExitWorktree, model override ([#1036](https://github.com/yonatangross/orchestkit/issues/1036)) ([#1060](https://github.com/yonatangross/orchestkit/issues/1060)) ([96fd3a0](https://github.com/yonatangross/orchestkit/commit/96fd3a0ece399e3f843b11d3f018a0792eea9d46))
* **skills:** skills health — CC 2.1.72 alignment (all phases) ([#1040](https://github.com/yonatangross/orchestkit/issues/1040)) ([b9db695](https://github.com/yonatangross/orchestkit/commit/b9db695763654ade01009ad439a16b7cd6179121))
* Sprint 2 Wave A — eval runner, 1M context GA, RFC 9457 agent errors (v7.6.0) ([#1067](https://github.com/yonatangross/orchestkit/issues/1067)) ([12968a5](https://github.com/yonatangross/orchestkit/commit/12968a54e86446bf83773f0e098cf48f3c95ae9d))


### Bug Fixes

* **ci:** add bootstrap-sha to release-please config ([#997](https://github.com/yonatangross/orchestkit/issues/997)) ([0d46843](https://github.com/yonatangross/orchestkit/commit/0d468437e75ffc7d3842f46972bd19836c565435))
* **ci:** add plugins[0].version to release-please extra-files ([#1001](https://github.com/yonatangross/orchestkit/issues/1001)) ([8a4faad](https://github.com/yonatangross/orchestkit/commit/8a4faadf651d822d3c4e748360a27ca23cc9af14))
* **docs:** replace broken ASCII diagrams with fumadocs Steps ([#999](https://github.com/yonatangross/orchestkit/issues/999)) ([2c1b6fe](https://github.com/yonatangross/orchestkit/commit/2c1b6fee670c4e1c8be2855bb23596792f354874))
* **docs:** update CC version requirement from 2.1.72 to 2.1.74 ([#1062](https://github.com/yonatangross/orchestkit/issues/1062)) ([622ba4c](https://github.com/yonatangross/orchestkit/commit/622ba4cfa0d5d4b9b1707c2f93897a311b3a1586))
* **docs:** update generated plugins-data version to 7.2.0 ([#1012](https://github.com/yonatangross/orchestkit/issues/1012)) ([dca7243](https://github.com/yonatangross/orchestkit/commit/dca72432fd9982b3457d3423aad1124155a94584))
* **docs:** update generated plugins-data version to 7.4.0 ([#1058](https://github.com/yonatangross/orchestkit/issues/1058)) ([e2693b1](https://github.com/yonatangross/orchestkit/commit/e2693b16b3f8cddb40348b5790611a004f37009e))
* **security:** resolve CodeQL and Scorecard alerts ([#1027](https://github.com/yonatangross/orchestkit/issues/1027)) ([ab9136c](https://github.com/yonatangross/orchestkit/commit/ab9136c09593632a9c10a7d44ca4c9799df297ed))
* **skills:** add ExitWorktree + model override to Agent Teams teardown paths ([#1061](https://github.com/yonatangross/orchestkit/issues/1061)) ([c326666](https://github.com/yonatangross/orchestkit/commit/c3266663634912450ed965fae5ca6df752019705))


### Miscellaneous

* **deps-dev:** bump the npm_and_yarn group across 2 directories with 1 update ([#1025](https://github.com/yonatangross/orchestkit/issues/1025)) ([f924b27](https://github.com/yonatangross/orchestkit/commit/f924b27a7ef02dd1f53be0400390d4a1f4d4600c))
* fix hono CVE + organize playgrounds by date ([#1039](https://github.com/yonatangross/orchestkit/issues/1039)) ([b43cf2d](https://github.com/yonatangross/orchestkit/commit/b43cf2dc8f9d62d54b727de72928e123c2330e51))
* **main:** release 7.1.10 ([#1000](https://github.com/yonatangross/orchestkit/issues/1000)) ([d0c48a1](https://github.com/yonatangross/orchestkit/commit/d0c48a1f8f135fa741bb16a39166c1f0e5ebc965))
* **main:** release 7.1.7 ([#998](https://github.com/yonatangross/orchestkit/issues/998)) ([c4607ad](https://github.com/yonatangross/orchestkit/commit/c4607ad811ec43b9cd6dc5ac323af953eca4096a))
* **main:** release 7.2.0 ([#1010](https://github.com/yonatangross/orchestkit/issues/1010)) ([a6420bb](https://github.com/yonatangross/orchestkit/commit/a6420bbd4c50e234ccad3eeba676846e36b68a3d))
* **main:** release 7.2.1 ([#1013](https://github.com/yonatangross/orchestkit/issues/1013)) ([2a83685](https://github.com/yonatangross/orchestkit/commit/2a8368559de636960593f3258e79afeb511d3311))
* **main:** release 7.3.0 ([#1024](https://github.com/yonatangross/orchestkit/issues/1024)) ([490317f](https://github.com/yonatangross/orchestkit/commit/490317fdc2c397f54a9bd067edc7ecd4043b0777))
* **main:** release 7.3.1 ([#1026](https://github.com/yonatangross/orchestkit/issues/1026)) ([363a44f](https://github.com/yonatangross/orchestkit/commit/363a44fcb9f69c4866a6e3fa7bde9ee4be4b2b26))
* **main:** release 7.3.2 ([#1028](https://github.com/yonatangross/orchestkit/issues/1028)) ([9f67f37](https://github.com/yonatangross/orchestkit/commit/9f67f378c1aa81a9653b5c6a1a482eba7870d4de))
* **main:** release 7.4.0 ([#1057](https://github.com/yonatangross/orchestkit/issues/1057)) ([f8a7bfd](https://github.com/yonatangross/orchestkit/commit/f8a7bfde3221cf196bc7ec8678d7301278777ce3))
* **main:** release 7.5.0 ([#1059](https://github.com/yonatangross/orchestkit/issues/1059)) ([059f43d](https://github.com/yonatangross/orchestkit/commit/059f43d19db7fa61d4a01eafadc73077e615e248))
* **main:** release 7.5.1 ([#1063](https://github.com/yonatangross/orchestkit/issues/1063)) ([6c14540](https://github.com/yonatangross/orchestkit/commit/6c145408a4f3bda6cc6f74c403b33a0622f4c024))


### Code Refactoring

* split testing-patterns, CC 2.1.72 upgrade, HTTP hooks fix ([#1015](https://github.com/yonatangross/orchestkit/issues/1015)) ([7bcab43](https://github.com/yonatangross/orchestkit/commit/7bcab430a21abdaaba714b8c7153351877387646))


### CI/CD

* bump actions/setup-node from 6.2.0 to 6.3.0 ([#1008](https://github.com/yonatangross/orchestkit/issues/1008)) ([61f73f5](https://github.com/yonatangross/orchestkit/commit/61f73f5f49327e0a773110aefb387d4b2bb2113b))
* bump github/codeql-action from 4.32.4 to 4.32.6 ([#1009](https://github.com/yonatangross/orchestkit/issues/1009)) ([13a0975](https://github.com/yonatangross/orchestkit/commit/13a097584115d899681c321d15e2b8c05bda68ac))

## [7.9.0] - 2026-03-15

### Added

- **monitoring-observability:** Langfuse Python SDK v4 coverage — `as_type` semantic types (generation, retriever, chain, embedding, agent, guardrail, evaluator), `score_current_span()` / `score_current_trace()`, `should_export_span` filter, `LangfuseMedia` attachments, `run_experiment()` batch evaluation
- **monitoring-observability:** Python v3→v4 migration guide section with breaking changes checklist, code examples, and version pin guidance (`langfuse>=4.0.0`)

### Changed

- **monitoring-observability:** v2.0.0→3.0.0 — all code examples updated from v3 to v4 patterns across rules, scripts, checklists, and references
- **monitoring-observability:** Setup checklist updated with v4 version pins and migration steps
- **brainstorm:** v4.4.0→4.6.0 — added product/event-driven/devops/data-pipeline domain detection, design pipeline agents, `/effort` scaling, CC 2.1.76 partial results + PostCompact recovery

## [7.8.0] - 2026-03-14

### Added

- **hooks:** PostCompact recovery hook — re-injects branch, tasks, decisions after compaction using CC-provided `compaction_count` and `context_size_after` fields
- **hooks:** Elicitation guard — blocks form-mode MCP elicitations requesting secret fields (api_key, password, token), forces URL mode
- **hooks:** ElicitationResult logger — tracks accept/decline/cancel outcomes for analytics, injects alternative suggestions on decline
- **hooks:** Effort-aware context budgeting — `detectEffortLevel()` reads `/effort` setting, adjusts prompt dispatcher token budget (low=200t, medium=800t, high=1200t), skips heavy context at low effort
- **hooks:** Monorepo sparse paths advisory — WorktreeCreate detects monorepo (pnpm-workspace, nx, lerna, turbo, workspaces) and suggests `worktree.sparsePaths` config
- **types:** `PostCompact`, `Elicitation`, `ElicitationResult` added to HookEvent union with typed input fields
- **version-matrix:** 23 new feature entries covering CC 2.1.75 and 2.1.76 (elicitation, sparse paths, /effort, bg agent partial results, compaction circuit breaker, etc.)

### Changed

- **hooks:** MIN_CC_VERSION bumped from 2.1.74 to 2.1.76 — backward compatibility dropped
- **hooks:** SubagentStop retry-handler now returns early with `[PARTIAL RESULT]` tag for killed background agents instead of entering retry logic (CC 2.1.76 partial results)
- **hooks:** PostCompact and Elicitation hooks registered in `entries/lifecycle.ts` split bundle (lifecycle.mjs grew 77→80KB)
- **compatibility:** All 78 skill `compatibility:` fields updated from 2.1.74+ to 2.1.76+
- **counts:** 99→104 hooks (33→36 global), MIN_CC_VERSION 2.1.74→2.1.76

### Fixed

- **docs:** Missing v7.7.x row in version history table (between v7.8.x and v7.5.x)
- **docs:** Stale "CC 2.1.74 format" agent reference in CLAUDE.md directory structure
- **docs:** README badge and requirement updated from ≥2.1.74 to ≥2.1.76
- **docs:** hooks README footer CC requirement updated to >= 2.1.76

## [7.7.0] - 2026-03-14

### Added

- **design-to-code:** New user-invocable skill (`/ork:design-to-code`) — mockup-to-component pipeline using Google Stitch MCP and 21st.dev component registry
- **component-search:** New user-invocable skill (`/ork:component-search`) — search 21st.dev registry for production-ready React components
- **design-context-extract:** New user-invocable skill (`/ork:design-context-extract`) — extract design DNA (colors, typography, spacing) from screenshots or URLs
- **design-context-extractor:** New agent for autonomous design context extraction with stitch-mcp integration
- **component-curator:** New background agent that audits project component usage and recommends 21st.dev upgrades
- **MCP:** Added stitch-mcp (Google Stitch) and 21st-dev-magic (21st.dev component registry) to MCP configuration docs

### Changed

- **frontend-ui-developer:** Added 21st-dev-magic MCP scope + component-search, design-to-code, design-context-extract skills
- **design-system-architect:** Added stitch-mcp MCP scope + design-context-extract, component-search skills
- **counts:** 89→92 skills, 31→33 agents, 99→101 hooks, 16→19 user-invocable

## [7.6.0] - 2026-03-14

### Added

- **api-design:** Agent-facing RFC 9457 error patterns with structured retry signals — `retryable`, `error_category`, `retry_after`, `owner_action_required` extensions for deterministic AI agent error handling
- **api-design:** Content negotiation middleware pattern (JSON/Markdown/HTML via Accept header) with token efficiency budget (<300 tokens)
- **api-design:** Error category taxonomy (10 categories) with agent action mapping table
- **types:** `StructuredError` and `ErrorCategory` types in orchestration-types.ts for structured error handling in hooks
- **testing-integration:** RFC 9457 error response assertion patterns (Python + TypeScript)

### Changed

- **hooks:** retry-manager now extracts RFC 9457 structured errors before regex fallback — uses server-provided `retry_after` instead of calculated backoff
- **hooks:** failure-handler detects structured errors for richer context injection with `error_category` and `what_you_should_do`

### Fixed

- **python-backend:** Updated stale RFC 7807 reference to RFC 9457 (the active standard)

## [7.5.3] - 2026-03-13

### Added

- **eval:** Quality evaluation runner (`npm run eval:quality`) — A/B skill vs baseline grading with Claude-as-judge
- **eval:** Seed eval YAMLs for all 16 user-invocable skills with trigger + quality assertions
- **eval:** Shared eval library (`lib/eval-common.sh`) — colors, cleanup, deps, portable timeout
- **eval:** `--grade-only`, `--tag`, `--max-turns`, `--timeout` flags for both eval runners
- **eval:** Batch assertion grading (A3) reduces Claude calls ~60%
- **eval:** Parallel with-skill + baseline execution (A4) for faster evals
- **eval:** Scaffold field support — quality evals can declare project scaffolds (e.g., `typescript-nextjs`)

### Fixed

- **eval:** SEC-001 path traversal in skill name input validation
- **eval:** SEC-002 JSON injection via unsanitized YAML-sourced strings
- **eval:** PASS/FAIL grading anchored to first token to prevent false matches
- **eval:** Silent claude CLI crashes now emit warnings
- **eval:** `grep -w` with multi-word patterns replaced by ERE

### Changed

- **eval:** Trigger runner refactored to source shared `eval-common.sh`
- **eval:** All 17 eval YAMLs hardened with adversarial prompts, confusion pairs, and negative assertions

---


## [7.5.2] - 2026-03-12

### Added

- **eval:** Trigger evaluation runner (`npm run eval:trigger`) — measures skill trigger precision and recall with flaky detection
- **docs:** Expanded CONTRIBUTING-SKILLS.md with mandatory eval requirements, writing guidance, and pre-submit checklist

---


## [7.5.1](https://github.com/yonatangross/orchestkit/compare/v7.5.0...v7.5.1) (2026-03-12)


### Bug Fixes

* **docs:** update CC version requirement from 2.1.72 to 2.1.74 ([#1062](https://github.com/yonatangross/orchestkit/issues/1062)) ([622ba4c](https://github.com/yonatangross/orchestkit/commit/622ba4cfa0d5d4b9b1707c2f93897a311b3a1586))

## [7.5.0](https://github.com/yonatangross/orchestkit/compare/v7.4.0...v7.5.0) (2026-03-12)


### Features

* **skills:** adopt CC 2.1.72 features — ExitWorktree, model override ([#1036](https://github.com/yonatangross/orchestkit/issues/1036)) ([#1060](https://github.com/yonatangross/orchestkit/issues/1060)) ([96fd3a0](https://github.com/yonatangross/orchestkit/commit/96fd3a0ece399e3f843b11d3f018a0792eea9d46))


### Bug Fixes

* **docs:** update generated plugins-data version to 7.4.0 ([#1058](https://github.com/yonatangross/orchestkit/issues/1058)) ([e2693b1](https://github.com/yonatangross/orchestkit/commit/e2693b16b3f8cddb40348b5790611a004f37009e))
* **skills:** add ExitWorktree + model override to Agent Teams teardown paths ([#1061](https://github.com/yonatangross/orchestkit/issues/1061)) ([c326666](https://github.com/yonatangross/orchestkit/commit/c3266663634912450ed965fae5ca6df752019705))

## [7.4.0](https://github.com/yonatangross/orchestkit/compare/v7.3.3...v7.4.0) (2026-03-12)


### Features

* add ci-automation skill + GitHub Actions workflows ([#1006](https://github.com/yonatangross/orchestkit/issues/1006)) ([8b328a7](https://github.com/yonatangross/orchestkit/commit/8b328a7dc3e06428c17b2349dae1d8b92eb57350))
* **skills:** add 13 cognitive-science UX rules across 5 existing skills ([#1011](https://github.com/yonatangross/orchestkit/issues/1011)) ([91b62ac](https://github.com/yonatangross/orchestkit/commit/91b62ac1ab43a1d3296b84e05b402d0102600531))
* **skills:** skills health — CC 2.1.72 alignment (all phases) ([#1040](https://github.com/yonatangross/orchestkit/issues/1040)) ([b9db695](https://github.com/yonatangross/orchestkit/commit/b9db695763654ade01009ad439a16b7cd6179121))


### Bug Fixes

* **ci:** add bootstrap-sha to release-please config ([#997](https://github.com/yonatangross/orchestkit/issues/997)) ([0d46843](https://github.com/yonatangross/orchestkit/commit/0d468437e75ffc7d3842f46972bd19836c565435))
* **ci:** add plugins[0].version to release-please extra-files ([#1001](https://github.com/yonatangross/orchestkit/issues/1001)) ([8a4faad](https://github.com/yonatangross/orchestkit/commit/8a4faadf651d822d3c4e748360a27ca23cc9af14))
* **docs:** replace broken ASCII diagrams with fumadocs Steps ([#999](https://github.com/yonatangross/orchestkit/issues/999)) ([2c1b6fe](https://github.com/yonatangross/orchestkit/commit/2c1b6fee670c4e1c8be2855bb23596792f354874))
* **docs:** update generated plugins-data version to 7.2.0 ([#1012](https://github.com/yonatangross/orchestkit/issues/1012)) ([dca7243](https://github.com/yonatangross/orchestkit/commit/dca72432fd9982b3457d3423aad1124155a94584))
* **security:** resolve CodeQL and Scorecard alerts ([#1027](https://github.com/yonatangross/orchestkit/issues/1027)) ([ab9136c](https://github.com/yonatangross/orchestkit/commit/ab9136c09593632a9c10a7d44ca4c9799df297ed))


### Miscellaneous

* **deps-dev:** bump the npm_and_yarn group across 2 directories with 1 update ([#1025](https://github.com/yonatangross/orchestkit/issues/1025)) ([f924b27](https://github.com/yonatangross/orchestkit/commit/f924b27a7ef02dd1f53be0400390d4a1f4d4600c))
* fix hono CVE + organize playgrounds by date ([#1039](https://github.com/yonatangross/orchestkit/issues/1039)) ([b43cf2d](https://github.com/yonatangross/orchestkit/commit/b43cf2dc8f9d62d54b727de72928e123c2330e51))
* **main:** release 7.1.10 ([#1000](https://github.com/yonatangross/orchestkit/issues/1000)) ([d0c48a1](https://github.com/yonatangross/orchestkit/commit/d0c48a1f8f135fa741bb16a39166c1f0e5ebc965))
* **main:** release 7.1.7 ([#998](https://github.com/yonatangross/orchestkit/issues/998)) ([c4607ad](https://github.com/yonatangross/orchestkit/commit/c4607ad811ec43b9cd6dc5ac323af953eca4096a))
* **main:** release 7.2.0 ([#1010](https://github.com/yonatangross/orchestkit/issues/1010)) ([a6420bb](https://github.com/yonatangross/orchestkit/commit/a6420bbd4c50e234ccad3eeba676846e36b68a3d))
* **main:** release 7.2.1 ([#1013](https://github.com/yonatangross/orchestkit/issues/1013)) ([2a83685](https://github.com/yonatangross/orchestkit/commit/2a8368559de636960593f3258e79afeb511d3311))
* **main:** release 7.3.0 ([#1024](https://github.com/yonatangross/orchestkit/issues/1024)) ([490317f](https://github.com/yonatangross/orchestkit/commit/490317fdc2c397f54a9bd067edc7ecd4043b0777))
* **main:** release 7.3.1 ([#1026](https://github.com/yonatangross/orchestkit/issues/1026)) ([363a44f](https://github.com/yonatangross/orchestkit/commit/363a44fcb9f69c4866a6e3fa7bde9ee4be4b2b26))
* **main:** release 7.3.2 ([#1028](https://github.com/yonatangross/orchestkit/issues/1028)) ([9f67f37](https://github.com/yonatangross/orchestkit/commit/9f67f378c1aa81a9653b5c6a1a482eba7870d4de))


### Code Refactoring

* split testing-patterns, CC 2.1.72 upgrade, HTTP hooks fix ([#1015](https://github.com/yonatangross/orchestkit/issues/1015)) ([7bcab43](https://github.com/yonatangross/orchestkit/commit/7bcab430a21abdaaba714b8c7153351877387646))


### CI/CD

* bump actions/setup-node from 6.2.0 to 6.3.0 ([#1008](https://github.com/yonatangross/orchestkit/issues/1008)) ([61f73f5](https://github.com/yonatangross/orchestkit/commit/61f73f5f49327e0a773110aefb387d4b2bb2113b))
* bump github/codeql-action from 4.32.4 to 4.32.6 ([#1009](https://github.com/yonatangross/orchestkit/issues/1009)) ([13a0975](https://github.com/yonatangross/orchestkit/commit/13a097584115d899681c321d15e2b8c05bda68ac))

## [7.5.0] - 2026-03-12

### Changed

- **platform:** bump minimum Claude Code version from >= 2.1.73 to >= 2.1.74
  - SessionEnd `hook.timeout` now respected (was hardcoded to 1.5s — hooks silently killed)
  - New `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` env var for timeout override
  - Managed policy `ask` rules now correctly override user `allow` + skill `allowed-tools`
  - Full model IDs (`claude-opus-4-6`) accepted in agent frontmatter (symbolic names still recommended)
  - `/context` command surfaces actionable optimization suggestions
  - `autoMemoryDirectory` setting for custom auto-memory storage path
  - `--plugin-dir` local overrides take precedence over marketplace plugins
  - Streaming API + bash prefix caching memory leaks fixed
- **skills:** update `compatibility` field to "Claude Code 2.1.74+" across 78 skills
- **docs:** update version matrix with 12 new features (4 for 2.1.73, 8 for 2.1.74) and "Full+++++" compatibility level

---

## [7.4.0] - 2026-03-11

### Changed

- **platform:** bump minimum Claude Code version from >= 2.1.72 to >= 2.1.73
  - Fixes skill-file deadlock on `git pull` (critical for 89-skill plugin)
  - Fixes SessionStart hooks double-firing on `--resume`/`--continue`
  - Fixes no-op system reminder injection (~2K tokens/turn recovered across 99 hooks)
  - Opus 4.6 now default on Bedrock/Vertex/Foundry (6 opus-tier agents auto-upgrade)
- **skills:** update `compatibility` field to "Claude Code 2.1.73+" across 78 skills
- **docs:** update version matrix with 5 new 2.1.73 features and "Full++++" compatibility level

### Fixed

- **docs:** fix broken light mode on documentation site — split dark-only `@theme` into proper light/dark token sets following fumadocs convention (`@theme` for light defaults, `.dark {}` for dark overrides)

---

## [7.3.3] - 2026-03-11

### Added

- **skills:** shared unified scoring framework in quality-gates for assess/verify
- **skills:** 33 rule files across 12 skills (setup, implement, brainstorm, remember, help, audit-full, configure, errors, memory-fabric, release-management, scope-appropriate-architecture, testing-patterns)
- **skills:** 12 `_sections.md` catalog files for new rule directories
- **hooks:** task-existence-gate for task tracking enforcement in sync-task-dispatcher
- **agents:** `background: true` on 8 read-only analysis agents

### Changed

- **skills:** compress 12 bloated skills under 300 lines via reference extraction (setup, write-prd, code-review-playbook, zustand-patterns, release-management, vite-advanced, async-jobs, devops-deployment, audit-full, implement, react-server-components-framework, remember)

### Fixed

- **hooks:** improve subagent-quality-gate and unified-dispatcher

---

## [7.3.2](https://github.com/yonatangross/orchestkit/compare/v7.3.1...v7.3.2) (2026-03-11)


### Bug Fixes

* **security:** resolve CodeQL and Scorecard alerts ([#1027](https://github.com/yonatangross/orchestkit/issues/1027)) ([ab9136c](https://github.com/yonatangross/orchestkit/commit/ab9136c09593632a9c10a7d44ca4c9799df297ed))


### Miscellaneous

* fix hono CVE + organize playgrounds by date ([#1039](https://github.com/yonatangross/orchestkit/issues/1039)) ([b43cf2d](https://github.com/yonatangross/orchestkit/commit/b43cf2dc8f9d62d54b727de72928e123c2330e51))

## [7.3.2] - 2026-03-11

### Security

- **hooks:** fix second-order command injection in `gitExec()` (CodeQL #124, High) — add `assertSafeGitArgs()` blocklist for `--upload-pack`, `--receive-pack`, `--exec`, `-c` options that can execute arbitrary commands via git
- **ci:** fix unpinned npm dependency in `claude-health.yml` (Scorecard #125, Medium) — add `--ignore-scripts` to `npm install` and bump to `@2.1.72`

---

## [7.3.1](https://github.com/yonatangross/orchestkit/compare/v7.3.0...v7.3.1) (2026-03-11)


### Miscellaneous

* **deps-dev:** bump the npm_and_yarn group across 2 directories with 1 update ([#1025](https://github.com/yonatangross/orchestkit/issues/1025)) ([f924b27](https://github.com/yonatangross/orchestkit/commit/f924b27a7ef02dd1f53be0400390d4a1f4d4600c))

## [7.3.0](https://github.com/yonatangross/orchestkit/compare/v7.2.2...v7.3.0) (2026-03-10)


### Features

* add ci-automation skill + GitHub Actions workflows ([#1006](https://github.com/yonatangross/orchestkit/issues/1006)) ([8b328a7](https://github.com/yonatangross/orchestkit/commit/8b328a7dc3e06428c17b2349dae1d8b92eb57350))
* **skills:** add 13 cognitive-science UX rules across 5 existing skills ([#1011](https://github.com/yonatangross/orchestkit/issues/1011)) ([91b62ac](https://github.com/yonatangross/orchestkit/commit/91b62ac1ab43a1d3296b84e05b402d0102600531))


### Bug Fixes

* **ci:** add bootstrap-sha to release-please config ([#997](https://github.com/yonatangross/orchestkit/issues/997)) ([0d46843](https://github.com/yonatangross/orchestkit/commit/0d468437e75ffc7d3842f46972bd19836c565435))
* **ci:** add plugins[0].version to release-please extra-files ([#1001](https://github.com/yonatangross/orchestkit/issues/1001)) ([8a4faad](https://github.com/yonatangross/orchestkit/commit/8a4faadf651d822d3c4e748360a27ca23cc9af14))
* **docs:** replace broken ASCII diagrams with fumadocs Steps ([#999](https://github.com/yonatangross/orchestkit/issues/999)) ([2c1b6fe](https://github.com/yonatangross/orchestkit/commit/2c1b6fee670c4e1c8be2855bb23596792f354874))
* **docs:** update generated plugins-data version to 7.2.0 ([#1012](https://github.com/yonatangross/orchestkit/issues/1012)) ([dca7243](https://github.com/yonatangross/orchestkit/commit/dca72432fd9982b3457d3423aad1124155a94584))


### Miscellaneous

* **main:** release 7.1.10 ([#1000](https://github.com/yonatangross/orchestkit/issues/1000)) ([d0c48a1](https://github.com/yonatangross/orchestkit/commit/d0c48a1f8f135fa741bb16a39166c1f0e5ebc965))
* **main:** release 7.1.7 ([#998](https://github.com/yonatangross/orchestkit/issues/998)) ([c4607ad](https://github.com/yonatangross/orchestkit/commit/c4607ad811ec43b9cd6dc5ac323af953eca4096a))
* **main:** release 7.2.0 ([#1010](https://github.com/yonatangross/orchestkit/issues/1010)) ([a6420bb](https://github.com/yonatangross/orchestkit/commit/a6420bbd4c50e234ccad3eeba676846e36b68a3d))
* **main:** release 7.2.1 ([#1013](https://github.com/yonatangross/orchestkit/issues/1013)) ([2a83685](https://github.com/yonatangross/orchestkit/commit/2a8368559de636960593f3258e79afeb511d3311))


### Code Refactoring

* split testing-patterns, CC 2.1.72 upgrade, HTTP hooks fix ([#1015](https://github.com/yonatangross/orchestkit/issues/1015)) ([7bcab43](https://github.com/yonatangross/orchestkit/commit/7bcab430a21abdaaba714b8c7153351877387646))


### CI/CD

* bump actions/setup-node from 6.2.0 to 6.3.0 ([#1008](https://github.com/yonatangross/orchestkit/issues/1008)) ([61f73f5](https://github.com/yonatangross/orchestkit/commit/61f73f5f49327e0a773110aefb387d4b2bb2113b))
* bump github/codeql-action from 4.32.4 to 4.32.6 ([#1009](https://github.com/yonatangross/orchestkit/issues/1009)) ([13a0975](https://github.com/yonatangross/orchestkit/commit/13a097584115d899681c321d15e2b8c05bda68ac))

## [7.3.0] - 2026-03-10

### Fixed

- **agents:** remove stale `git-workflow` references from git-operations-engineer, frontend-ui-developer, release-engineer
- **agents:** remove stale `ci-automation` reference from ci-cd-engineer
- **skills:** fix broken hook refs in commit skill (2 non-existent hooks → git-validator)
- **skills:** remove broken `audit-context-loader` hook section from audit-full skill
- **skills:** fix stale cross-references in help, storybook-testing, release-management, verify
- **hooks:** fix verify scoring rubric weights (6→8 dimensions matching quality-model.md)
- **tests:** fix test-git-enforcement-hooks.sh references to deleted skills
- **tests:** fix trigger-cases.yaml — replace git-workflow with github-operations
- **tests:** delete always-failing test-git-workflow-completeness.sh

### Changed

- **hooks:** skill-scoped hooks 23→21 (removed 2 non-existent refs), total 101→99
- **verify:** add cross-route findings panel to gallery template (common issues, strengths, breakdown)
- **verify:** enhance visual-capture.md with 6-criteria structured AI evaluation prompt
- **docs:** update all hook count references across 10+ doc files

---

## [7.2.2] - 2026-03-10

### Removed

- **skills:** remove git-workflow skill (5 best rules migrated to commit skill)
- **skills:** remove ci-automation skill (ci-cd-engineer agent covers this)
- **evals:** remove orphaned git-workflow eval files

### Changed

- **skills:** upgrade write-prd to v2.0.0 — AskUserQuestion, Task Management, memory integration, disk output
- **skills:** upgrade commit to v1.2.0 — absorb 5 git-workflow rules (branch-protection, merge-strategy, history-hygiene, stacked-pr-workflow, stacked-pr-rebase)
- **skills:** update compatibility field to `2.1.72+` across 77 SKILL.md files
- **marketplace:** bump engine from `>=2.1.69` to `>=2.1.72`

### Added

- **skills:** split testing-patterns into 5 focused sub-skills — testing-unit, testing-e2e, testing-integration, testing-llm, testing-perf (#669)
- **skills:** add visual verification portfolio to verify skill — Phase 2.5 (screenshot gallery) + Phase 8.5 (agentation feedback loop)
- **skills:** gallery-template.html — self-contained HTML with dark/light mode, base64-embedded screenshots, AI vision evaluations
- **hooks:** 4 once:true standards loaders for implement, review-pr, verify, brainstorm skills (CC 2.1.72 prompt cache optimization)
- **hooks:** implement-standards-loader — dynamic project stack detection via package.json/pyproject.toml
- **hooks:** review-dimensions-loader — static 6-dimension review criteria + JSON output contract
- **hooks:** verify-scoring-rubric-loader — static 0-10 scale with dimension weights
- **hooks:** brainstorm-instructions-loader — static divergent mode rules + evaluation dimensions

### Fixed

- **evals:** update help.eval.json from "5 GIT skills" to "4 GIT skills"
- **tests:** update split-bundles expected hook count to 176

---


## [7.2.1](https://github.com/yonatangross/orchestkit/compare/v7.2.0...v7.2.1) (2026-03-09)


### Bug Fixes

* **docs:** update generated plugins-data version to 7.2.0 ([#1012](https://github.com/yonatangross/orchestkit/issues/1012)) ([dca7243](https://github.com/yonatangross/orchestkit/commit/dca72432fd9982b3457d3423aad1124155a94584))


### CI/CD

* bump actions/setup-node from 6.2.0 to 6.3.0 ([#1008](https://github.com/yonatangross/orchestkit/issues/1008)) ([61f73f5](https://github.com/yonatangross/orchestkit/commit/61f73f5f49327e0a773110aefb387d4b2bb2113b))
* bump github/codeql-action from 4.32.4 to 4.32.6 ([#1009](https://github.com/yonatangross/orchestkit/issues/1009)) ([13a0975](https://github.com/yonatangross/orchestkit/commit/13a097584115d899681c321d15e2b8c05bda68ac))

## [7.2.0](https://github.com/yonatangross/orchestkit/compare/v7.1.14...v7.2.0) (2026-03-09)


### Features

* add ci-automation skill + GitHub Actions workflows ([#1006](https://github.com/yonatangross/orchestkit/issues/1006)) ([8b328a7](https://github.com/yonatangross/orchestkit/commit/8b328a7dc3e06428c17b2349dae1d8b92eb57350))
* **skills:** add 13 cognitive-science UX rules across 5 existing skills ([#1011](https://github.com/yonatangross/orchestkit/issues/1011)) ([91b62ac](https://github.com/yonatangross/orchestkit/commit/91b62ac1ab43a1d3296b84e05b402d0102600531))


### Bug Fixes

* **ci:** add bootstrap-sha to release-please config ([#997](https://github.com/yonatangross/orchestkit/issues/997)) ([0d46843](https://github.com/yonatangross/orchestkit/commit/0d468437e75ffc7d3842f46972bd19836c565435))
* **ci:** add plugins[0].version to release-please extra-files ([#1001](https://github.com/yonatangross/orchestkit/issues/1001)) ([8a4faad](https://github.com/yonatangross/orchestkit/commit/8a4faadf651d822d3c4e748360a27ca23cc9af14))
* **docs:** replace broken ASCII diagrams with fumadocs Steps ([#999](https://github.com/yonatangross/orchestkit/issues/999)) ([2c1b6fe](https://github.com/yonatangross/orchestkit/commit/2c1b6fee670c4e1c8be2855bb23596792f354874))


### Miscellaneous

* **main:** release 7.1.10 ([#1000](https://github.com/yonatangross/orchestkit/issues/1000)) ([d0c48a1](https://github.com/yonatangross/orchestkit/commit/d0c48a1f8f135fa741bb16a39166c1f0e5ebc965))
* **main:** release 7.1.7 ([#998](https://github.com/yonatangross/orchestkit/issues/998)) ([c4607ad](https://github.com/yonatangross/orchestkit/commit/c4607ad811ec43b9cd6dc5ac323af953eca4096a))

## [7.1.14] - 2026-03-08

### Fixed

- **skills:** add 234 test case entries for 222 previously untested rules across 63 skills
- **skills:** fix 18 term mismatches in expectedBehavior strings for rule traceability
- **skills:** scaffold 49 .eval.json files and regenerate all 82 eval files from current test-cases
- **skills:** fix remaining short behavior in animation-motion-design view-transitions

---

## [7.1.13] - 2026-03-08

### Fixed

- **ci:** resolve TypeScript type error in home-environment test (tuple annotation mismatch)
- **ci:** update stale skill names in trigger tests — brainstorming→brainstorm, plan-viz→visualize-plan
- **skills:** add skill name fragments to 6 descriptions for semantic discovery (help, feedback, business-case, prioritization, setup, write-prd)
- **skills:** add chain-patterns Overview section and trigger phrasing
- **skills:** expand 546 short expectedBehavior entries (≤5 words) to 6+ words across 43 skills
- **skills:** add context exhaustion handling docs to brainstorm and task-dependency-patterns
- **ci:** add id-token: write to claude-review and claude-triage workflows for OIDC
- **ci:** fix SessionStart hook count assertion (4→3 after HTTP webhook removal)
- **skills:** strip ork: prefix from subagent_type in chain-patterns, fix-issue, implement

---

## [7.1.12] - 2026-03-08

### Fixed

- **hooks:** InstructionsLoaded dispatcher — shared content cache eliminates 3x redundant file reads
- **hooks:** classifySource uses basename() check to prevent substring misclassification
- **hooks:** rule-conflicts false-positive prevention — files matching both sides excluded
- **hooks:** drift-detection conditional cache write — only writes when hashes differ
- **hooks:** token-budget-tracker simplified threshold to percentage-only

### Changed

- **hooks:** all 6 InstructionsLoaded handlers now receive shared `Map<string, string>` content cache
- **hooks:** dispatcher validates `files_loaded` elements with runtime type guard

### Added

- **tests:** 12 new tests for edge cases, all 6 conflict patterns, false-positive prevention

---


## [7.1.11] - 2026-03-07

### Added

- **skill:** ci-automation skill with SKILL.md + 4 reference docs (cost-model, gh-action-patterns, headless-cli, security)
- **ci:** GitHub Actions workflows for claude-health, claude-review, claude-triage
- **agent:** ci-cd-engineer skill index updated with ci-automation

---


## [7.1.10](https://github.com/yonatangross/orchestkit/compare/v7.1.9...v7.1.10) (2026-03-06)


### Bug Fixes

* **ci:** add bootstrap-sha to release-please config ([#997](https://github.com/yonatangross/orchestkit/issues/997)) ([0d46843](https://github.com/yonatangross/orchestkit/commit/0d468437e75ffc7d3842f46972bd19836c565435))
* **ci:** add plugins[0].version to release-please extra-files ([#1001](https://github.com/yonatangross/orchestkit/issues/1001)) ([8a4faad](https://github.com/yonatangross/orchestkit/commit/8a4faadf651d822d3c4e748360a27ca23cc9af14))
* **docs:** replace broken ASCII diagrams with fumadocs Steps ([#999](https://github.com/yonatangross/orchestkit/issues/999)) ([2c1b6fe](https://github.com/yonatangross/orchestkit/commit/2c1b6fee670c4e1c8be2855bb23596792f354874))


### Miscellaneous

* **main:** release 7.1.7 ([#998](https://github.com/yonatangross/orchestkit/issues/998)) ([c4607ad](https://github.com/yonatangross/orchestkit/commit/c4607ad811ec43b9cd6dc5ac323af953eca4096a))

## [7.1.9] - 2026-03-06

### Fixed

- Add `$.plugins[0].version` to release-please extra-files so release PRs update both top-level and plugin versions in marketplace.json

---


## [7.1.8] - 2026-03-06

### Fixed

- Replace broken ASCII box-drawing diagrams with fumadocs Steps components and markdown tables across 12 docs pages
- Add missing `/ork:prd` command to command-skills page
- Fix stale skill counts and clarify "listed vs invocable" text in skills overview
- Fix skill.mjs bundle hook count from "1+" to "19" in hooks overview

---


## [7.1.7](https://github.com/yonatangross/orchestkit/compare/v7.1.6...v7.1.7) (2026-03-06)


### Bug Fixes

* **ci:** add bootstrap-sha to release-please config ([#997](https://github.com/yonatangross/orchestkit/issues/997)) ([0d46843](https://github.com/yonatangross/orchestkit/commit/0d468437e75ffc7d3842f46972bd19836c565435))

## [7.1.6] - 2026-03-06

### Fixed

- TODO: Describe your changes here

---


## [7.1.5] - 2026-03-06

### Fixed

- **docs:** Full fumadocs sync — fix 40+ stale references across 37 MDX files
  - All counts corrected: 79 skills (18 cmd + 61 ref), 30 agents, 105 hooks
  - Remove 8 demoted agent references from 15 files (replaced with current agents)
  - Remove deleted hook references (graph-memory-inject, agent-memory-store, capture-user-intent, memory-capture) from 8 files
  - Rewrite memory docs for graph-first architecture (session-summary replaces 4 hooks)

### Added

- **docs:** Document CC 2.1.69/70 hook features in fumadocs
  - ConfigChange, InstructionsLoaded, WorktreeCreate/Remove events in hook timeline
  - Native HTTP hooks section (12 type:"http" hooks)
  - once:true auto-removal pattern (13 skill context loaders)
  - statusMessage spinner UX documentation

---


## [7.1.4] - 2026-03-06

### Fixed

- **docs:** Fix 30+ stale counts across fumadocs site, skills, and source files
  - 71 skills → 79 skills, 83/98/106 hooks → 105 hooks (42 global + 44 agent + 19 skill)
  - CC version badge ≥2.1.59 → ≥2.1.69, user-invocable 17 → 18
  - Fix `count-hooks.sh` to exclude CONTRIBUTING-SKILLS.md example (was inflating skill count by 1)
  - Regenerated docs data + rebuilt plugins to match

---


## [7.1.3] - 2026-03-05

### Added

- **feat(skills):** Enable CC native matching on 10 knowledge skills (#960)
  - security-patterns, api-design, testing-patterns, database-patterns, python-backend, architecture-patterns, performance, quality-gates, react-server-components-framework, devops-deployment
  - Changed `disable-model-invocation: true → false` so CC auto-selects these based on prompt/description matching
  - Skills visible to CC: 17 → 27 (17 user-invocable + 10 model-invocable)
- **docs(skills):** Document model-invocable pattern in CONTRIBUTING-SKILLS.md

### Removed

- **perf(hooks):** Delete ~1,550 lines dead routing code (#960)
  - Deleted: intent-classifier.ts (669 lines), calibration-engine.ts, skill-nudge.ts, calibration-tracker.ts, calibration-persist.ts, + 4 test files
  - These modules were superseded by CC native skill matching and never ran in production
  - Prompt pipeline hooks: 5 → 4 (removed skill-nudge-prompt)
  - Split-bundles test count: 170 → 167

### Changed

- **perf(agents):** Demote 8 redundant agents to reduce routing overhead (#863)
  - Removed: requirements-translator, documentation-specialist, prompt-engineer, ux-researcher, rapid-ui-designer, business-case-builder, metrics-architect, prioritization-analyst
  - Agent count: 38 to 30, Hook count: 98 to 88 (10 agent-scoped hooks removed)
  - Reduces routing complexity and eliminates ~98k tokens/invocation for unnecessary agent spawns
- **docs(build):** Document skills/commands duplication token waste (#889) with upstream CC bug tracking

### Removed

- CC-v3 feature issues (#930-933) removed from perf milestone — already built, architecturally impossible, or superseded by CC native tools


## [7.1.2] - 2026-03-04

### Added

- **browser-tools skill v3.0.0**: 7 new sections documenting agent-browser v0.16 features (semantic locators, mouse commands, tab management, debug/recording, mobile testing, configuration flags, auth vault)
- **2 new rules**: `browser-debug-recording.md` (trace/profiler safety), `browser-mobile-testing.md` (device emulation verification)
- **3 new safety hook checks**: `--allow-file-access` warning, `AGENT_BROWSER_ENCRYPTION_KEY` leak prevention, `--user-agent` spoofing warning
- **4 new hook test cases** (14/14 passing)
- Updated 4 agents (web-research-analyst, test-generator, accessibility-specialist, frontend-ui-developer) with v0.16 capabilities
- Expanded 4 existing rules with v0.16 flags and patterns

---


## [7.1.1] - 2026-03-04

### Fixed

- **NotebookLM MCP bloat** (#890): Disabled `notebooklm-mcp` at project level (`disabled: true` in `.mcp.json`), saving ~6k tokens/session from 25 unused tools
- **Tool name mismatch**: Fixed `mcp__notebooklm__*` → `mcp__notebooklm-mcp__*` across `release-notebook` skill, `notebooklm` rules, and `create-release-notebook.sh`
- **Release-notebook flow**: Wired `release-notebook` skill into `release-engineer` agent; fixed shell script instructions (removed non-existent `/ork:release-notebook` command reference)
- **Perf test allowlist**: Updated `test-mcp-overhead.sh` to reference `release-engineer` instead of phantom `release-notebook` agent

---

## [7.1.0] - 2026-03-04

### Added

- **Full agent-browser CLI adoption** (#947 #948 #949): 64 commands across 12 categories documented in browser-tools skill
- **Interaction commands**: click, dblclick, focus, fill, type, keyboard, press, hover, check/uncheck, select, scroll, scrollintoview, drag, upload (22 commands)
- **Storage API** (v0.13): localStorage/sessionStorage get, set, clear
- **Enhanced capture**: screenshot --full, screenshot --annotate, pdf export
- **Extraction**: eval, eval -b, eval --stdin
- **Action confirmation** (v0.15): native --confirm-interactive with env-gated `AGENT_BROWSER_NATIVE_CONFIRM`
- **Network route validation**: agent-browser-safety hook Check 5 validates route URLs against blocklist
- **6 agents updated**: web-research-analyst, test-generator, accessibility-specialist, frontend-ui-developer, rapid-ui-designer, frontend-performance-engineer
- **3 rules updated**: browser-auth-security, browser-rate-limiting, browser-snapshot-workflow
- **Configurable settings wizard** (#951): setup skill writes to .claude/settings.json for non-orchestkit projects
- **Performance sprint**: injection gating, CI gate, perf-compare, perf-snapshot hook (#865 #944 #945 #946)

---


## [7.0.3] - 2026-03-04

### Fixed

- **Assessment quality gaps** (#946): address code-quality-reviewer blockers in verify skill

---


## [7.0.2] - 2026-03-03

### Added

- **Session handoffs** (#464): Structured YAML handoffs on SessionEnd with auto-injection on SessionStart for cross-session continuity
- **Release notebook skill** (#836): `release-notebook` skill creates versioned NotebookLM notebooks per release with changelog, manifest, and CLAUDE.md sources
- **Release notebook script** (#836): `scripts/create-release-notebook.sh` for manual/CI invocation

### Changed

- **Native HTTP hooks** (#896): Converted 3 HQ reporters (session-end, worktree-create, worktree-remove) from type:command to type:http — eliminates ~200ms Node spawn per fire
- Hook count: 95 -> 97 (36 global + 54 agent-scoped + 7 skill-scoped)
- Skill count: 69 -> 70

---


## [7.0.1] - 2026-03-03

### Fixed

- Add agents/hooks paths to plugin.json and build script (#900)
- Add metadata.description and tags to marketplace.json (#900)
- Fix 3 agents with empty mcpServers that use memory skills (#887)
- Fix localhost regex false positive on *.localhost TLD (#935)

---


## [7.0.0] - 2026-02-26

### Breaking Changes

- **plugins:** Unified plugin architecture — `orkl` and `ork-creative` removed, consolidated into single `ork` plugin (69 skills, 38 agents, 96 hooks). Migration: `claude plugin uninstall orkl && claude plugin install ork`.

### Added

- **setup:** New setup wizard skill (`/ork:setup`) — scans codebase, detects stack, recommends skills and MCPs, generates readiness score
- **notifications:** Satisfaction detector bug nudge — suggests `/ork:feedback bug` after 2+ negative signals per session
- **mcp:** NotebookLM MCP integration — skill, hooks, rules for NotebookLM workflows
- **release:** Release channels (alpha/beta/stable) with branch-based CI workflows and `--ref` marketplace flag
- **settings:** 8 chord keybindings for top skills (`ctrl+k ctrl+f` → fix-issue, `ctrl+k ctrl+i` → implement, etc.)
- **settings:** StatusLine showing ork version, git branch, and uncommitted file count
- **settings:** 10 spinner tips for skill discovery (e.g., "/ork:memory search to find past decisions")
- **skills:** AskUserQuestion markdown previews on 12 skills — side-by-side ASCII diagrams showing what each mode does (assess, verify, explore, review-pr, fix-issue, audit-full, help, memory, brainstorming, implement, plan-viz, setup)
- **skills:** `multiSelect: true` on audit-full (combinable audit modes), verify (combinable checks), setup (combinable focus areas)
- **skills:** EnterPlanMode "Plan first" option on implement, fix-issue, brainstorming — research before coding
- **skills:** Skill listing demotion — 58 → 16 listed skills via `disable-model-invocation: true` (~2,630 tokens/turn saved)
- **tests:** `test-settings-validation.sh` — validates keybindings, statusLine, spinnerVerbs, spinnerTips, permissions
- **tests:** `test-skill-cc-features.sh` — validates AUQ previews, multiSelect, EnterPlanMode, argument-hints, listing balance

### Changed

- **settings:** Unified all plugin settings: identical spinner verbs and permissions across all plugins
- **notifications:** Desktop notification sound handling delegated to dedicated sound.ts module with command cache for performance
- **hooks:** Unified notification dispatcher with simplified error filtering and HookFn type usage
- **hooks:** Replaced 2 HTTP session-end hooks with command hook (HMAC-signed POST)
- **hooks:** Consolidated 55 → 37 global hooks via 6 sync dispatchers, then expanded to 96 total (35 global + 54 agent-scoped + 7 skill-scoped)
- **manifests:** Composite index budget bumped from 16KB to 20KB to accommodate unified plugins

### Fixed

- Sound notifications now use detached spawn to survive async hook exit
- Bump Hono from 4.12.0 to 4.12.2 (CVE-2026-27700)
- 6 Bash security hook vulnerabilities fixed (#879-#883)

---

## [6.7.2] - 2026-02-26

### Fixed

- Bump skill count 68 → 69 across manifests and docs
- Bump Hono 4.12.0 → 4.12.2 (CVE-2026-27700)
- Bump to v6.7.2

---


## [6.7.1] - 2026-02-25

### Breaking Changes

- **skills:** Remove `worktree-coordination` skill — fully superseded by native CC 2.1.56 EnterWorktree tool and Task(isolation:"worktree") (#830)

### Features

- **eval:** Overhaul eval skills, agents, and LangGraph/Langfuse compatibility
- **skills:** Extract `create-pr` into 7 rules + 4 references (274→156 lines)
- **skills:** Compress 8 bloated skills (demo-producer, plan-viz, doctor, fix-issue, skill-evolution, verify, memory, assess) with content preserved in rules/references
- **testing:** Add 3 new test suites: agent skill refs, build drift, cross-skill refs

### Fixed

- Fix 20 broken cross-skill references across 12 skills
- Fix 5 weak skill descriptions (configure, feedback, help, release-checklist, skill-evolution)
- Bump minimum Claude Code version to 2.1.56
- Resolve all verification findings (Langfuse v2 remnants, credential warnings, sync guards)

---


## [6.7.0](https://github.com/yonatangross/orchestkit/compare/v6.6.3...v6.7.0) (2026-02-23)


### Features

* dead code cleanup & PostToolUse consolidation ([#684](https://github.com/yonatangross/orchestkit/issues/684)) ([#790](https://github.com/yonatangross/orchestkit/issues/790)) ([da245ac](https://github.com/yonatangross/orchestkit/commit/da245ac82c587763b95269c62bf2b9f3c44115d3))
* **docs:** add Vercel Analytics, Speed Insights, and dynamic social proof ([#809](https://github.com/yonatangross/orchestkit/issues/809), [#810](https://github.com/yonatangross/orchestkit/issues/810)) ([#812](https://github.com/yonatangross/orchestkit/issues/812)) ([714af85](https://github.com/yonatangross/orchestkit/commit/714af856d4983c2d87d7b5c936c9284e549b003f))
* integrate Claude Code 2.1.50 features ([#805](https://github.com/yonatangross/orchestkit/issues/805)) ([60a16d2](https://github.com/yonatangross/orchestkit/commit/60a16d210227a343364266c7e3b0ee544f80af0e))
* security hardening & hook consolidation (Milestone [#72](https://github.com/yonatangross/orchestkit/issues/72)) ([#788](https://github.com/yonatangross/orchestkit/issues/788)) ([5f014b4](https://github.com/yonatangross/orchestkit/commit/5f014b477d7e4aad04fbaeb13d8b72db08edc19a))
* **skills:** add presentation-builder skill ([#817](https://github.com/yonatangross/orchestkit/issues/817)) ([93cacda](https://github.com/yonatangross/orchestkit/commit/93cacda9e19322126cbd8e01af69b2d98bb16146))


### Bug Fixes

* add plugins/ plugin.json to release-please extra-files ([#822](https://github.com/yonatangross/orchestkit/issues/822)) ([8eb27cb](https://github.com/yonatangross/orchestkit/commit/8eb27cbb258bb1b8d6d0f175691b2c240c3c060b))
* eliminate 32 code scanning alerts (19 CodeQL + 13 Scorecard) ([#792](https://github.com/yonatangross/orchestkit/issues/792)) ([12e796b](https://github.com/yonatangross/orchestkit/commit/12e796b5a715b930f43eaa8e08d9fa38603e867d))
* eliminate 91 CodeQL alerts + fix 30 pre-existing test failures ([#782](https://github.com/yonatangross/orchestkit/issues/782)) ([ca47641](https://github.com/yonatangross/orchestkit/commit/ca476416b81c217998af5e9b5305b44a4b6ffa8a))
* **release:** scope release-please from v6.1.0 to prevent 7.0.0 ([#786](https://github.com/yonatangross/orchestkit/issues/786)) ([83a248b](https://github.com/yonatangross/orchestkit/commit/83a248b522313c453fa9fbdeb5e020998542350f))
* remove 35 broken symlinks from .claude/ ([#813](https://github.com/yonatangross/orchestkit/issues/813)) ([3bd179c](https://github.com/yonatangross/orchestkit/commit/3bd179c919b8367fbe100f0080fe3e263b002472))
* resolve 21 code scanning alerts (17 CodeQL + 4 Scorecard) ([#825](https://github.com/yonatangross/orchestkit/issues/825)) ([00e9ed8](https://github.com/yonatangross/orchestkit/commit/00e9ed883dad67e74e7b3b9fbc0e2361c9dac80f))
* sanitize shell arg in security-scan-aggregator bandit command ([#828](https://github.com/yonatangross/orchestkit/issues/828)) ([18c0415](https://github.com/yonatangross/orchestkit/commit/18c0415ad99d949b082115a978d6f560a69f378f))
* sync manifests and pyproject.toml to v6.3.0 ([#806](https://github.com/yonatangross/orchestkit/issues/806)) ([d06661d](https://github.com/yonatangross/orchestkit/commit/d06661d18a3386367c8a1c3ae06b071a657c885c))
* use jq for plugin.json generation to match release-please format ([#824](https://github.com/yonatangross/orchestkit/issues/824)) ([0a37a07](https://github.com/yonatangross/orchestkit/commit/0a37a07a411c17e2503d135ffbca2423ea0e9624))


### Miscellaneous

* **main:** release 6.1.3 ([#787](https://github.com/yonatangross/orchestkit/issues/787)) ([612ad89](https://github.com/yonatangross/orchestkit/commit/612ad8939f4a456ea5714212f96dab9cf6eca75a))
* **main:** release 6.2.0 ([#789](https://github.com/yonatangross/orchestkit/issues/789)) ([54042ff](https://github.com/yonatangross/orchestkit/commit/54042ff5f4a4e654e9bb05708a752cd71ce10a97))
* **main:** release 6.2.0 ([#791](https://github.com/yonatangross/orchestkit/issues/791)) ([a37b5d4](https://github.com/yonatangross/orchestkit/commit/a37b5d40ec2c5d3af330af6e3263d16a2b961685))
* **main:** release 6.3.0 ([#793](https://github.com/yonatangross/orchestkit/issues/793)) ([737982c](https://github.com/yonatangross/orchestkit/commit/737982c15349dcd24a92cd04993b46c09b2a37a0))
* **main:** release 6.4.0 ([#808](https://github.com/yonatangross/orchestkit/issues/808)) ([bfbdbf3](https://github.com/yonatangross/orchestkit/commit/bfbdbf3c6d4d8c6945ddc0430cb52d28ba5e132b))
* **main:** release 6.5.0 ([#814](https://github.com/yonatangross/orchestkit/issues/814)) ([05cf210](https://github.com/yonatangross/orchestkit/commit/05cf2100e0a1365551ee7406ca681de18f983a6c))
* **main:** release 6.6.0 ([#823](https://github.com/yonatangross/orchestkit/issues/823)) ([70282ea](https://github.com/yonatangross/orchestkit/commit/70282ea9f0b6cd218aa620e224d8141b091c63db))


### CI/CD

* bump actions/attest-build-provenance from 2.4.0 to 3.2.0 ([#816](https://github.com/yonatangross/orchestkit/issues/816)) ([04a2cee](https://github.com/yonatangross/orchestkit/commit/04a2cee77500cb544e35bd02dc85a397f8f3c810))
* bump github/codeql-action from 4.32.3 to 4.32.4 ([#815](https://github.com/yonatangross/orchestkit/issues/815)) ([e31096e](https://github.com/yonatangross/orchestkit/commit/e31096e7624424e1c37c2e7baaabccf8c6b782d6))
* pin package manager dependencies for Scorecard compliance ([#827](https://github.com/yonatangross/orchestkit/issues/827)) ([45dec20](https://github.com/yonatangross/orchestkit/commit/45dec207b7be47814e7598e718244844ff950ac8))
* restrict workflow-level permissions to read-all in release-please ([#820](https://github.com/yonatangross/orchestkit/issues/820)) ([8e03fe5](https://github.com/yonatangross/orchestkit/commit/8e03fe5eca022aa71a65820e47cd5dac652380f9))

## [6.6.3] - 2026-02-23

### Fixed

- Sanitize `resultsDir` in security-scan-aggregator bandit command (CodeQL alert #43)

---


## [6.6.2] - 2026-02-23

### Changed

- Use `npm ci` instead of `npm install` in CI for lockfile-based integrity hashes
- Remove unnecessary Python/pip dependency from schema validation (uses built-in basic validator)

---


## [6.6.1] - 2026-02-23

### Fixed

- TODO: Describe your changes here

---


## [6.6.0](https://github.com/yonatangross/orchestkit/compare/v6.5.3...v6.6.0) (2026-02-23)


### Features

* dead code cleanup & PostToolUse consolidation ([#684](https://github.com/yonatangross/orchestkit/issues/684)) ([#790](https://github.com/yonatangross/orchestkit/issues/790)) ([da245ac](https://github.com/yonatangross/orchestkit/commit/da245ac82c587763b95269c62bf2b9f3c44115d3))
* **docs:** add Vercel Analytics, Speed Insights, and dynamic social proof ([#809](https://github.com/yonatangross/orchestkit/issues/809), [#810](https://github.com/yonatangross/orchestkit/issues/810)) ([#812](https://github.com/yonatangross/orchestkit/issues/812)) ([714af85](https://github.com/yonatangross/orchestkit/commit/714af856d4983c2d87d7b5c936c9284e549b003f))
* integrate Claude Code 2.1.50 features ([#805](https://github.com/yonatangross/orchestkit/issues/805)) ([60a16d2](https://github.com/yonatangross/orchestkit/commit/60a16d210227a343364266c7e3b0ee544f80af0e))
* security hardening & hook consolidation (Milestone [#72](https://github.com/yonatangross/orchestkit/issues/72)) ([#788](https://github.com/yonatangross/orchestkit/issues/788)) ([5f014b4](https://github.com/yonatangross/orchestkit/commit/5f014b477d7e4aad04fbaeb13d8b72db08edc19a))
* **skills:** add presentation-builder skill ([#817](https://github.com/yonatangross/orchestkit/issues/817)) ([93cacda](https://github.com/yonatangross/orchestkit/commit/93cacda9e19322126cbd8e01af69b2d98bb16146))


### Bug Fixes

* add plugins/ plugin.json to release-please extra-files ([#822](https://github.com/yonatangross/orchestkit/issues/822)) ([8eb27cb](https://github.com/yonatangross/orchestkit/commit/8eb27cbb258bb1b8d6d0f175691b2c240c3c060b))
* eliminate 32 code scanning alerts (19 CodeQL + 13 Scorecard) ([#792](https://github.com/yonatangross/orchestkit/issues/792)) ([12e796b](https://github.com/yonatangross/orchestkit/commit/12e796b5a715b930f43eaa8e08d9fa38603e867d))
* eliminate 91 CodeQL alerts + fix 30 pre-existing test failures ([#782](https://github.com/yonatangross/orchestkit/issues/782)) ([ca47641](https://github.com/yonatangross/orchestkit/commit/ca476416b81c217998af5e9b5305b44a4b6ffa8a))
* **release:** scope release-please from v6.1.0 to prevent 7.0.0 ([#786](https://github.com/yonatangross/orchestkit/issues/786)) ([83a248b](https://github.com/yonatangross/orchestkit/commit/83a248b522313c453fa9fbdeb5e020998542350f))
* remove 35 broken symlinks from .claude/ ([#813](https://github.com/yonatangross/orchestkit/issues/813)) ([3bd179c](https://github.com/yonatangross/orchestkit/commit/3bd179c919b8367fbe100f0080fe3e263b002472))
* sync manifests and pyproject.toml to v6.3.0 ([#806](https://github.com/yonatangross/orchestkit/issues/806)) ([d06661d](https://github.com/yonatangross/orchestkit/commit/d06661d18a3386367c8a1c3ae06b071a657c885c))
* use jq for plugin.json generation to match release-please format ([#824](https://github.com/yonatangross/orchestkit/issues/824)) ([0a37a07](https://github.com/yonatangross/orchestkit/commit/0a37a07a411c17e2503d135ffbca2423ea0e9624))


### Miscellaneous

* **main:** release 6.1.3 ([#787](https://github.com/yonatangross/orchestkit/issues/787)) ([612ad89](https://github.com/yonatangross/orchestkit/commit/612ad8939f4a456ea5714212f96dab9cf6eca75a))
* **main:** release 6.2.0 ([#789](https://github.com/yonatangross/orchestkit/issues/789)) ([54042ff](https://github.com/yonatangross/orchestkit/commit/54042ff5f4a4e654e9bb05708a752cd71ce10a97))
* **main:** release 6.2.0 ([#791](https://github.com/yonatangross/orchestkit/issues/791)) ([a37b5d4](https://github.com/yonatangross/orchestkit/commit/a37b5d40ec2c5d3af330af6e3263d16a2b961685))
* **main:** release 6.3.0 ([#793](https://github.com/yonatangross/orchestkit/issues/793)) ([737982c](https://github.com/yonatangross/orchestkit/commit/737982c15349dcd24a92cd04993b46c09b2a37a0))
* **main:** release 6.4.0 ([#808](https://github.com/yonatangross/orchestkit/issues/808)) ([bfbdbf3](https://github.com/yonatangross/orchestkit/commit/bfbdbf3c6d4d8c6945ddc0430cb52d28ba5e132b))
* **main:** release 6.5.0 ([#814](https://github.com/yonatangross/orchestkit/issues/814)) ([05cf210](https://github.com/yonatangross/orchestkit/commit/05cf2100e0a1365551ee7406ca681de18f983a6c))


### CI/CD

* bump actions/attest-build-provenance from 2.4.0 to 3.2.0 ([#816](https://github.com/yonatangross/orchestkit/issues/816)) ([04a2cee](https://github.com/yonatangross/orchestkit/commit/04a2cee77500cb544e35bd02dc85a397f8f3c810))
* bump github/codeql-action from 4.32.3 to 4.32.4 ([#815](https://github.com/yonatangross/orchestkit/issues/815)) ([e31096e](https://github.com/yonatangross/orchestkit/commit/e31096e7624424e1c37c2e7baaabccf8c6b782d6))
* restrict workflow-level permissions to read-all in release-please ([#820](https://github.com/yonatangross/orchestkit/issues/820)) ([8e03fe5](https://github.com/yonatangross/orchestkit/commit/8e03fe5eca022aa71a65820e47cd5dac652380f9))

## [6.5.3] - 2026-02-23

### Fixed

- TODO: Describe your changes here

---


## [6.5.2] - 2026-02-23

### Fixed

- TODO: Describe your changes here

---


## [6.5.1] - 2026-02-23

### Features

- Add `presentation-builder` skill — zero-dependency HTML slide presentations with viewport fitting, 12 style presets, PPT conversion, and keyboard/touch navigation (adopted from zarazhangrui/frontend-slides, restructured into OrchestKit format)
- Skill count: 67 → 68 skills, 28 → 29 user-invocable

---


## [6.5.0](https://github.com/yonatangross/orchestkit/compare/v6.4.1...v6.5.0) (2026-02-22)


### Features

* dead code cleanup & PostToolUse consolidation ([#684](https://github.com/yonatangross/orchestkit/issues/684)) ([#790](https://github.com/yonatangross/orchestkit/issues/790)) ([da245ac](https://github.com/yonatangross/orchestkit/commit/da245ac82c587763b95269c62bf2b9f3c44115d3))
* **docs:** add Vercel Analytics, Speed Insights, and dynamic social proof ([#809](https://github.com/yonatangross/orchestkit/issues/809), [#810](https://github.com/yonatangross/orchestkit/issues/810)) ([#812](https://github.com/yonatangross/orchestkit/issues/812)) ([714af85](https://github.com/yonatangross/orchestkit/commit/714af856d4983c2d87d7b5c936c9284e549b003f))
* integrate Claude Code 2.1.50 features ([#805](https://github.com/yonatangross/orchestkit/issues/805)) ([60a16d2](https://github.com/yonatangross/orchestkit/commit/60a16d210227a343364266c7e3b0ee544f80af0e))
* security hardening & hook consolidation (Milestone [#72](https://github.com/yonatangross/orchestkit/issues/72)) ([#788](https://github.com/yonatangross/orchestkit/issues/788)) ([5f014b4](https://github.com/yonatangross/orchestkit/commit/5f014b477d7e4aad04fbaeb13d8b72db08edc19a))


### Bug Fixes

* eliminate 32 code scanning alerts (19 CodeQL + 13 Scorecard) ([#792](https://github.com/yonatangross/orchestkit/issues/792)) ([12e796b](https://github.com/yonatangross/orchestkit/commit/12e796b5a715b930f43eaa8e08d9fa38603e867d))
* eliminate 91 CodeQL alerts + fix 30 pre-existing test failures ([#782](https://github.com/yonatangross/orchestkit/issues/782)) ([ca47641](https://github.com/yonatangross/orchestkit/commit/ca476416b81c217998af5e9b5305b44a4b6ffa8a))
* **release:** scope release-please from v6.1.0 to prevent 7.0.0 ([#786](https://github.com/yonatangross/orchestkit/issues/786)) ([83a248b](https://github.com/yonatangross/orchestkit/commit/83a248b522313c453fa9fbdeb5e020998542350f))
* remove 35 broken symlinks from .claude/ ([#813](https://github.com/yonatangross/orchestkit/issues/813)) ([3bd179c](https://github.com/yonatangross/orchestkit/commit/3bd179c919b8367fbe100f0080fe3e263b002472))
* sync manifests and pyproject.toml to v6.3.0 ([#806](https://github.com/yonatangross/orchestkit/issues/806)) ([d06661d](https://github.com/yonatangross/orchestkit/commit/d06661d18a3386367c8a1c3ae06b071a657c885c))


### Miscellaneous

* **main:** release 6.1.3 ([#787](https://github.com/yonatangross/orchestkit/issues/787)) ([612ad89](https://github.com/yonatangross/orchestkit/commit/612ad8939f4a456ea5714212f96dab9cf6eca75a))
* **main:** release 6.2.0 ([#789](https://github.com/yonatangross/orchestkit/issues/789)) ([54042ff](https://github.com/yonatangross/orchestkit/commit/54042ff5f4a4e654e9bb05708a752cd71ce10a97))
* **main:** release 6.2.0 ([#791](https://github.com/yonatangross/orchestkit/issues/791)) ([a37b5d4](https://github.com/yonatangross/orchestkit/commit/a37b5d40ec2c5d3af330af6e3263d16a2b961685))
* **main:** release 6.3.0 ([#793](https://github.com/yonatangross/orchestkit/issues/793)) ([737982c](https://github.com/yonatangross/orchestkit/commit/737982c15349dcd24a92cd04993b46c09b2a37a0))
* **main:** release 6.4.0 ([#808](https://github.com/yonatangross/orchestkit/issues/808)) ([bfbdbf3](https://github.com/yonatangross/orchestkit/commit/bfbdbf3c6d4d8c6945ddc0430cb52d28ba5e132b))

## [6.4.1] - 2026-02-22

### Fixed

- TODO: Describe your changes here

---


## [6.4.0](https://github.com/yonatangross/orchestkit/compare/v6.3.0...v6.4.0) (2026-02-22)


### Features

* **docs:** add Vercel Analytics, Speed Insights, and dynamic social proof ([#809](https://github.com/yonatangross/orchestkit/issues/809), [#810](https://github.com/yonatangross/orchestkit/issues/810)) ([#812](https://github.com/yonatangross/orchestkit/issues/812)) ([714af85](https://github.com/yonatangross/orchestkit/commit/714af856d4983c2d87d7b5c936c9284e549b003f))


### Bug Fixes

* sync manifests and pyproject.toml to v6.3.0 ([#806](https://github.com/yonatangross/orchestkit/issues/806)) ([d06661d](https://github.com/yonatangross/orchestkit/commit/d06661d18a3386367c8a1c3ae06b071a657c885c))

## [6.3.0](https://github.com/yonatangross/orchestkit/compare/v6.2.1...v6.3.0) (2026-02-21)


### Bug Fixes

* sync manifests and pyproject.toml to v6.3.0 (release-please gap)


### Features

* dead code cleanup & PostToolUse consolidation ([#684](https://github.com/yonatangross/orchestkit/issues/684)) ([#790](https://github.com/yonatangross/orchestkit/issues/790)) ([da245ac](https://github.com/yonatangross/orchestkit/commit/da245ac82c587763b95269c62bf2b9f3c44115d3))
* integrate Claude Code 2.1.50 features ([#805](https://github.com/yonatangross/orchestkit/issues/805)) ([60a16d2](https://github.com/yonatangross/orchestkit/commit/60a16d210227a343364266c7e3b0ee544f80af0e))
* security hardening & hook consolidation (Milestone [#72](https://github.com/yonatangross/orchestkit/issues/72)) ([#788](https://github.com/yonatangross/orchestkit/issues/788)) ([5f014b4](https://github.com/yonatangross/orchestkit/commit/5f014b477d7e4aad04fbaeb13d8b72db08edc19a))


### Bug Fixes

* eliminate 32 code scanning alerts (19 CodeQL + 13 Scorecard) ([#792](https://github.com/yonatangross/orchestkit/issues/792)) ([12e796b](https://github.com/yonatangross/orchestkit/commit/12e796b5a715b930f43eaa8e08d9fa38603e867d))
* eliminate 91 CodeQL alerts + fix 30 pre-existing test failures ([#782](https://github.com/yonatangross/orchestkit/issues/782)) ([ca47641](https://github.com/yonatangross/orchestkit/commit/ca476416b81c217998af5e9b5305b44a4b6ffa8a))
* **release:** scope release-please from v6.1.0 to prevent 7.0.0 ([#786](https://github.com/yonatangross/orchestkit/issues/786)) ([83a248b](https://github.com/yonatangross/orchestkit/commit/83a248b522313c453fa9fbdeb5e020998542350f))


### Miscellaneous

* **main:** release 6.1.3 ([#787](https://github.com/yonatangross/orchestkit/issues/787)) ([612ad89](https://github.com/yonatangross/orchestkit/commit/612ad8939f4a456ea5714212f96dab9cf6eca75a))
* **main:** release 6.2.0 ([#789](https://github.com/yonatangross/orchestkit/issues/789)) ([54042ff](https://github.com/yonatangross/orchestkit/commit/54042ff5f4a4e654e9bb05708a752cd71ce10a97))
* **main:** release 6.2.0 ([#791](https://github.com/yonatangross/orchestkit/issues/791)) ([a37b5d4](https://github.com/yonatangross/orchestkit/commit/a37b5d40ec2c5d3af330af6e3263d16a2b961685))

## [6.2.1] - 2026-02-21

### Added

- WorktreeCreate and WorktreeRemove hook events with lifecycle logger handler (CC 2.1.50)
- `isolation: worktree` frontmatter on test-generator, demo-producer, git-operations-engineer agents
- CC feature matrix entries for 2.1.49 (EnterWorktree tool) and 2.1.50 (7 features)
- Doctor skill memory leak warning for CC < 2.1.50 (8 leaks fixed)
- Doctor agent registration health check using `claude agents` CLI (CC 2.1.50)
- audit-full guard for `CLAUDE_CODE_DISABLE_1M_CONTEXT` env var

### Changed

- Hook counts: 52 → 54 global, 75 → 77 total, 15 → 17 event types
- upgrade-assessment skill updated with 2.1.50 breaking changes and memory leak note
- worktree-coordination skill updated with lifecycle hooks section and compatibility bump to 2.1.50

---


## [6.1.6] - 2026-02-20

### Security

- Fix 16 CodeQL shell injection alerts — convert execSync template strings to execFileSync array form
- Fix 2 CodeQL incomplete string escaping alerts (issue-work-summary, session-cleanup)
- Fix 1 CodeQL DOM XSS alert in coverage report (innerHTML → createElement)
- Add shell.ts helpers: shellEscape(), isValidGitRef(), safeGitExec()
- Harden GitHub Actions workflows: add explicit permissions blocks (least-privilege)
- Pin jsonschema dependency version in plugin-validation workflow

---


## [6.1.5] - 2026-02-20

### Fixed

- Harden Scorecard workflow security: add explicit job-level permissions to release-please job (least-privilege)
- Pin jsonschema dependency to v4.23.0 in plugin-validation workflow (Pinned-Dependencies alert)
- Add --no-audit flags to npm commands in ci-setup.sh for reproducible builds

---


## [6.2.0](https://github.com/yonatangross/orchestkit/compare/v6.1.4...v6.2.0) (2026-02-20)


### Features

* dead code cleanup & PostToolUse consolidation ([#684](https://github.com/yonatangross/orchestkit/issues/684)) ([#790](https://github.com/yonatangross/orchestkit/issues/790)) ([da245ac](https://github.com/yonatangross/orchestkit/commit/da245ac82c587763b95269c62bf2b9f3c44115d3))
* security hardening & hook consolidation (Milestone [#72](https://github.com/yonatangross/orchestkit/issues/72)) ([#788](https://github.com/yonatangross/orchestkit/issues/788)) ([5f014b4](https://github.com/yonatangross/orchestkit/commit/5f014b477d7e4aad04fbaeb13d8b72db08edc19a))


### Bug Fixes

* eliminate 91 CodeQL alerts + fix 30 pre-existing test failures ([#782](https://github.com/yonatangross/orchestkit/issues/782)) ([ca47641](https://github.com/yonatangross/orchestkit/commit/ca476416b81c217998af5e9b5305b44a4b6ffa8a))
* **release:** scope release-please from v6.1.0 to prevent 7.0.0 ([#786](https://github.com/yonatangross/orchestkit/issues/786)) ([83a248b](https://github.com/yonatangross/orchestkit/commit/83a248b522313c453fa9fbdeb5e020998542350f))


### Miscellaneous

* **main:** release 6.1.3 ([#787](https://github.com/yonatangross/orchestkit/issues/787)) ([612ad89](https://github.com/yonatangross/orchestkit/commit/612ad8939f4a456ea5714212f96dab9cf6eca75a))
* **main:** release 6.2.0 ([#789](https://github.com/yonatangross/orchestkit/issues/789)) ([54042ff](https://github.com/yonatangross/orchestkit/commit/54042ff5f4a4e654e9bb05708a752cd71ce10a97))

## [6.1.4] - 2026-02-20

### Changed

- Consolidate PostToolUse hooks.json entries from 4 to 1 async dispatcher (#684)
- Move redact-secrets, config-change-auditor, team-member-start, error-logger into unified-dispatcher
- Strip solution-suggestion machinery from unified-error-handler (~250 LOC)

### Removed

- Dead hooks: context-budget-monitor (225 LOC), posttool/skill-nudge (47 LOC), context-compressor (159 LOC)
- Dead context/ files: 7 agent JSONs, 1 orphaned archive session
- Dead path helpers: getMcpDeferStateFile, getErrorSuggestionsDedupFile

### Fixed

- skill-edit-tracker path bug (missing `context/` segment in session state path)

---


## [6.2.0](https://github.com/yonatangross/orchestkit/compare/v6.1.3...v6.2.0) (2026-02-20)


### Features

* security hardening & hook consolidation (Milestone [#72](https://github.com/yonatangross/orchestkit/issues/72)) ([#788](https://github.com/yonatangross/orchestkit/issues/788)) ([5f014b4](https://github.com/yonatangross/orchestkit/commit/5f014b477d7e4aad04fbaeb13d8b72db08edc19a))

## [6.1.3](https://github.com/yonatangross/orchestkit/compare/v6.1.2...v6.1.3) (2026-02-20)


### Bug Fixes

* eliminate 91 CodeQL alerts + fix 30 pre-existing test failures ([#782](https://github.com/yonatangross/orchestkit/issues/782)) ([ca47641](https://github.com/yonatangross/orchestkit/commit/ca476416b81c217998af5e9b5305b44a4b6ffa8a))
* **release:** scope release-please from v6.1.0 to prevent 7.0.0 ([#786](https://github.com/yonatangross/orchestkit/issues/786)) ([83a248b](https://github.com/yonatangross/orchestkit/commit/83a248b522313c453fa9fbdeb5e020998542350f))

## [6.1.2] - 2026-02-20

### Fixed

- Stale model name in cost-estimation.md (claude-sonnet-4-5 → claude-sonnet-4-6)
- CC version badge and FAQ updated from >=2.1.34 to >=2.1.49

---


## [6.1.1] - 2026-02-20

### Fixed

- Release-please configuration scoped to prevent major version bump

---


## [6.1.0](https://github.com/yonatangross/orchestkit/compare/v6.0.26...v6.1.0) (2026-02-20)


### Features

* CC 2.1.49 full adoption — hooks, agents, MCP overhaul ([#780](https://github.com/yonatangross/orchestkit/issues/780)) ([1234c46](https://github.com/yonatangross/orchestkit/commit/1234c462436aafcfa9027b08d93324db407219e2))

## [6.0.27] - 2026-02-20

### Security

- Eliminate 30 CodeQL ReDoS vulnerabilities (js/polynomial-redos) across 12 hook files
- Replace polynomial-time regex patterns with O(n) string operations
- Dismiss 1 Dependabot alert (ajv ReDoS in demo project — tolerable risk)

## [6.0.26](https://github.com/yonatangross/orchestkit/compare/v6.0.25...v6.0.26) (2026-02-20)


### Miscellaneous

* **deps-dev:** bump hono ([#761](https://github.com/yonatangross/orchestkit/issues/761)) ([fdc6f69](https://github.com/yonatangross/orchestkit/commit/fdc6f6916abebe40ef923a531b85d31c8b72b8dd))


### CI/CD

* 2026 best practices — permissions, CodeQL, SLSA, merge queue ([57ca595](https://github.com/yonatangross/orchestkit/commit/57ca595f27295787c33ed47bbb35e7472d7db88d))

## [6.0.25](https://github.com/yonatangross/orchestkit/compare/v6.0.24...v6.0.25) (2026-02-19)


### Bug Fixes

* **ci:** skip version check for Dependabot PRs ([#758](https://github.com/yonatangross/orchestkit/issues/758)) ([45c850f](https://github.com/yonatangross/orchestkit/commit/45c850fe890ad0a9900361baba8a6ad18c44fadf))
* **ci:** use PAT for release-please to trigger CI on release PRs ([#760](https://github.com/yonatangross/orchestkit/issues/760)) ([5e8c700](https://github.com/yonatangross/orchestkit/commit/5e8c700d3a0d666a13c8f9aba9eb58e9371d7103))


### CI/CD

* bump actions/download-artifact from 5.0.0 to 7.0.0 ([#755](https://github.com/yonatangross/orchestkit/issues/755)) ([c28f49b](https://github.com/yonatangross/orchestkit/commit/c28f49b0b8a7c7dc7ee80a3cfeb969f79d8fb387))
* bump actions/upload-artifact from 5.0.0 to 6.0.0 ([#753](https://github.com/yonatangross/orchestkit/issues/753)) ([4a4f9e0](https://github.com/yonatangross/orchestkit/commit/4a4f9e0d8eb1a56f3c6551798695cc8422ad61ce))
* bump gitleaks/gitleaks-action ([#756](https://github.com/yonatangross/orchestkit/issues/756)) ([b929e1b](https://github.com/yonatangross/orchestkit/commit/b929e1b872268f02b64a42a5e75bf9b5b60e4f86))
* bump googleapis/release-please-action ([#754](https://github.com/yonatangross/orchestkit/issues/754)) ([8028579](https://github.com/yonatangross/orchestkit/commit/8028579b5178e18d08c9278fcce575e32e332d9d))

## [6.0.24] - 2026-02-19

### Fixed

- **Release automation** — rewrite release-please for v4 manifest mode; was failing on every push to main since v6.0.17 due to invalid inline params (`package-name`, `changelog-types`, `extra-files` silently ignored by v4)
- **Version sync** — create `version.txt` + `.release-please-config.json` with jsonpath for `package.json` and `marketplace.json` auto-update
- **Version drift** — sync package.json 6.0.20 and manifest 4.27.5 to match CHANGELOG 6.0.23
- **version-check** — skip validation for release-please automated PRs

---


## [6.0.23] - 2026-02-19

### Added

- **CC 2.1.47 Full Adoption** — Milestone #75 (19 issues: #710–#728)
- **`cc-version-matrix.ts`** — runtime feature compatibility matrix for 18 CC 2.1.47 features (`last_assistant_message`, `added_dirs`, deferred SessionStart, agent model in teams, worktree discovery, etc.)
- **`added_dirs` support** — `session-tracking`, `session-cleanup`, `session-context-loader`, `memory-capture`, and `monorepo-detector` hooks now read and log the new `added_dirs` hook input field
- **`last_assistant_message` support** — `memory-capture` uses `classifySessionOutcome()` for richer analytics; `session-cleanup` and `unified-dispatcher` log `last_msg_len`
- **Prefill-guard caching** — scan results cached for 24 hours with `CACHE_VERSION` invalidation, skipping expensive filesystem scans on repeat sessions
- **Worktree discovery tests** — 15 vitest path-resolution tests + 17 shell tests with real `git worktree add` creation/cleanup
- **Agent model field validation** — shell test validates all 37 agents have valid `model:` field for CC 2.1.47 team spawns
- **`hook-input-fields.test.ts`** — validates `added_dirs` type contract and confirms `enabledPlugins` is NOT a hook field
- **`configure` skill** — documents `added_dirs`, clarifies `enabledPlugins` is CC-internal (not hook-accessible)
- **`help` skill** — CC 2.1.47 keyboard shortcuts section (Ctrl+F, Shift+Down)
- **`upgrade-assessment`** — CC 2.1.47 upgrade guide reference

### Fixed

- **Cross-platform `/tmp` hardcode** — 13 hook source files migrated from `/tmp/claude-*` to `paths.ts` helpers using `os.tmpdir()` and `path.join()` (#720)
- **`ork:` prefix standardization** — ~120 violations fixed across 60 skill files for consistent cross-referencing (#716)
- **Test assertions** — 8 test files updated for `os.tmpdir()` compatibility (macOS `/var/folders/.../T/` vs Linux `/tmp`)
- **`node:path` mock** — test files now include proper default export when mocking `node:path`
- **User-invocable count** — `EXPECTED_USER_INVOCABLE` updated 24→28 in skill validation test

---


## [6.0.22] - 2026-02-18

### Added

- **Hook: `memory-capture`** — new Stop hook that auto-captures session summaries to `~/.claude/memory/decisions.jsonl` for sessions with >20 tool calls; nudges `/ork:remember` for sessions with >50 tool calls (#708)
- **Hook: `skill-nudge` (PostToolUse/Bash)** — nudges `/ork:create-pr` after a successful `git push` (#705)
- **Hook: `skill-nudge` (UserPromptSubmit)** — nudges `/ork:fix-issue` when a GitHub issue URL is detected in the prompt (#705)
- **Hook: `task-agent-advisor`** — PreToolUse[Task] hook that suggests curated ork agents for 14 common ad-hoc agent names and corrects 4 built-in casing errors (#704 #706)

### Fixed

- **Analytics: zero-tool sessions** — session-cleanup no longer writes to `session-summary.jsonl` when `total_tools == 0`, eliminating 57% noise from short/failed sessions (#707)
- **Cross-platform: `/tmp` hardcode** — session-cleanup and memory-capture now use `getMetricsFile()` (via `os.tmpdir()`) instead of hardcoded `/tmp/claude-session-metrics.json` (#704)
- **Analytics: jq-queries** — session count query now filters `total_tools > 0` to match corrected analytics data (#707)
- **Tests: agent casing** — `tests/unit/test-pretool-all-hooks.sh` corrected `"explore"` → `"Explore"` per CC 2.1.45 built-in naming spec (#704)

---


## [6.0.20] - 2026-02-18

### Added

- **Hook: `mcp-health-check`** — new SessionStart hook that silently detects MCP misconfigurations at session start: warns if Tavily is enabled but `TAVILY_API_KEY` is unset, or if agentation is enabled but `agentation-mcp` package is not installed. Respects `ORCHESTKIT_SKIP_SLOW_HOOKS=1`.
- **Skill: `github-operations`** — new `references/cli-vs-api-identifiers.md` mapping gh CLI identifiers (NAME) to REST API identifiers (NUMBER/node_id) for milestones, issues, PRs, and Projects v2 (#701)
- **Static analysis: Section E** — `scripts/eval/static-analysis.sh` now enforces CLI-vs-API identifier documentation for any skill mixing `--milestone` CLI flags with REST API milestone paths

### Fixed

- **Windows: console flashing** — fix fire-and-forget hooks spawning visible `cmd.exe` windows (`detached: true` → `detached: false` + `unref()`) (#644)
- **Windows: ENAMETOOLONG** — use `os.tmpdir()` for hook work files instead of deep project-dir paths (79 errors/session eliminated)
- **MCP defaults** — Tavily and agentation are now `"disabled": true` in `.mcp.json`; users opt in explicitly to avoid surprise API costs
- **MCP docs** — configure skill, doctor skill, installation.mdx, configuration.mdx, faq.mdx all updated to reflect accurate MCP status and setup instructions (#702)
- **github-operations: `--milestone` footgun** — explicit warning that `gh issue edit --milestone` takes a NAME (string), not a number; REST API uses NUMBER (#699)
- **issue-progress-tracking: close-on-merge rule** — added as Common Mistake #5; issues close only via `Closes #N` in PR body on merge, never via `gh issue close` directly

### Improved

- **Skill: `github-operations`** — batch issue creation pattern with array-driven loop and captured issue number (#700); Best Practice #9 (never close issues directly)
- **Skill: `issue-progress-tracking`** — close-on-merge workflow documented in Common Mistakes
- **Extract `spawn-worker.mjs`** — shared helper reduces 7 duplicated entry points (7 × 57 → 7 × 17 lines)
- **Cursor compat note** — `marketplace.json` documents why Cursor misreads `author` field as MCP server (#698)

---


## [6.0.19] - 2026-02-17

### Fixed

- **Hook: `memory-capture`** — new Stop hook that auto-captures session summaries to `~/.claude/memory/decisions.jsonl` for sessions with >20 tool calls; nudges `/ork:remember` for sessions with >50 tool calls (#708)
- **Hook: `skill-nudge` (PostToolUse/Bash)** — nudges `/ork:create-pr` after a successful `git push` (#705)
- **Hook: `skill-nudge` (UserPromptSubmit)** — nudges `/ork:fix-issue` when a GitHub issue URL is detected in the prompt (#705)
- **Hook: `task-agent-advisor`** — PreToolUse[Task] hook that suggests curated ork agents for 14 common ad-hoc agent names and corrects 4 built-in casing errors (#704 #706)

### Fixed

- **Analytics: zero-tool sessions** — session-cleanup no longer writes to `session-summary.jsonl` when `total_tools == 0`, eliminating 57% noise from short/failed sessions (#707)
- **Cross-platform: `/tmp` hardcode** — session-cleanup and memory-capture now use `getMetricsFile()` (via `os.tmpdir()`) instead of hardcoded `/tmp/claude-session-metrics.json` (#704)
- **Analytics: jq-queries** — session count query now filters `total_tools > 0` to match corrected analytics data (#707)
- **Tests: agent casing** — `tests/unit/test-pretool-all-hooks.sh` corrected `"explore"` → `"Explore"` per CC 2.1.45 built-in naming spec (#704)

---


## [6.0.18] - 2026-02-17

### Fixed

- Sync `package.json` version from 6.0.12 to 6.0.18 (was drifted from manifests)
- Create 19 missing git tags for all historical versions (v5.2.4 through v6.0.17)
- Fix all changelog compare links to resolve to valid tag comparisons
- Update `[Unreleased]` link to point to `v6.0.18...HEAD`

---


## [6.0.17] - 2026-02-17

### Added

- CI: Add `manifest-schema-tests` job (manifests, schemas, hooks, indexes)
- CI: Add `eval-static` job running `npm run eval:static` with artifact upload
- CI: Add build drift detection (`git diff --quiet plugins/`) to `build-plugins` job

### Fixed

- Rename `validate-evaluations.sh` → `test-validate-evaluations.sh` so CI test discovery (`test-*.sh` pattern) finds it
- Fix `test-agent-categories.sh`: add `research` to valid categories list
- Fix `test-category-grouping.sh`: update stale agent name, add missing agent/category mappings, fix category order

### Removed

- Delete stale `test-json-output-compliance.sh` (hooks migrated to TypeScript, tested via vitest)
- Delete stale `test-build-marketplace-sync.sh` (marketplace sync logic removed from build script)

---

## [6.0.16] - 2026-02-16

### Added

- Add `impactDescription` and `tags` metadata to 98 rule files across 9 skills
- Add `**Incorrect**`/`**Correct**` code example pairs to all 258 rules missing them
- Rule example coverage now 412/412 (100%)

### Fixed

- Fix 5 skill structure warnings (missing Overview/Related Skills sections)
- Resolve all 459 skill test warnings (196 metadata + 258 code examples + 5 structure)

---


## [6.0.15] - 2026-02-16

### Added

- Rule traceability test: validates test case → rule file → content chain across 28 skills
- Eval completeness test: validates consistency between test-cases.json and .eval.json formats
- Skill efficiency scorecard: JSON metrics (rule count, imperative instructions, code examples, specificity ratio) for all 62 skills
- `npm run test:skills:functional` script for running functional tests

### Fixed

- Corrected rule field mappings in 8 test-cases.json files (39 broken references → actual rule filenames or null)

---


## [6.0.14] - 2026-02-16

### Fixed

- Remove all Mem0 Cloud references from 24 docs files — 4-tier → 3-tier memory architecture
- Delete leftover mem0 artifacts (.claude/mem0-webhooks.json, mem0-queue.jsonl, logs)
- Clean .gitignore and mypy.ini of mem0 entries
- Fix stale hook count in choosing-a-plugin.mdx (86 → 89)

---


## [6.0.13] - 2026-02-15

### Fixed

- **Version sync**: package.json 6.0.9 → 6.0.13 to match manifests/pyproject.toml
- **CLAUDE.md**: version 6.0.8 → 6.0.13, hook bundles 11 → 12
- **marketplace.json**: engine >=2.1.33 → >=2.1.34
- **README**: orkl skill count 62 → 45, ork-creative 62 → 3
- **CONTRIBUTING**: orkl 44 → 45 skills, hooks 98 → 89, bundles 11 → 12
- **Doctor skill**: version 5.4.0 → 6.0.13, CC min 2.1.16 → 2.1.34, hooks 22 → 66 entries, bundles 11 → 12, agents 35 → 36, skills 186 → 62, all reference files updated
- **Hooks README**: 93 → 89 hooks, 11 → 12 bundles, CC 2.1.33 → 2.1.34
- **Docs site**: installation orkl 44 → 45, command-skills 23 → 24, troubleshooting bundles 11 → 12
- **Demo files**: all 6 component files updated with current counts (62 skills, 36 agents, 89 hooks)

---


## [6.0.11] - 2026-02-15

### Fixed

- Guard against image paste killing context window — 3-layer defense: stdin cap (512KB), prompt length guard (50K), image/binary detection ([#620](https://github.com/yonatangross/orchestkit/issues/620))
- Correct orkl skill count in marketplace.json (62 → 45)

### Changed

- Rewrote `mcp-patterns` SKILL.md for 2025-11-25 MCP spec + AAIF governance ([#613](https://github.com/yonatangross/orchestkit/issues/613))
- Updated `_sections.md` with 7 categories (14 rules) and priority levels
- Updated agent skill-indexes for ai-safety-auditor, llm-integrator, security-auditor
- Regenerated docs site pages and generated data files

---


## [6.0.9] - 2026-02-15

### Fixed

- Sync all component counts across docs, README, CLAUDE.md, marketplace.json, and tests
- Hook count 86→89 (3 new hooks from issue-driven git workflow)
- Plugin skill counts: orkl 44→45, ork 61→62
- Version reference 6.0.6→6.0.9 in CLAUDE.md
- Fix "0 hooks" in README and CLAUDE.md hero line
- Update docs-data.test.ts hardcoded assertions to match current counts
- Close milestones [#56](https://github.com/yonatangross/orchestkit/milestone/56) (Documentation Site) and [#68](https://github.com/yonatangross/orchestkit/milestone/68) (Issue-Driven Git)

---


## [6.0.7] - 2026-02-14

### Added

- 9 test-cases.json files for orchestration skills (commit, review-pr, fix-issue, implement, explore, create-pr, verify, assess, git-workflow) — 39 test cases total ([#563](https://github.com/yonatangross/orchestkit/issues/563))
- Skill triggering test suite with trigger-cases.yaml + keyword overlap scoring ([#571](https://github.com/yonatangross/orchestkit/issues/571))
- Rule validation test for YAML frontmatter compliance ([#543](https://github.com/yonatangross/orchestkit/issues/543))
- "When NOT to Use" tier matrices for architecture-patterns, DDD, distributed-systems ([#532](https://github.com/yonatangross/orchestkit/issues/532))
- Interview/take-home mode (STEP 0c) in implement skill ([#533](https://github.com/yonatangross/orchestkit/issues/533))
- 5 new scripts: validate-conventional.sh, check-plugin-health.sh, scaffold-test.sh, scan-vulnerabilities.sh, run-lint-check.sh ([#565](https://github.com/yonatangross/orchestkit/issues/565))
- Edit > Write memory pattern in memory + remember skills ([#546](https://github.com/yonatangross/orchestkit/issues/546))
- Lazy loading wrappers for SkillBrowser, DemoGallery, AgentSelector ([#438](https://github.com/yonatangross/orchestkit/issues/438))
- Docs CI workflow for auto-rebuild on src/ changes ([#402](https://github.com/yonatangross/orchestkit/issues/402))
- Shared category-colors.ts palette for consistent UI ([#439](https://github.com/yonatangross/orchestkit/issues/439))
- Database selection rule + 4 references in database-patterns ([#535](https://github.com/yonatangross/orchestkit/issues/535))
- Railway deployment rule + 3 references in devops-deployment ([#550](https://github.com/yonatangross/orchestkit/issues/550))
- Messaging integrations rule + 3 references in api-design ([#551](https://github.com/yonatangross/orchestkit/issues/551))
- Payload CMS rule + 3 references in api-design ([#552](https://github.com/yonatangross/orchestkit/issues/552))

### Fixed

- Replaced ~50 hardcoded hex colors with fd-* design tokens in docs site ([#440](https://github.com/yonatangross/orchestkit/issues/440))
- Fixed category color inconsistencies: ai (emerald→cyan), devops (violet→orange), research (indigo→teal) ([#439](https://github.com/yonatangross/orchestkit/issues/439))
- Added aria-live="polite" on copy button feedback ([#440](https://github.com/yonatangross/orchestkit/issues/440))

---


## [6.0.6] - 2026-02-14

### Added

- **Hooks**: Add type-error-indexer SessionStart hook — caches `tsc --noEmit` errors for agent awareness ([#304](https://github.com/yonatangross/orchestkit/issues/304))
- **Skills**: Extract 27 rules from 7 reference-only tech skills ([#559](https://github.com/yonatangross/orchestkit/issues/559))
- **Skills**: Add YAGNI gate to quality-gates, context-aware architecture-patterns ([#530](https://github.com/yonatangross/orchestkit/issues/530), [#531](https://github.com/yonatangross/orchestkit/issues/531))
- **Skills**: Add scope-appropriate-architecture skill ([#528](https://github.com/yonatangross/orchestkit/issues/528), [#529](https://github.com/yonatangross/orchestkit/issues/529))

### Changed

- **Agents**: Rename performance-engineer → frontend-performance-engineer to avoid confusion with python-performance-engineer ([#587](https://github.com/yonatangross/orchestkit/issues/587))
- **CLAUDE.md**: Update CC format reference from 2.1.6 to 2.1.34 ([#515](https://github.com/yonatangross/orchestkit/issues/515))

### Fixed

- **CI**: Raise vitest coverage thresholds (40/45/30/40 → 70/72/65/70), target 80%
- **CI**: Raise hook coverage threshold (20% → 75%), fix detection to match .js imports
- **CI**: Pin 6 unpinned actions in eval-index-effectiveness.yml to SHA
- **CI**: Fix version-check.yml to detect manifest/workflow file changes
- **CI**: Add graduated coverage penalties and skip/lint penalties to CI report scoring
- **CI**: Fix Job Summary to render ci-report.md inline
- **CI**: Include dispatchers in hook coverage count
- **Tests**: Delete dead test-hooks-unit.sh (all 6 hooks migrated to TS, every test SKIPped)
- **Tests**: Remove 21 aspirational test.skip blocks from user-tracking-wiring.test.ts
- **Tests**: Delete unused parallel mode from run-tests.sh (had bug assuming 100% pass)
- **Tests**: Report vitest pass/fail/skip counts in run-all-tests.sh
- **Docs**: Fix CLAUDE.md hook count (65 → 63 global, matches hooks.json)
- **Docs**: Fix markdownlint warnings in golden-dataset and release-management skills
- **Docs**: Replace unsupported gitattributes language with text for Shiki

---


## [6.0.5] - 2026-02-13

### Fixed

- **Bugs**: Close 11 open issues ([#417](https://github.com/yonatangross/orchestkit/issues/417), [#418](https://github.com/yonatangross/orchestkit/issues/418), [#437](https://github.com/yonatangross/orchestkit/issues/437), [#450](https://github.com/yonatangross/orchestkit/issues/450), [#451](https://github.com/yonatangross/orchestkit/issues/451), [#452](https://github.com/yonatangross/orchestkit/issues/452), [#453](https://github.com/yonatangross/orchestkit/issues/453), [#454](https://github.com/yonatangross/orchestkit/issues/454), [#455](https://github.com/yonatangross/orchestkit/issues/455), [#456](https://github.com/yonatangross/orchestkit/issues/456), [#534](https://github.com/yonatangross/orchestkit/issues/534))
- **Skills**: Fix doctor "health diagnostics for health diagnostics" redundancy ([#456](https://github.com/yonatangross/orchestkit/issues/456))
- **Skills**: Add skill name to explore description for semantic discovery ([#456](https://github.com/yonatangross/orchestkit/issues/456))
- **Tests**: Rewrite MCP pretool hook tests for TypeScript — removes 14 dead skip() calls ([#417](https://github.com/yonatangross/orchestkit/issues/417))
- **Tests**: Rewrite hook timing tests to measure TypeScript hooks via run-hook.mjs ([#455](https://github.com/yonatangross/orchestkit/issues/455))

### Changed

- **CLAUDE.md**: Prune from 275 to 75 lines, link to docs instead of inline ([#452](https://github.com/yonatangross/orchestkit/issues/452))
- **Hooks**: Consolidate 4 PostToolUse Write|Edit hooks into unified-write-quality-dispatcher ([#453](https://github.com/yonatangross/orchestkit/issues/453))
  - auto-lint, readme-sync, merge-conflict-predictor, coverage-predictor → 1 dispatcher
  - Hook count: 88 → 86 (63 global + 22 agent + 1 skill)
- **README**: Fix stale counts (200→60 skills, 98→86 hooks), remove playground-demo.gif
- **GitHub**: Update repo description with accurate component counts

## [6.0.4] - 2026-02-13

### Fixed

- **CI**: Remove deleted `evidence-verification` skill from `test-specific-skills.sh` ([#555](https://github.com/yonatangross/orchestkit/issues/555) aftermath)
- **CI**: Add missing `version` field and `checklists/` directory to `mcp-patterns` skill for `test-ai-ml-skills.sh`

## [Unreleased]

### Changed

- **Skill Consolidation** ([#536](https://github.com/yonatangross/orchestkit/issues/536)): Restructured 200 skills into 103 through 16 consolidation batches
  - **Batches 1-6**: LangGraph (10→1), RAG (9→1), Testing (13→1), Caching (4→1), Performance (6→1), Video (14→1)
  - **Batches 7-16**: Event-Driven (3→1), Golden-Dataset (3→1), Accessibility (3→1), Database-Patterns (4→1), LLM-Integration (7→1), API-Design (3→1), Distributed-Systems (4→1), Agent-Orchestration (3→1), Security-Patterns (6→1), Product-Frameworks (5→1)
  - **Additional groups**: Monitoring-Observability (2→1), Frontend-Animation (3→1), UI-Components (4→1), Data-Visualization (2→1), Python-Backend (5→1), Architecture-Patterns (2→1), Browser-Tools (2→1), Context-Optimization (2→1), Async-Jobs (2→1)
  - Total: 200 → 103 skills (76 internal, 27 user-invocable)
  - ork-creative: 16 → 3 skills (demo-producer, video-production, ascii-visualizer)
  - Updated 33 agents, hooks, manifests, tests, and CLAUDE.md with corrected counts
  - Hook count corrected: 93 → 88 (65 global + 22 agent + 1 skill)

### Added

- **TLDR-Lite File Summaries** ([#463](https://github.com/yonatangross/orchestkit/issues/463)): New `PreToolUse[Read]` hook injects structural summaries for large files (>500 lines or >2000 tokens)
  - Regex-based extractors for TypeScript/JS, Python, Go, Rust, Shell, Markdown
  - Extracts imports, functions, classes, types, exports as a navigation roadmap
  - ~500 token summary injected as `additionalContext` alongside full file content
  - 7 guard conditions: skip targeted reads, unsupported extensions, small files, >2MB files
  - 42 new tests (25 library + 17 hook)
  - Hook count: 97 → 98 (70 global + 22 agent + 6 skill)
  - pretool bundle: 57.42 → 63.36 KB (+10%)

### Fixed

- **Docs**: Corrected stale component counts across README, marketplace.json, CONTRIBUTING.md, Fumadocs site pages, and skill references (199→200 skills, 119→98 hooks)

---

## [6.0.3] - 2026-02-07

### Added

- **Langfuse v3 Rewrite** (Milestone [#58](https://github.com/yonatangross/orchestkit/milestone/58)): Complete rewrite of `langfuse-observability` skill from deprecated SDK v2 to v3/v4 (OTEL-native)
  - SKILL.md bumped to v2.0.0 with 3 new capability sections (agent-graphs, mcp-prompt-management, framework-integrations)
  - 3 new reference files: `agent-observability.md`, `framework-integrations.md`, `migration-v2-v3.md`
  - 7 existing reference files rewritten with v3 imports (`from langfuse import observe, get_client`)
  - All `langfuse_context` → `get_client()`, all `langfuse.decorators` → `langfuse` imports
  - New coverage: Agent Graphs, MCP Server, Experiment Runner SDK, dataset versioning, spend alerts, natural language filtering, evaluator execution tracing
  - 18 tracking issues ([#419](https://github.com/yonatangross/orchestkit/issues/419)-[#436](https://github.com/yonatangross/orchestkit/issues/436)) under Milestone [#58](https://github.com/yonatangross/orchestkit/milestone/58)

### Fixed

- **Mem0**: Add `--no-infer` flag to `add-memory.py` — passes `infer=False` to mem0's `client.add()`, disabling semantic dedup in batch tests (Test 6, Test 18) so counts are deterministic across parallel CI runners
- **CI**: Quote workflow names containing colons (`Validate: Plugins`, `Validate: Version`, `Eval: Agent Routing`, `Visualize: Memory`) — unquoted colons caused YAML parse errors resulting in 0 jobs
- **CI**: Fix `test-git-enforcement-hooks.sh` failing on `main` by setting `ORCHESTKIT_BRANCH` env override so git-validator hook doesn't block test commits on protected branches
- **CI**: Rewrite `test-hook-chains.sh` to read from committed `hooks.json` instead of gitignored `settings.json`

---


## [6.0.2] - 2026-02-06

### Added

- **[#328](https://github.com/yonatangross/orchestkit/issues/328) (P1-C)**: `complexity: low|medium|high` field added to all 199 skill frontmatters for Opus 4.6 adaptive thinking alignment
- **[#337](https://github.com/yonatangross/orchestkit/issues/337) (P2-E)**: New `upgrade-assessment` user-invocable skill — 6-phase readiness evaluation with structured JSON scoring across 6 dimensions
- **[#338](https://github.com/yonatangross/orchestkit/issues/338) (P2-F)**: New `platform-upgrade-knowledge` reference skill with scoring rubrics and compatibility matrices
- **[#333](https://github.com/yonatangross/orchestkit/issues/333) (P2-D)**: 128K output token guidance added to implement skill, context-engineering, and 3 agent definitions
- **[#331](https://github.com/yonatangross/orchestkit/issues/331) (P2-B)**: New `model-cost-advisor` SubagentStart hook — analyzes task complexity and recommends optimal model for cost savings
- **[#325](https://github.com/yonatangross/orchestkit/issues/325) (P0-B)**: Prefill-guard SessionStart hook warns about Opus 4.6 breaking change (prefilled assistant messages return 400 errors)
- **[#346](https://github.com/yonatangross/orchestkit/issues/346) (P1-E)**: Agent `memory` frontmatter — all 36 agents (31 `project` scope, 5 `local` scope) (CC 2.1.33)
- **[#347](https://github.com/yonatangross/orchestkit/issues/347) (P1-F)**: New `TeammateIdle` and `TaskCompleted` hook events with progress-reporter and completion-tracker handlers (CC 2.1.33)
- **[#335](https://github.com/yonatangross/orchestkit/issues/335) (P3-B)**: New `/ork:audit-full` user-invocable skill — single-pass whole-codebase audit (security, architecture, dependencies) leveraging 1M context window with 4 references, 2 assets, 1 checklist, 1 script
- Batch script `scripts/add-complexity.mjs` for applying complexity classifications
- **[#334](https://github.com/yonatangross/orchestkit/issues/334) (P3-A)**: Agent Teams dual-mode orchestration — `/ork:implement` and 5 other user-invocable skills (assess, brainstorm, explore, fix-issue, review-pr, verify) support both Task tool (star topology) and Agent Teams (mesh topology) via `ORCHESTKIT_PREFER_TEAMS` env var
- **[#405](https://github.com/yonatangross/orchestkit/issues/405)**: TeamCreate, SendMessage, TeamDelete tools added to all 36 agents
- **[#406](https://github.com/yonatangross/orchestkit/issues/406)**: task-dependency-patterns skill updated with Agent Teams coordination patterns
- **[#407](https://github.com/yonatangross/orchestkit/issues/407)**: multi-agent-orchestration skill updated with mesh topology patterns
- **[#362](https://github.com/yonatangross/orchestkit/issues/362)**: 4 Agent Teams lifecycle hooks (team-formation-advisor, teammate-progress-reporter, teammate-completion-tracker, team-coordination-advisor)
- **[#391](https://github.com/yonatangross/orchestkit/issues/391) (P2-B)**: Interactive Agent Selector playground with search, category/task filters, quiz wizard, and 10 scenario suggestions
- **Fumadocs site scaffold** (Milestone [#56](https://github.com/yonatangross/orchestkit/milestone/56)): Fumadocs v16.5 + Next.js + MDX + Orama search, reference pages auto-generated for all 199 skills, 36 agents, 15 hook categories

- **Tavily Integration**: 3-tier web research workflow (WebFetch → Tavily → agent-browser) with curl patterns for search/extract/map APIs, graceful degradation when `TAVILY_API_KEY` is unset
- **Tavily Site Discovery**: competitive-monitoring skill gains Tavily map+extract pre-step for competitor URL enumeration
- **Tavily Agent Awareness**: web-research-analyst, market-intelligence, and product-strategist agents updated with Tavily directives

### Fixed

- **SEC-001**: SQL injection prevention — `multi-instance-cleanup` and `cleanup-instance` now validate instance IDs with `/^[a-zA-Z0-9_\-.:]+$/` before SQLite interpolation
- **SEC-003**: Atomic file writes — `multi-instance-lock` uses write-to-temp + `renameSync` to prevent TOCTOU race conditions in lock files
- README.md hook count corrected (120 → 119)

### Changed

- **[#348](https://github.com/yonatangross/orchestkit/issues/348) (P2-G)**: `Task(agent_type)` restrictions on python-performance-engineer and demo-producer (CC 2.1.33)
- **[#349](https://github.com/yonatangross/orchestkit/issues/349) (P1-G)**: CC minimum version bumped to >= 2.1.33 (from 2.1.32) for agent memory and new hook events
- **[#330](https://github.com/yonatangross/orchestkit/issues/330) (P2-A)**: 13 agents migrated from `mcp__sequential-thinking` to Opus 4.6 native adaptive thinking
- **[#329](https://github.com/yonatangross/orchestkit/issues/329) (P1-D)**: TOKEN_BUDGETS now scale dynamically with `CLAUDE_MAX_CONTEXT` (2% of context window per CC 2.1.32)
- **[#332](https://github.com/yonatangross/orchestkit/issues/332) (P2-C)**: Enhanced `pre-compact-saver` v2.0 — preserves decision logs, memory tier snapshots, compaction frequency analytics
- **[#324](https://github.com/yonatangross/orchestkit/issues/324) (P0-A)**: Replace hardcoded model string in multi-instance-init.ts with dynamic `detectModel()`
- **[#326](https://github.com/yonatangross/orchestkit/issues/326) (P1-A)**: Memory context tier limits expanded (1200→3000 chars memory, 800→1200 chars profile)
- **[#327](https://github.com/yonatangross/orchestkit/issues/327) (P1-B)**: CC minimum version updated to >= 2.1.33 across CLAUDE.md, README, hooks README, marketplace
- MCP configuration docs updated with Opus 4.6 sequential-thinking deprecation note
- CI workflow renames for clarity and pipeline parallelism
- Skill count: 197 → 200 (added upgrade-assessment, platform-upgrade-knowledge, audit-full)
- Hook count: 117 → 119 (91 global + 22 agent + 6 skill-scoped)
- Opus 4.6 callouts added to top 5 user-invocable skills (verify, review-pr, fix-issue, implement, explore)
- Agent `memory` frontmatter expanded from 22 to all 36 agents

### Removed

- Deprecated `sequential-thinking-auto` pretool hook (Opus 4.6 native adaptive thinking replaces MCP sequential-thinking)
- **[#362](https://github.com/yonatangross/orchestkit/issues/362)**: 6 coordination hooks removed as redundant with CC native Agent Teams (team-formation-hook, team-coordinator, teammate-monitor, team-cleanup, team-health-check, team-context-share)

---


## [6.0.1] - 2026-02-05

### Changed

- **orkl manifest**: Removed 12 language-specific skills to keep orkl truly universal (107 → from 119 skills)
  - Removed: run-tests, background-jobs, connection-pooling, caching-strategies, rate-limiting, api-versioning, error-handling-rfc9457, input-validation, property-based-testing, i18n-date-patterns, image-optimization, type-safety-validation

### Added

- **LangGraph skills**: Added Quick Start sections, 6 cross-links (up from 3), and evaluation test cases
- **New skills**: langgraph-streaming, langgraph-subgraphs, langgraph-tools
- **Progressive disclosure**: Refactored mcp-server-building and database-versioning into main SKILL.md + references/

### Fixed

- Documentation count sync: README.md, CLAUDE.md, CONTRIBUTING.md now show correct counts (197 skills, 36 agents, 117 hooks)

---


## [6.0.0] - 2026-02-04

### Changed

- **Breaking**: Reorganized plugins from 26 granular plugins to 2-tier architecture:
  - `orkl` (119 skills) — Universal toolkit, language-agnostic, all workflows work out of the box
  - `ork` (195 skills) — Full specialized toolkit with Python, React, LLM/RAG patterns
- Renamed `ork-lite` to `orkl` for shorter prefix
- All 36 agents and 117 hooks included in BOTH plugins
- Deleted 25 domain-specific plugin manifests (ork-accessibility, ork-backend-patterns, ork-memory-*, etc.)
- Memory plugins (graph, mem0, fabric) now included directly in orkl
- No more dependency issues — every workflow works without additional installs

### Added

- `web-research-analyst` agent for browser automation and competitive intelligence
- `research` category for agent indexes
- `competitive-monitoring` skill (22 user-invocable skills total)

### Fixed

- Bash 3.2 compatibility in generate-indexes.sh (macOS default shell)
- Agent index generation now includes all categories correctly
- Playgrounds updated for two-tier plugin system (setup-wizard, data.js, index.html)

---

## [5.7.5] - 2026-02-04

### Fixed

- CI report generation using tsx for ESM compatibility

---


## [5.7.3] - 2026-02-03

### Changed

- Removed redundant skill-resolver hook (Claude Code natively auto-injects skills from agent frontmatter)
- Hook count: 117 total (89 global + 28 agent/skill-scoped)
- Eval framework focuses on agent routing correctness via CLAUDE.md agent-index (removed skill metrics)

### Fixed

- Eval scripts: Fixed dry-run mode to create all required output directories
- Eval scripts: Fixed path prefixes in golden test commands
- Eval scripts: Added explicit exit 0 to ensure proper exit status
- CI workflow: Exclude eval scripts from artifact to prevent overwriting

---


## [5.7.2] - 2026-02-03

### Added

- **Three-tier auto-suggest UX**: Confidence-based messaging for skill injection
  - SILENT (≥90%): No user notification, just inject
  - NOTIFY (80-89%): Brief "💡 Loaded: X" notification
  - SUGGEST (70-79%): Suggest skills with context
  - HINT (50-69%): Hint at possible matches

- **AGENTS.md cross-tool compatibility**: Generate AGENTS.md alongside CLAUDE.md
  - Enables compatibility with Cursor, Codex, Amp, Zed
  - AGENTS.md follows the open standard at https://agents.md/

- **CI-based index effectiveness evaluation**: A/B comparison framework
  - 12 golden tests covering 8 different agents
  - Compares with-index vs without-index performance
  - Metrics: build success, lint compliance, test pass, agent routing

- Dynamic test discovery via `scripts/ci/run-tests.sh` (discovers 154 tests vs ~100 hardcoded)
- Reusable test-runner workflow (`.github/workflows/reusable-test-runner.yml`)
- Composite action for test execution (`.github/actions/run-tests/action.yml`)
- Expanded npm caching strategy (node_modules, vitest cache)
- Multi-tier skill scenario test assertion (notify-tier generates systemMessage)

### Changed

- Removed redundant skill-resolver hook (Claude Code natively auto-injects skills from agent frontmatter)
- Hook count: 117 total (89 global + 28 agent/skill-scoped)
- CI workflows now use SHA-pinned GitHub Actions
- Test execution uses dynamic discovery instead of hardcoded invocations
- Eval framework focuses on agent routing correctness via CLAUDE.md agent-index

### Security

- Pin `googleapis/release-please-action@v4` to SHA commit (SEC-001)
- Fix shell injection risk in version-check.yml by using env variable pattern for `github.head_ref` (SEC-002)
- Quote `inputs.ci-setup-flags` in setup action to prevent command injection (SEC-003)
- All 8 external GitHub Actions now pinned to SHA commits for supply chain security
- Add SHA documentation in `.github/action-versions.md`
- Replaced arbitrary `eval` with allowlist-based command execution
- Pinned yq to v4.40.5 with SHA256 checksum verification
- Added cleanup traps for temp directories on EXIT/ERR

---

## [5.7.1] - 2026-02-02

### Added

- Dynamic test discovery via `scripts/ci/run-tests.sh` (discovers 154 tests vs ~100 hardcoded)
- Reusable test-runner workflow (`.github/workflows/reusable-test-runner.yml`)
- Composite action for test execution (`.github/actions/run-tests/action.yml`)
- Expanded npm caching strategy (node_modules, vitest cache)

### Changed

- CI workflows now use SHA-pinned GitHub Actions
- Test execution uses dynamic discovery instead of hardcoded invocations

### Security

- Replaced arbitrary `eval` with allowlist-based command execution
- Pinned yq to v4.40.5 with SHA256 checksum verification
- Added cleanup traps for temp directories on EXIT/ERR


## [5.7.0] - 2026-02-02

### Changed

- **Model Updates (February 2026)**:
  - OpenAI: gpt-4o → gpt-5.2, gpt-4o-mini → gpt-5.2-mini
  - Anthropic: Claude model dates updated to 20251101 (Opus 4.5, Sonnet 4.5, Haiku 4.5)
  - Meta: llama3.2 → llama3.3
  - Google: Gemini 2.5 → Gemini 3
  - xAI: Grok 3 → Grok 4

- **Framework Updates**:
  - Next.js 16: Cache Components with `"use cache"` directive, async params/searchParams
  - Tailwind CSS v4: CSS-first configuration with `@theme {}`, no tailwind.config.js needed
  - LangGraph 1.0: `create_react_agent` → `create_agent`, `prompt=` → `system_prompt=`
  - Redis 8.4: Built-in Search/JSON modules, FT.HYBRID with RRF fusion
  - Vite 8: Rolldown bundler with `advancedChunks` API
  - CrewAI 1.8.x: Flows architecture with `@start()`, `@listen()`, `@router()` decorators
  - Playwright 1.58: Agents workflow with `init-agents`, planner/generator/healer pattern

### Added

- **New reference files**:
  - `cache-components.md` — Next.js 16 Cache Components comprehensive guide
  - `nextjs-16-upgrade.md` — Breaking changes and migration path
  - `gpt-5-2-codex.md` — GPT-5.2-Codex agentic coding model documentation
  - Redis 8 FT.HYBRID comparison added to `pgvector-search` skill
  - CrewAI 1.8.x Flows patterns added to `crewai-patterns.md`

- **Updated skills** (193 skills updated with current best practices):
  - `react-server-components-framework` — v1.4.0 with Cache Components
  - `vite-advanced` — Rolldown bundler patterns
  - `e2e-testing` — Playwright Agents workflow
  - `semantic-caching` — Redis 8 built-in modules
  - `rag-retrieval` — LangGraph 1.0 API updates
  - `alternative-agent-frameworks` — OpenAI Agents SDK 0.7.0, CrewAI 1.8.x

### Fixed

- `memory/SKILL.md` — Renamed "Quick Start" to "Usage" for test validation
- `implement/SKILL.md` — Reduced from 527 to 474 lines (under 500 limit)
- `data.js` — Regenerated with correct version 5.7.0
- `session-tracking.test.ts` — Fixed TEST_PROJECT_DIR initialization

---

## [5.6.2] - 2026-02-02

### Fixed

- **Critical**: Remove `"deps"` key from marketplace.json that caused "Invalid schema: Unrecognized key: deps" errors on all 26 plugins when installing via `/plugin`
- Remove dependency propagation from build script (deps stay in manifests for internal use only)
- Upgrade marketplace schema test from denylist to allowlist validation to catch any future unrecognized keys

---


## [5.6.1] - 2026-02-02

### Fixed

- Build script syncs all marketplace.json plugin versions to the project version (eliminates version drift)
- Build script propagates `dependencies` from manifests into marketplace.json `deps` fields
- Version bump script now updates all 26 manifests (prevents build from overwriting bumped versions)

---


## [5.6.0] - 2026-02-01

### Added

- **Memory health check library** (`memory-health.ts`) — Validates JSONL integrity, tier status, queue depths, and file analysis for `/ork:doctor`
- **Memory metrics collector** (`memory-metrics.ts`) — Counts decisions by category/type, queue depths, completed flows; appends timestamped snapshots to `memory-metrics.jsonl`
- **Memory metrics lifecycle hook** (`memory-metrics-collector.ts`) — SessionStart hook that collects and persists memory metrics on every session

---

[6.0.18]: https://github.com/yonatangross/orchestkit/compare/v6.0.17...v6.0.18
[6.0.17]: https://github.com/yonatangross/orchestkit/compare/v6.0.16...v6.0.17
[6.0.16]: https://github.com/yonatangross/orchestkit/compare/v6.0.15...v6.0.16
[6.0.15]: https://github.com/yonatangross/orchestkit/compare/v6.0.14...v6.0.15
[6.0.14]: https://github.com/yonatangross/orchestkit/compare/v6.0.13...v6.0.14
[6.0.13]: https://github.com/yonatangross/orchestkit/compare/v6.0.12...v6.0.13
[6.0.12]: https://github.com/yonatangross/orchestkit/compare/v6.0.11...v6.0.12
[6.0.11]: https://github.com/yonatangross/orchestkit/compare/v6.0.9...v6.0.11
[6.0.9]: https://github.com/yonatangross/orchestkit/compare/v6.0.8...v6.0.9
[6.0.8]: https://github.com/yonatangross/orchestkit/compare/v6.0.7...v6.0.8
[6.0.7]: https://github.com/yonatangross/orchestkit/compare/v6.0.6...v6.0.7
[6.0.6]: https://github.com/yonatangross/orchestkit/compare/v6.0.5...v6.0.6
[6.0.5]: https://github.com/yonatangross/orchestkit/compare/v6.0.4...v6.0.5
[6.0.4]: https://github.com/yonatangross/orchestkit/compare/v6.0.2...v6.0.4
[6.0.2]: https://github.com/yonatangross/orchestkit/compare/v6.0.0...v6.0.2
[6.0.0]: https://github.com/yonatangross/orchestkit/compare/v5.7.1...v6.0.0
[Unreleased]: https://github.com/yonatangross/orchestkit/compare/v6.0.18...HEAD
[6.0.3]: https://github.com/yonatangross/orchestkit/compare/v6.0.2...v6.0.3
[6.0.1]: https://github.com/yonatangross/orchestkit/compare/v6.0.0...v6.0.1
[5.7.5]: https://github.com/yonatangross/orchestkit/compare/v5.7.1...v5.7.5
[5.7.3]: https://github.com/yonatangross/orchestkit/compare/v5.7.2...v5.7.3
[5.7.2]: https://github.com/yonatangross/orchestkit/compare/v5.7.1...v5.7.2
[5.7.1]: https://github.com/yonatangross/orchestkit/compare/v5.7.0...v5.7.1
[5.7.0]: https://github.com/yonatangross/orchestkit/compare/v5.5.0...v5.7.0
[5.6.2]: https://github.com/yonatangross/orchestkit/compare/v5.6.1...v5.6.2
[5.6.1]: https://github.com/yonatangross/orchestkit/compare/v5.6.0...v5.6.1
[5.6.0]: https://github.com/yonatangross/orchestkit/releases/tag/v5.6.0
[5.5.0]: https://github.com/yonatangross/orchestkit/releases/tag/v5.5.0
[5.2.4]: https://github.com/yonatangross/orchestkit/releases/tag/v5.2.4
