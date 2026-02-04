# Changelog

All notable changes to the OrchestKit Claude Code Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.7.5] - 2026-02-04

### Fixed

- TODO: Describe your changes here

---


## [5.7.4] - 2026-02-04

### Fixed

- TODO: Describe your changes here

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
