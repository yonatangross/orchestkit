# Changelog

All notable changes to the OrchestKit Claude Code Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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


## [6.0.21] - 2026-02-18

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
