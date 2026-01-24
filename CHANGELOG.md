# Changelog

All notable changes to the OrchestKit Claude Code Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.1.0] - 2026-01-23

### Added

- **Modular Plugin Marketplace**: 33 domain-specific plugins for selective installation
  - **Core Infrastructure (3)**:
    - `ork-core`: Foundation plugin with quality gates, ADRs, brainstorming, error handling
    - `ork-context`: Context management, compression, engineering, evidence verification
    - `ork-memory`: Memory fabric, mem0 integration, knowledge graph persistence
  - **AI/LLM (7)**:
    - `ork-rag`: Core RAG patterns, retrieval, contextual retrieval, query decomposition
    - `ork-rag-advanced`: Agentic RAG, advanced retrieval patterns
    - `ork-langgraph-core`: LangGraph state management, routing, checkpoints
    - `ork-langgraph-advanced`: Human-in-loop, parallel execution, workflow orchestration
    - `ork-llm-core`: LLM integration, function calling, streaming, embeddings
    - `ork-llm-advanced`: Fine-tuning, high-performance inference, multimodal
    - `ork-ai-observability`: Langfuse tracing, LLM evaluation, semantic caching
  - **Backend (5)**:
    - `ork-fastapi`: FastAPI patterns, API design, error handling (RFC9457), versioning
    - `ork-database`: SQLAlchemy 2.0 async, Alembic migrations, connection pooling
    - `ork-async`: asyncio patterns, Celery, background jobs, distributed locks
    - `ork-architecture`: Clean architecture, DDD, CQRS, event sourcing, saga patterns
    - `ork-backend-advanced`: gRPC, caching strategies, idempotency, outbox pattern
  - **Frontend (4)**:
    - `ork-react-core`: React 19 patterns, server components, TanStack Query, forms
    - `ork-ui-design`: Design systems, Radix primitives, shadcn, Recharts, dashboards
    - `ork-frontend-performance`: Core Web Vitals, lazy loading, view transitions, PWA
    - `ork-frontend-advanced`: Zustand state, animations, i18n, scroll-driven animations
  - **Testing (2)**:
    - `ork-testing-core`: Unit testing, MSW mocking, property-based testing, test data
    - `ork-testing-e2e`: E2E patterns, Playwright, contract testing, LLM testing
  - **Security (1)**:
    - `ork-security`: OWASP Top 10, auth patterns, input validation, AI safety auditing
  - **DevOps & CI/CD (2)**:
    - `ork-cicd`: GitHub Actions, deployment strategies, observability, performance testing
    - `ork-infrastructure`: Terraform, Kubernetes, cloud architecture (AWS/GCP/Azure)
  - **Git & Release (1)**:
    - `ork-git`: Git workflows, stacked PRs, release management, recovery operations
  - **Accessibility (1)**:
    - `ork-accessibility`: WCAG compliance, focus management, React ARIA patterns, a11y testing
  - **Workflows (2)**:
    - `ork-workflows-core`: Core workflow patterns, implementation workflows
    - `ork-workflows-advanced`: Multi-agent workflows, alternative agent frameworks
  - **API & Integration (2)**:
    - `ork-mcp`: MCP server building, tool composition, advanced MCP patterns
    - `ork-graphql`: Strawberry GraphQL, schema design, DataLoader patterns
  - **Product & Data (3)**:
    - `ork-product`: Product strategy, requirements translation, UX research, metrics
    - `ork-evaluation`: Golden dataset management, LLM evaluation, quality scoring
    - `ork-data-engineering`: Data pipelines, embeddings, pgvector search, test data

- **Plugin Validation Suite**: `tests/plugins/validate-all.sh` with 403 checks
  - Layer 1: Marketplace schema validation
  - Layer 2: Plugin directory structure
  - Layer 3: Plugin.json schema compliance
  - Layer 4: Skills validation (SKILL.md format)
  - Layer 5: Agents validation (frontmatter)
  - Layer 6: Commands validation
  - Layer 7: Scripts validation (shebang, executable)
  - Layer 8: Cross-reference validation

- **Migration Scripts**: `bin/restructure-plugins.sh`, `bin/migrate-to-plugins.sh`

- **CC 2.1.16 Support**: Full Claude Code 2.1.16 integration
  - **Task Management System**: Native task tracking with TaskCreate, TaskUpdate, TaskGet, TaskList
  - **New Skill**: `task-dependency-patterns` - Comprehensive patterns for task decomposition, dependency chains, status workflow, multi-agent coordination
  - **Doctor Enhancement**: Added 6th health check for CC version validation (>= 2.1.16)
  - **workflow-architect Agent**: Added task-dependency-patterns skill
  - **Engine Field Updates**: All 33 plugin manifests updated to `engine: ">=2.1.16"`
  - **VSCode Plugin Support**: Documentation for native plugin management in VSCode extension

- **Decision History Dashboard** (#203, #206, #207, #208): TypeScript CLI for visualizing architecture decisions
  - **CHANGELOG Parser** (#206): `hooks/src/lib/decision-history.ts` parses Keep a Changelog format
  - **Decision Aggregator** (#207): Merges session, CHANGELOG, and coordination sources
  - **CLI Dashboard** (#208): `hooks/bin/decision-history.mjs` with 7 commands (list, show, timeline, stats, mermaid, sync, search)
  - **Mermaid Generator** (#203): Generate timeline diagrams for documentation
  - **Skill Update**: `skills/decision-history/SKILL.md` v2.0.0 with TypeScript implementation
  - Restored unified bundle (`hooks.mjs`) for CLI tools in esbuild config

- **TypeScript/ESM Hook Migration Phase 4** (#200): Complete code splitting architecture
  - **11 Split Bundles**: Event-based bundles for faster per-hook load times (~77% reduction)
    - `permission.mjs` (8.35 KB), `pretool.mjs` (47.68 KB), `posttool.mjs` (58.16 KB)
    - `prompt.mjs` (56.91 KB), `lifecycle.mjs` (31.45 KB), `stop.mjs` (33.23 KB)
    - `subagent.mjs` (56.16 KB), `notification.mjs` (4.96 KB), `setup.mjs` (24.24 KB)
    - `skill.mjs` (51.63 KB), `agent.mjs` (8.31 KB)
  - **Unified Bundle**: `hooks.mjs` (324.25 KB) retained for CLI tools like decision-history
  - **156 TypeScript Hooks**: All hooks migrated to TypeScript with shared utilities
  - **Build Optimization**: esbuild 0.27.2 with `drop: ['debugger']` in production
  - **Test Suite**: 372 tests (39 new split bundle tests)
  - **Performance**: Build time ~60ms, average bundle 34.64 KB per event type

### Changed

- **Plugin Structure**: Restructured to Claude Code marketplace standards (code.claude.com/docs/en/plugins-reference)
  - `.claude-plugin/plugin.json` at plugin root
  - `commands/`, `agents/`, `skills/` at plugin root (not under `.claude/`)
  - `scripts/` for hook executables (flattened from `hooks/`)
  - Each plugin is self-contained with its own skills, agents, commands

- **Documentation**: Updated README.md and CLAUDE.md with modular plugin structure

- **Skills Count**: 161 → 163 (added task-dependency-patterns, decision-history v2.0.0)

- **User-Invocable Skills**: 21 → 22 (decision-history now user-invocable)

- **Doctor Skill**: Version bumped to 2.0.0 with 6 health checks (was 5)

---

## [4.28.3] - 2026-01-21

### Changed

- **Repository Rename**: Complete rebrand from "SkillForge" to "OrchestKit"
  - Repository renamed from `skillforge-claude-plugin` to `orchestkit`
  - Plugin command prefix changed from `/skf:` to `/ork:`
  - All branding references updated: "SkillForge" → "OrchestKit"
  - Package name updated: `skillforge-claude-plugin` → `orchestkit`
  - All file names with "skillforge" renamed to "orchestkit" (18 example files)
  - Updated all repository URLs, installation paths, and documentation references
  - Environment variables renamed: `SKILLFORGE_*` → `ORCHESTKIT_*`
  - Mem0 user IDs and source identifiers updated: `skf:` → `ork:`, `skillforge-*` → `orchestkit-*`
  - JSON schema `$id` URLs and patterns updated
  - Copyright year updated to 2026
  - All skill author fields updated to "OrchestKit"
  - All agent ID prefixes updated from `skf:` to `ork:`

### Fixed

- Updated year references from 2025 to 2026 where appropriate (current year tags, thresholds, compliance names)

---

## [4.28.4] - 2026-01-21

### Added

- **Mem0 Enhancements** - Complete implementation of all Pro features
  - **Graph Relationship Queries**: `get-related-memories.py` and `traverse-graph.py` scripts for multi-hop graph traversal
  - **Webhook Automation**: Full webhook management with `list-webhooks.py`, `update-webhook.py`, `delete-webhook.py`, `webhook-receiver.py`
  - **Analytics Tracking**: `mem0-analytics-tracker.sh` hook for continuous usage monitoring and `mem0-analytics-dashboard.sh` for reports
  - **Batch Operations**: `migrate-metadata.py` for bulk metadata updates and `bulk-export.py` for multi-user exports
  - **Export Automation**: `mem0-backup-setup.sh` hook for scheduled backups and export integration in compaction sync
  - **Hook Integration**: 6 new hooks registered in plugin.json (SessionStart, PostToolUse, Setup events)
  - Total: 23 Python scripts in `skills/mem0-memory/scripts/` (8 new enhancement scripts)

### Changed

- **Mem0 Integration**: Utilization score improved from 7.5/10 to 9.5/10
  - Graph relationships integrated into `mem0-context-retrieval.sh`, `memory-context.sh`, `agent-memory-inject.sh`
  - Webhook support added to `memory-bridge.sh` and `mem0-pre-compaction-sync.sh`
  - Batch operations integrated into `mem0-pre-compaction-sync.sh` and `mem0-cleanup.sh`
  - All hooks output CC 2.1.7 compliant JSON with graceful degradation

### Testing

- **Test Suite Updates**: Enhanced mem0 test coverage
  - Updated `test-mem0-scripts.sh` to test all 23 scripts (added 8 new scripts)
  - Created `test-mem0-enhancements.sh` integration test for graph, webhook, batch, and export flows
  - Created `test-mem0-hooks.sh` unit test for hook structure, compliance, and graceful degradation

---

## [4.28.2] - 2026-01-20

### Added

- **Mem0 Python SDK Scripts** - Direct API integration replacing MCP layer
  - 15 Python scripts in `skills/mem0-memory/scripts/` for all mem0 operations
  - Core scripts: add-memory.py, search-memories.py, get-memories.py, get-memory.py, update-memory.py, delete-memory.py
  - Advanced scripts: batch-update.py, batch-delete.py, memory-history.py, export-memories.py, get-export.py, memory-summary.py, get-events.py, get-users.py, create-webhook.py
  - Shared library: `lib/mem0_client.py` for centralized client initialization
  - Requirements: `requirements.txt` with mem0ai>=1.0.0 dependency

- **Comprehensive Test Suite** - `tests/mem0/test-mem0-scripts.sh` with 22 test cases
  - Script structure validation (7 tests)
  - Script execution verification (4 tests)
  - Import pattern validation (3 tests)
  - Script functionality testing (4 tests)
  - Integration testing (2 tests)
  - Error handling validation (2 tests)

### Changed

- **Mem0 Integration Architecture** - Migrated from MCP to direct Python SDK calls
  - Updated `mem0-memory`, `mem0-sync`, `memory-fabric`, `remember`, `recall` skills to use scripts
  - Updated hooks: `mem0-pre-compaction-sync.sh`, `mem0-decision-saver.sh`, `mem0-context-retrieval.sh`
  - All MCP references replaced with script invocations via Bash tool

- **Test Suite Updates** - Updated 6 test files to reflect script-based approach
  - `tests/unit/test-memory-commands.sh` - Checks for script references
  - `tests/mem0/test-mem0-sync-skill.sh` - Validates script examples
  - `tests/mem0/test-mem0-integration.sh` - Checks script paths in hooks
  - `tests/skills/test-remember-recall-integration.sh` - Validates script integration
  - `tests/unit/test-decision-sync.sh` - Checks script commands
  - `tests/mem0/test-memory-fabric.sh` - Uses script pattern

### Fixed

- Improved skill description triggers for semantic discovery
- Renamed redundant "When to Use" sections to "Overview"
- Added semantic matching test coverage for skill discovery

---


## [4.28.1] - 2026-01-19

### Fixed

- TODO: Describe your changes here

---


## [4.28.0] - 2026-01-18

### Added

- **New agent-browser Skill** - Complete Vercel agent-browser CLI integration
  - `skills/agent-browser/SKILL.md` with comprehensive command reference (60+ commands)
  - References: commands.md, snapshot-refs.md, session-management.md, authentication.md, video-recording.md, proxy-support.md, protocol-alignment.md
  - Templates: capture-workflow.sh, form-automation.sh, authenticated-session.sh
  - Checklist: migration-checklist.md for Playwright MCP → agent-browser migration
  - 93% less context consumption compared to Playwright MCP

- **agent-browser-safety.sh Hook** - Security validation for browser automation
  - Blocks dangerous URL patterns (file://, javascript:, data:, about:)
  - Blocks credential sites (accounts.google.com, login.microsoftonline.com, auth0.com, okta.com)
  - CC 2.1.7 compliant PreToolUse hook

### Changed

- **browser-content-capture Skill** - Migrated from Playwright MCP to agent-browser
  - Rewrote SKILL.md with agent-browser commands and Snapshot + Refs workflow
  - Updated all references: agent-browser-commands.md, spa-extraction.md, auth-handling.md, multi-page-crawl.md
  - Replaced Python/JS templates with Bash scripts: capture-workflow.sh, auth-capture.sh, multi-page-crawl.sh
  - Version bumped to 2.0.0

- **Agent Updates** - Removed deprecated mcp__playwright__* references from 6 agents
  - test-generator.md: Added Browser Automation section with agent-browser guidance
  - performance-engineer.md: Updated for Lighthouse + agent-browser integration
  - rapid-ui-designer.md: Updated for visual testing with agent-browser screenshots
  - frontend-ui-developer.md: Updated for component testing with agent-browser
  - code-quality-reviewer.md: Updated for visual regression testing
  - accessibility-specialist.md: Updated for automated a11y testing with axe-core via agent-browser

### Removed

- **Playwright MCP Integration** - Fully deprecated in favor of agent-browser
  - Removed from .claude/templates/mcp-enabled.json
  - Removed mcp__playwright__* hook matcher from plugin.json
  - Deleted hooks/pretool/mcp/playwright-safety.sh

### Migration Guide

**From Playwright MCP to agent-browser:**

| Playwright MCP | agent-browser |
|----------------|---------------|
| `mcp__playwright__browser_navigate(url)` | `agent-browser open <url>` |
| `mcp__playwright__browser_snapshot()` | `agent-browser snapshot -i` |
| `mcp__playwright__browser_click(ref)` | `agent-browser click @e#` |
| `mcp__playwright__browser_fill_form(ref, values)` | `agent-browser fill @e# "value"` |
| `mcp__playwright__browser_take_screenshot(path)` | `agent-browser screenshot <path>` |

See `skills/agent-browser/checklists/migration-checklist.md` for complete migration guide.

---

## [4.27.6] - 2026-01-18

### Fixed

- **Hook Stdin Consumption** - Fixed 39 hooks missing stdin consumption that caused "hook error" messages
  - Added `_HOOK_INPUT=$(cat 2>/dev/null || true)` to all hooks in lifecycle/, posttool/, skill/, stop/, and prompt/ directories
  - When hooks don't consume stdin, Claude Code reports broken pipe errors even on successful execution
  - All 127 hooks now properly consume stdin

### Added

- **Stdin Consumption Test** - New test to prevent future regressions (`tests/unit/test-hook-stdin-consumption.sh`)
  - Validates all hooks consume stdin using recognized patterns
  - Runs as part of the test suite to catch missing stdin consumption early

---


## [4.27.5] - 2026-01-18

### Fixed

- **Critical Plugin Installation Fix** - Removed invalid `allowed-tools` field from plugin.json
  - The `allowed-tools` field is not part of the official Claude Code 2.1.12 plugin manifest schema
  - This field was causing plugin installation failures in other repositories
  - Users experiencing installation issues should reinstall the plugin after this update
  - Note: `allowed-tools` remains valid in individual command files under `commands/` directory

---

## [4.27.3] - 2026-01-18

### Added

- **New Agents** - Complete agent coverage for critical workflows (#143, #151)
  - `documentation-specialist`: Technical writing expert for API docs, READMEs, ADRs, changelogs, OpenAPI specs
  - `monitoring-engineer`: Observability specialist for Prometheus, Grafana, alerting, OpenTelemetry, SLOs/SLIs

### Changed

- Agent count increased from 32 to 34
- Updated token budget to 350,000 for expanded skill library (159 skills)

---

## [4.27.2] - 2026-01-18

### Added

- **Jinja2 Prompt Templates (2026 Standards)** - Enhanced `prompt-engineering-suite` templates
  - Async rendering support (`render_async()`) with Jinja2 3.1.x `enable_async`
  - Template caching with LRU eviction and hit/miss statistics
  - Custom LLM filters: `tool` (OpenAI function schema), `cache_control` (Anthropic caching), `image` (multimodal)
  - Anthropic format support with `render_to_anthropic()` method
  - Based on [Banks v2.2.0](https://github.com/masci/banks) patterns

- **MCP Security Templates** - Production-ready security implementations for `mcp-security-hardening`
  - `tool-allowlist.py`: Zero-trust MCP tool validator with cryptographic hash verification
  - `session-security.py`: Secure session manager with 256-bit entropy IDs, lifecycle state machine
  - Tool poisoning attack detection with 15+ malicious patterns
  - Rate limiting, expiration, and permission-based access control

### Changed

- **Template Code Quality** - Comprehensive error handling in inference templates
  - `vllm-server.py`: Added `check_vllm_installed()`, CUDA validation, subprocess error handling
  - `quantization-config.py`: Added `check_dependencies()`, `QuantConfig.__post_init__` validation, bounds checking

- **Agent Improvements**
  - `prompt-engineer.md`: Fixed non-existent MCP references, added `function-calling` and `llm-streaming` skills
  - `ai-safety-auditor.md`: Added `sequential-thinking` MCP, comprehensive error handling section
  - Expanded activation keywords for better auto-detection

### Fixed

- Removed non-existent `mcp__langfuse__*` tool references from prompt-engineer agent
- Fixed unused import warnings in template files
- Added missing Error Handling sections to agents per OrchestKit agent standards

- **Complete Skill-Agent Integration Audit** - Fixed 32 missing bidirectional references across 13 agents
  - `backend-system-architect`: +5 skills (api-versioning, architecture-decision-record, backend-architecture-enforcer, error-handling-rfc9457, rate-limiting)
  - `data-pipeline-engineer`: +5 skills (agentic-rag-patterns, background-jobs, browser-content-capture, caching-strategies, devops-deployment)
  - `llm-integrator`: +4 skills (fine-tuning-customization, high-performance-inference, mcp-advanced-patterns, ollama-local)
  - `metrics-architect`: +3 skills (cache-cost-tracking, observability-monitoring, performance-testing)
  - `workflow-architect`: +3 skills (agent-loops, alternative-agent-frameworks, temporal-io)
  - `accessibility-specialist`: +1 skill (react-aria-patterns)
  - `code-quality-reviewer`: +2 skills (clean-architecture, project-structure-enforcer)
  - `frontend-ui-developer`: +2 skills (edge-computing-patterns, streaming-api-patterns)
  - `rapid-ui-designer`: +1 skill (motion-animation-patterns)
  - `security-auditor`: +2 skills (llm-safety-patterns, mcp-security-hardening)
  - `security-layer-auditor`: +1 skill (defense-in-depth)
  - `system-design-reviewer`: +1 skill (system-design-interrogation)
  - `test-generator`: +2 skills (llm-testing, test-standards-enforcer)

---

## [4.27.1] - 2026-01-18

### Fixed

- **Deprecated datetime.utcnow() cleanup** - Fixed 176+ occurrences across 25+ skills
  - Replaced with `datetime.now(timezone.utc)` in markdown documentation
  - Replaced with `datetime.now(UTC)` in Python template files (Python 3.11+)
  - Skills updated: saga-patterns, cqrs-patterns, grpc-python, celery-advanced, temporal-io, strawberry-graphql, auth-patterns, message-queues, domain-driven-design, mcp-security-hardening, advanced-guardrails, prompt-engineering-suite, and more

- **Agent skill integration gaps** - Fixed missing bidirectional skill references
  - Added `grpc-python` and `strawberry-graphql` to `backend-system-architect` agent
  - Added `saga-patterns` and `cqrs-patterns` to `event-driven-architect` agent
  - Fixed `celery-advanced` SKILL.md agent reference (was `data-pipeline-engineer`, now correctly `python-performance-engineer`)

---

## [4.27.0] - 2026-01-18

### Added

- **AI/ML Roadmap 2026 Implementation** (#72, #73, #74, #75, #76, #77, #78, #79, #148, #150)

  **8 New AI/ML Skills:**
  - `skills/mcp-security-hardening` (#74): Multi-layer MCP defense - tool description sanitization, zero-trust allowlists, hash verification, rug pull detection, session security
  - `skills/advanced-guardrails` (#72): NeMo Guardrails + Guardrails AI + DeepTeam - Colang 2.0 rails, 100+ validators, red-teaming, OWASP LLM Top 10 2025
  - `skills/agentic-rag-patterns` (#73): Self-RAG, Corrective-RAG (CRAG), knowledge graph RAG - document grading, query transformation, web fallback
  - `skills/prompt-engineering-suite` (#76): Chain-of-Thought, few-shot learning, Langfuse versioning, DSPy optimization, A/B testing
  - `skills/alternative-agent-frameworks` (#75): CrewAI hierarchical crews, OpenAI Agents SDK handoffs, Microsoft Agent Framework (AutoGen+SK merger), AG2
  - `skills/mcp-advanced-patterns` (#77): Tool composition, resource lifecycle management, auto:N thresholds, horizontal scaling, FastMCP production patterns
  - `skills/high-performance-inference` (#78): vLLM PagedAttention, AWQ/GPTQ/FP8 quantization, speculative decoding, edge deployment
  - `skills/fine-tuning-customization` (#79): LoRA/QLoRA fine-tuning, DPO alignment, synthetic data generation, when-to-finetune decision framework

  **2 New Agents:**
  - `agents/ai-safety-auditor.md` (#148): AI safety/security auditor with opus model - red teaming, guardrail validation, prompt injection testing, OWASP LLM compliance
  - `agents/prompt-engineer.md` (#150): Prompt design specialist with sonnet model - CoT, few-shot, versioning, A/B testing, optimization

  **Comprehensive Skill Structure:**
  - Each skill includes SKILL.md + 4-5 references + templates + checklists
  - 62 new files across 8 skills (~60KB of documentation)
  - Production-ready Python templates and YAML configurations

  **Test Suites:**
  - `tests/skills/test-ai-ml-skills.sh`: 77 tests validating skill structure, frontmatter, references, templates
  - `tests/agents/test-ai-ml-agents.sh`: Agent validation for frontmatter, skills, sections, model selection

### Changed

- Skills count: 145 → 159 (added 8 AI/ML skills + 6 additional skills)
- Agents count: 29 → 32 (added ai-safety-auditor, prompt-engineer, multimodal-specialist)
- Hooks count: 131 → 144 (added new pretool/posttool hooks)
- AI/LLM skills category: 19 → 27 skills
- New AI Security category: 3 skills (mcp-security-hardening, advanced-guardrails, llm-safety-patterns)
- New MCP category: 2 skills (mcp-advanced-patterns, mcp-server-building)

### Fixed

- Template files now include all required imports (ErrorBoundary, useState, useEffect)
- Documentation counts synchronized with actual file counts
- plugin.json, pyproject.toml, CLAUDE.md all reflect accurate counts

---

## [4.26.0] - 2026-01-18

### Added

- **Frontend Skills Expansion** (#111, #117, #118, #119, #120, #121, #122)
  - `skills/lazy-loading-patterns`: React.lazy, Suspense, route-based splitting, intersection observer, preload strategies
  - `skills/view-transitions`: View Transitions API, React Router integration, shared element animations, MPA transitions
  - `skills/scroll-driven-animations`: CSS Scroll-Driven Animations, ScrollTimeline, ViewTimeline, parallax effects
  - `skills/responsive-patterns`: Container Queries, cqi/cqb units, fluid typography, mobile-first patterns
  - `skills/pwa-patterns`: Workbox 7.x, service worker lifecycle, caching strategies, installability
  - `skills/recharts-patterns`: Recharts 3.x, responsive charts, custom tooltips, animations, accessibility
  - `skills/dashboard-patterns`: Widget composition, real-time updates, TanStack Table, responsive grids

- **Performance Engineer Agent** (#145)
  - `agents/performance-engineer.md`: Optimizes Core Web Vitals (LCP, INP, CLS), analyzes bundles, profiles renders
  - Skills: core-web-vitals, lazy-loading-patterns, image-optimization, render-optimization, vite-advanced
  - Activation keywords: performance, Core Web Vitals, LCP, INP, CLS, bundle, Lighthouse, RUM

- **Test Suites**
  - `tests/skills/test-frontend-skills.sh`: Validates 7 new frontend skills structure
  - `tests/agents/test-performance-engineer.sh`: Validates performance-engineer agent

### Changed

- Skills count: 138 → 145 (added 7 frontend skills)
- Agents count: 28 → 29 (added performance-engineer)
- Frontend skills category: 16 → 23 skills

---

## [4.25.0] - 2026-01-18

### Added

- **CC 2.1.x Compliance & Hook Optimizations**
  - Ensure 100% CC 2.1.7 JSON output compliance across all 147 hooks
  - Add `output_silent_success`, `output_with_context`, `output_block` functions
  - Configure MCP auto:N thresholds (context7:75, memory:90, mem0:85, playwright:50)
  - Add statusline context_window config for CC 2.1.6
  - Add 15 wildcard permissions for common Bash patterns
  - Add `once:true` to Setup hooks (first-run-setup, setup-check)

- **New Hooks Implemented** (#127, #128, #129, #133, #134, #136, #137, #138, #139, #140)
  - `hooks/posttool/skill/skill-usage-optimizer.sh`: Track skill usage patterns
  - `hooks/pretool/Write/code-quality-gate.sh`: Unified complexity + type checking
  - `hooks/posttool/Write/code-style-learner.sh`: Extract code style patterns
  - `hooks/posttool/Write/naming-convention-learner.sh`: Extract naming conventions
  - `hooks/lifecycle/session-start/dependency-version-check.sh`: Check outdated deps
  - `hooks/pretool/bash/license-compliance.sh`: Validate license headers
  - `hooks/pretool/bash/affected-tests-finder.sh`: Find related tests
  - `hooks/pretool/Write/docstring-enforcer.sh`: Enforce docstrings
  - `hooks/posttool/Write/readme-sync.sh`: Sync README changes

- **Pre-commit Validation Improvements**
  - Update `pre-commit-simulation.sh` to v2.0.0 with BLOCKING on critical errors
  - Add plugin.json validation (JSON syntax, required fields, semver)
  - Add CHANGELOG version check
  - Add quick unit tests for OrchestKit plugin modifications
  - Install actual git pre-commit hook (`.git/hooks/pre-commit`)

### Changed

- Hook count: 127 → 140
- Setup hooks optimized: Use bash globs instead of `find | wc -l`
- Version constants synced to 4.25.0 across all Setup hooks

### Fixed

- XSS vulnerability in `blog-app-example.tsx` with DOMPurify sanitization

---

## [4.24.0] - 2026-01-18

### Added

- **Error Solution Suggester Hook** (#124)
  - `hooks/posttool/error-solution-suggester.sh`: PostToolUse hook for intelligent error remediation
  - Pattern matches error output from Bash commands to known solutions
  - 45+ error patterns covering:
    - Database: PostgreSQL role/relation errors, connection pool exhaustion, constraint violations
    - Node.js/npm: Module not found, ENOENT, permission errors, peer dependencies
    - Git: Merge conflicts, detached HEAD, protected branch violations
    - Python: ModuleNotFoundError, asyncio errors, Pydantic validation
    - TypeScript: Type errors, declaration missing
    - Network: ECONNREFUSED, timeout, CORS
    - Auth: JWT errors, 401/403 responses
    - Docker: Container exit, port conflicts
    - Build: Webpack/Vite errors, memory issues, React hydration
  - Automatic skill linking: Suggests relevant OrchestKit skills based on error category
  - Deduplication: Prevents repeated suggestions for same error within session
  - CC 2.1.9 compliant: Injects solutions via `hookSpecificOutput.additionalContext`
  - `.claude/rules/error_solutions.json`: Comprehensive error→solution database
  - 25 unit tests for pattern matching and deduplication validation

### Changed

- Hook count: 130 → 131

---

## [4.23.0] - 2026-01-18

### Added

- **Multimodal AI Foundation** (#71)
  - `skills/vision-language-models`: GPT-5, Claude 4.5, Gemini 2.5/3, Grok 4 vision patterns
  - `skills/audio-language-models`: Grok Voice Agent, Gemini Live API, GPT-4o-Transcribe, TTS
  - `skills/multimodal-rag`: CLIP, SigLIP 2, Voyage multimodal-3 embeddings
  - `agents/multimodal-specialist`: Vision, audio, video processing specialist
  - Reference documentation for document-vision, cost-optimization, image-captioning
  - Reference documentation for streaming-audio, tts-patterns, whisper-integration
  - Reference documentation for clip-embeddings, multimodal-chunking
  - Implementation checklists for all 3 skills
  - `docs/roadmap/multimodal-ai-foundation.md`: Implementation roadmap

### Changed

- Skills count: 135 → 138 (added 3 multimodal skills)
- Agents count: 27 → 28 (added multimodal-specialist)

---

## [4.22.0] - 2026-01-18

### Added

- **Context Pruning Advisor Hook** (#126)
  - `hooks/prompt/context-pruning-advisor.sh`: UserPromptSubmit hook for intelligent context management
  - Analyzes loaded context (skills, files, agent outputs) when usage exceeds 70%
  - Multi-dimensional scoring algorithm:
    - Recency: 0-10 points based on time since last access
    - Frequency: 0-10 points based on access count during session
    - Relevance: 0-10 points based on keyword overlap with current prompt
  - Recommends top 5 pruning candidates via CC 2.1.9 additionalContext
  - Critical warning at 95% context usage
  - Bash 3.2 compatible (macOS default bash)
  - `.claude/docs/context-pruning-algorithm.md`: Comprehensive algorithm design documentation
  - 19 unit tests for scoring algorithm validation

### Changed

- Hook count: 129 → 130

---

## [4.21.0] - 2026-01-18

### Added

- **Skill Auto-Suggest Hook** (#123)
  - `hooks/prompt/skill-auto-suggest.sh`: UserPromptSubmit hook for proactive skill suggestions
  - Analyzes prompts for 100+ keywords across domains (API, database, auth, testing, frontend, AI/LLM, DevOps)
  - Injects relevant skill suggestions via CC 2.1.9 additionalContext
  - Confidence scoring with max 3 suggestions per prompt
  - 25 unit tests for comprehensive coverage

### Changed

- Hook count: 128 → 129

---

## [4.20.0] - 2026-01-18

### Added

- **Memory Fabric v2.1** - Graph-first architecture with optional Mem0 cloud enhancement
  - `skills/load-context`: Auto-load memories at session start with context-aware tiers
  - `skills/mem0-sync`: Auto-sync session context, decisions, and patterns
  - `commands/load-context.md`: User-invocable command for manual context loading
  - `commands/mem0-sync.md`: User-invocable command for manual sync

- **10 Frontend Skills Expanded to Baseline Quality**
  - `zustand-patterns`: Zustand 5.x state management with slices, middleware, Immer
  - `tanstack-query-advanced`: TanStack Query v5 patterns for infinite queries, optimistic updates
  - `form-state-patterns`: React Hook Form v7 with Zod validation, React 19 useActionState
  - `core-web-vitals`: LCP, INP, CLS optimization with 2026 thresholds
  - `image-optimization`: Next.js 15 Image, AVIF/WebP, blur placeholders, CDN loaders
  - `render-optimization`: React Compiler, memoization, TanStack Virtual
  - `shadcn-patterns`: CVA variants, OKLCH theming, cn() utility
  - `radix-primitives`: Accessible primitives, asChild composition
  - `vite-advanced`: Vite 7 Environment API, plugin development
  - `biome-linting`: Biome 2.0+ with type inference, ESLint migration

- **Frontend UI Developer Agent Enhancement**
  - Added 10 new skills to frontend-ui-developer agent skills array
  - All skills properly integrated with bidirectional references

### Fixed

- **CI Failures**: Corrected component counts across all files
  - Skills: 135 (20 user-invocable, 115 internal)
  - Hooks: 128
  - Commands: 20
- **Token Budget**: Increased skill-agent integration test budget to 260K tokens
- **Test Expectations**: Updated all hardcoded counts in test files
- **Orphan Command**: Fixed load-context command by creating matching skill

### Changed

- Skills count: 129 → 135 (added 6 new skills)
- User-invocable skills: 18 → 20 (added load-context, mem0-sync)
- Updated plugin.json, CLAUDE.md with accurate counts
- All 5 new frontend skills now have `user-invocable: false` field

---

## [4.19.0] - 2026-01-17

### Added

- **CC 2.1.11 Setup Hooks**
  - New `--init`, `--init-only`, and `--maintenance` CLI support
  - `hooks/setup/setup-check.sh`: Entry point with fast validation (< 10ms happy path)
  - `hooks/setup/first-run-setup.sh`: Full setup + interactive wizard
  - `hooks/setup/setup-repair.sh`: Self-healing for broken installations
  - `hooks/setup/setup-maintenance.sh`: Periodic maintenance (log rotation, lock cleanup)
  - Hybrid marker file detection for fast first-run checking

- **Skills Expansion**
  - Checklists and examples added to 6 git/github workflow skills
  - Related Skills and Key Decisions sections added to 34 skills
  - New skills: `wcag-compliance`, `zero-downtime-migration`, `focus-management`

- **Agent Enhancements**
  - 2 new agents added (total: 27)
  - Improved skill injection with CC 2.1.6 native format

- **Automatic Pattern Extraction** (#48, #49)
  - `hooks/posttool/bash/pattern-extractor.sh`: Auto-extracts patterns from commits, tests, builds, PR merges
  - `hooks/stop/session-patterns.sh`: Persists patterns to `learned-patterns.json` on session end
  - `hooks/prompt/antipattern-warning.sh`: Detects 7 built-in anti-patterns and injects warnings via CC 2.1.9 additionalContext
  - Fully automatic - no manual commands needed
  - Bash 3.2 compatible (no associative arrays)

- **Tests**
  - `tests/unit/test-pattern-extraction.sh`: 20 tests for pattern extraction system

### Fixed

- **Bash 3.2 Compatibility**: Fixed macOS compatibility issues with case conversion
- **Hook stdin handling**: Fixed Python 3.13 compatibility for hook input
- **Ruff linting errors**: Resolved all Python linting issues
- **Stop hooks**: Now log silently to files instead of stdout
- **Unbound variables**: Fixed several hooks with unbound variable errors
- **JSON output**: Fixed hooks producing invalid JSON in edge cases

### Changed

- Skills count: 103 → 111 (added 8 new skills)
- Agents count: 25 → 27 (added 2 agents)
- Hooks count: 109 → 120 (added 9 Setup hooks + 2 pattern extraction hooks)
- Updated CLAUDE.md with CC 2.1.11 documentation

---

## [4.18.0] - 2026-01-16

### Added

- **6 Git/GitHub Workflow Skills**
  - `milestone-management`: gh api patterns for milestone CRUD (no native gh CLI support)
  - `atomic-commits`: Small, focused commits with `git add -p` and interactive staging
  - `branch-strategy`: GitHub Flow + feature flags for trunk-based development
  - `stacked-prs`: Multi-PR development for large features with rebase management
  - `release-management`: `gh release` + semantic versioning workflows
  - `git-recovery`: Reflog, undo patterns, safe recovery from mistakes

- **4 Git Enforcement Hooks** (CC 2.1.9 additionalContext)
  - `git-commit-message-validator.sh`: **BLOCKS** invalid conventional commits
  - `git-branch-naming-validator.sh`: **WARNS** on non-standard branch names
  - `git-atomic-commit-checker.sh`: **WARNS** on commits >10 files or >400 lines
  - `gh-issue-creation-guide.sh`: **INJECTS** checklist context before `gh issue create`

- **GitHub CLI Skill Enrichment**
  - `checklists/issue-creation-checklist.md`: Pre-creation verification workflow
  - `checklists/labeling-guide.md`: Label categories, validation, audit queries
  - `references/issue-templates.md`: Ready-to-use templates for bugs, features, tasks
  - `templates/issue-scripts.sh`: Automation with duplicate checks

- **CI Improvements**
  - `bin/ci-setup.sh`: Centralized CI environment setup script
  - Removes unreliable third-party repos (Microsoft, Azure CLI) before `apt-get update`
  - Cross-platform support (Ubuntu/macOS)

- **Tests**
  - `tests/unit/test-git-enforcement-hooks.sh`: 28 tests for all new hooks and skills

### Fixed

- **CI 403 Errors**: Removed unused Microsoft/Azure package repos that cause intermittent failures
- **Test 5 in test-context-deferral.sh**: Updated to check CLAUDE.md for CC version requirement (engines field was removed from plugin.json)

### Changed

- Skills count: 97 → 103 (added 6 git/GitHub skills)
- Hooks count: 105 → 109 (added 4 enforcement hooks)
- All CI jobs now use centralized `./bin/ci-setup.sh` instead of inline apt-get

---

## [4.17.2] - 2026-01-16

### Fixed

- **Commands Autocomplete**: Added `commands/` directory with 17 command files to enable autocomplete for `/ork:*` commands (#68)
  - Commands now appear in Claude Code autocomplete when typing `/ork:`
  - Each command file has YAML frontmatter (`description`, `allowed-tools`) and references corresponding skill

### Added

- **Test Coverage**: New `tests/commands/test-commands-structure.sh` validates commands directory structure
- **CI Integration**: Commands validation added to `run-all-tests.sh`

### Technical Details

- Claude Code has two systems for slash commands:
  1. `commands/` directory - Shows in autocomplete
  2. `skills/*/SKILL.md` with `user-invocable: true` - Works via Skill tool
- Previously only using skills system; now both systems are connected

---

## [4.17.1] - 2026-01-16

### Changed

- **README.md**: Updated "What's New" section to v4.17.0 with CC 2.1.9 features
- **Documentation**: Added user-invocable skills breakdown (17 commands, 80 internal)
- **Version Alignment**: All version references now consistently at 4.17.x

---


## [4.17.0] - 2026-01-16

### Added

**CC 2.1.3 User-Invocable Skills**
- Added `user-invocable: true` to 17 command skills (commit, review-pr, explore, implement, verify, configure, doctor, feedback, recall, remember, add-golden, skill-evolution, claude-hud, create-pr, fix-issue, brainstorming, worktree-coordination)
- Added `user-invocable: false` to 80 internal knowledge skills
- Only user-invocable skills appear in `/ork:*` slash command menu

**Test Coverage**
- New Test 10 in `tests/skills/structure/test-skill-md.sh`: validates user-invocable field presence and counts (17 commands, 80 internal)

### Changed

- Updated plugin.json description to clarify "97 skills (17 user-invocable commands, 80 internal knowledge)"
- Updated CLAUDE.md to reflect 17 user-invocable skills (was 12)
- Updated bin/validate-counts.sh comments for accuracy
- Version bumped: 4.16.0 → 4.17.0

---

## [4.16.0] - 2026-01-16

### Added

**CC 2.1.9 Integration**
- New helper functions in `hooks/_lib/common.sh`: `output_with_context()`, `output_allow_with_context()`, `output_allow_with_context_logged()`
- New session ID helpers: `get_session_state_dir()`, `get_session_temp_file()`, `ensure_session_temp_dir()`
- PreToolUse `additionalContext` support for injecting guidance before tool execution
- `plansDirectory` setting in `.claude/defaults/config.json`
- `auto:N` MCP thresholds in `.claude/templates/mcp-enabled.json` (context7:75, sequential-thinking:60, mem0:80, memory:70, playwright:50)

**Hook Updates with additionalContext**
- `git-branch-protection.sh` - Injects branch context before git commands
- `error-pattern-warner.sh` - Injects learned error patterns
- `context7-tracker.sh` - Injects cache state
- `architecture-change-detector.sh` - Injects affected patterns

### Changed

- Engine requirement updated to `>=2.1.9`
- Removed session ID fallback patterns (`:-default`, `:-unknown`) for CC 2.1.9 compliance
- Updated `test-context-system.sh` to set `CLAUDE_SESSION_ID` for hook testing
- Version bumped: 4.15.3 → 4.16.0

### Fixed

- Version consistency across marketplace.json, identity.json, plugin.json

---

## [4.15.3] - 2026-01-15

### Fixed

**CI/CD Test Compatibility**
- Fixed bash arithmetic `((VAR++))` exit issue with `set -e` across 30+ test files
- Added `|| true` to arithmetic operations that return 0 on first call
- Fixed coordination.sh paths in 4 hooks (missing `.claude/` prefix)
- Added cross-platform timeout wrapper for macOS compatibility (timeout/gtimeout/direct)
- Fixed file-lock-release.sh double JSON output (trap + exit race condition)

**Hook JSON Output**
- Added clean_exit helper pattern to prevent trap/output duplication
- Ensured all coordination hooks properly clear trap before normal exits

### Changed
- Updated test-hook-json-output.sh with run_with_timeout helper function

---

## [4.15.1] - 2026-01-15

### Added

**Enhanced Mem0 Integration**
- Added `remember` and `recall` skills to all 20 agents for automatic mem0 capability injection
- New hook: `hooks/stop/auto-remember-continuity.sh` - Prompts storing session context at session end
- New hook: `hooks/prompt/antipattern-detector.sh` - Suggests checking mem0 for known failures before implementing patterns
- New test file: `tests/unit/test-mem0-prompt-hooks.sh` - Tests for new mem0 hooks and agent skill integration

### Fixed

**Context Bloat**
- Reset session state from 774 lines to 13 lines (~500+ tokens saved per session)
- Cleaned accumulated handoff and verification-queue files

**Version Synchronization**
- Synced `identity.json` version to match `plugin.json` (both now 4.15.1)

**Documentation Accuracy**
- Fixed hook count in plugin description (103 → 81 actual registered hooks)

### Changed
- Bumped version to 4.15.1

---

## [4.11.1] - 2026-01-14

### Fixed

**Startup Hook Errors**
- Fixed CLAUDE_PROJECT_DIR unbound variable errors in 5 hooks by adding fallback to `$(pwd)`
- Affected hooks: `session-context-loader.sh`, `session-env-setup.sh`, `common.sh`, `auto-approve-project-writes.sh`, `git-branch-protection.sh`

**Test Suite Fixes**
- Fixed `test-skill-discovery.sh` unbound `skill_dir` variable
- Updated `test-agent-definitions.sh` to support CC 2.1.6 nested skills structure and YAML list parsing
- Updated `test-plugin-installation.sh` for CC 2.1.6 structure (directories instead of symlinks)

**Context & Skills**
- Added `$schema` field to `.claude/context/session/state.json`
- Fixed `claude-hud` skill: added "When to Use" section, converted capabilities to slim format (under 350 token budget)
- Synced version to 4.11.1 across all manifests

**Agent Configuration Issues (#39)**
- Changed `model: haiku` → `model: sonnet` for 4 agents requiring deeper reasoning:
  - `security-layer-auditor` (8-layer defense audit)
  - `security-auditor` (CVE analysis, OWASP validation)
  - `ux-researcher` (personas, journey mapping)
  - `rapid-ui-designer` (WCAG analysis, design specs)
- Added explicit `context:` mode to all 20 agents (was defaulting silently):
  - 17 agents: `context: fork` (complex operations)
  - 3 agents: `context: inherit` (lightweight utilities: requirements-translator, prioritization-analyst, market-intelligence)
- Added missing `handoff-preparer.sh` hook to 10 agents

### Added

**Agent & Skill CI Tests**
- New test suite: `tests/agents/`
  - `test-agent-model-selection.sh` - Validates appropriate model for task complexity
  - `test-agent-context-modes.sh` - Ensures explicit context declaration
  - `test-agent-required-hooks.sh` - Validates required Stop hooks
  - `test-agent-frontmatter.sh` - CC 2.1.6 compliance check
- New test suite: `tests/skills/`
  - `test-skill-structure.sh` - Validates Tier 1-4 files exist
  - `test-skill-context-modes.sh` - Validates appropriate context modes
  - `test-skill-references.sh` - Validates agent skill references
- Added `agent-skill-tests` job to CI workflow
- Updated CLAUDE.md with new test commands

### Changed
- Test results improved from 7 failing to 0 failing (26 tests pass)

---
## [4.11.0] - 2026-01-13

### Changed

**Hook Consolidation**
- Reduced from 44 to 24 registered hooks using dispatcher pattern (48% reduction)
- Created 3 new dispatchers: agent-dispatcher.sh, skill-dispatcher.sh, session-end-dispatcher.sh
- Fixed all 44 broken hook paths in hooks.json
- Synced plugin.json and hooks.json (both now have 24 registered hooks)

**MCP Updates**
- Added mem0 (cloud semantic memory) alongside Anthropic memory MCP
- Both can be enabled simultaneously for different use cases
- Updated MCP documentation in configure skill references

### Removed
- 9 unused hook files:
  - `pretool/mcp/*.sh` (3 files - MCP tracking not implemented)
  - `pretool/input-mod/bash-defaults.sh` (duplicate of bash-dispatcher)
  - `pretool/input-mod/path-normalizer.sh` (unused)
  - `lifecycle/context-loader.sh` (replaced by session-context-loader.sh)
  - `stop/llm-code-review.sh` (unused)
  - `pretool/Write/file-lock-check.sh` (duplicate)
  - `pretool/Edit/file-lock-check.sh` (duplicate)

---

## [4.8.0] - 2026-01-12

### Changed

**Plugin Architecture Standardization**
- Moved `skills/`, `agents/`, `hooks/` from `.claude/` to root level (official Anthropic standard)
- Removed root-level symlinks - directories are now actual content, not symlinks
- Updated all hook paths in `settings.json` from `/.claude/hooks/` to `/hooks/`
- OrchestKit extensions (`context/`, `coordination/`, `settings.json`) remain in `.claude/`

**Path Updates**
- Updated 5 bin/ scripts to use root-level paths
- Updated all test files with new path structure
- Updated documentation (CLAUDE.md, README.md, CONTRIBUTING.md)

### New Structure

```
orchestkit/
├── skills/                  # 90 skills (moved from .claude/skills/)
├── agents/                  # 20 agents (moved from .claude/agents/)
├── hooks/                   # 96 hooks (moved from .claude/hooks/)
├── .claude/
│   ├── settings.json        # Hook configuration
│   ├── context/             # Context Protocol 2.0
│   └── coordination/        # Multi-worktree system
└── ...
```

---


## [4.7.4] - 2026-01-12
### Fixed

**Documentation**
- Fixed plugin installation commands in README.md and CLAUDE.md
  - Removed non-existent tier-specific install commands (`@orchestkit/standard`, etc.)
  - Use correct plugin name: `/plugin install skf`
  - Direct users to `/ork:configure` for tier selection after installation

**Skill Version Consistency**
- brainstorming: Fixed version mismatch (1.0.0 → 2.0.0), corrected template path reference
- api-design-framework: Aligned version (1.0.0 → 1.1.0) with changelog
- e2e-testing: Aligned capabilities.json version (1.2.0 → 2.0.0) with SKILL.md
- webapp-testing: Aligned SKILL.md version (1.0.0 → 1.1.0), updated year tag to 2026
- github-cli: Bumped version (1.0.0 → 2.0.0) for upcoming feature additions
- unit-testing: Updated Jest API to Vitest (`jest.clearAllMocks` → `vi.clearAllMocks`)

**CI Workflow**
- Fixed hook path validation in plugin-validation.yml to handle `${CLAUDE_PLUGIN_ROOT}` pattern

---


## [4.7.3] - 2026-01-12

### Fixed

**Plugin Installation Compatibility**
- Fixed hooks not working when installed via `/plugin install` in other repositories
- Changed all hook paths in `settings.json` from `$CLAUDE_PROJECT_DIR` to `${CLAUDE_PLUGIN_ROOT}`
- Updated `common.sh` with `PLUGIN_ROOT` variable that handles both plugin and project-scoped modes
- Restored root-level symlinks (`skills`, `hooks`, `agents`) - **required for plugin discovery**
  - Note: v4.7.1 incorrectly removed these; they ARE needed for `/plugin install` to work
  - Project-scoped installation (copying `.claude/`) still works without symlinks

### Added

**Installation Validation Tests**
- `tests/integration/test-plugin-installation.sh` - Validates plugin structure:
  - Root-level symlinks exist and point to valid directories
  - `settings.json` uses `${CLAUDE_PLUGIN_ROOT}` (not `$CLAUDE_PROJECT_DIR`)
  - Skills are discoverable
  - Hooks are executable
  - Version consistency across manifest files

---

## [4.7.2] - 2026-01-12

**Version Alignment**
- Synchronized version to 4.7.2 across all files (plugin.json, .claude-plugin/, CLAUDE.md, README.md, identity.json)
- Corrected `.claude-plugin/` directory status - retained for Claude Code plugin compatibility
- Updated CC requirement references to 2.1.4 in doctor skill documentation

---

## [4.7.1] - 2026-01-12

### Removed

**Deprecated Files Cleanup**
- `plugin-metadata.json` - 97KB outdated duplicate file
- Root-level symlinks (`agents`, `commands`, `hooks`, `skills`) - canonical paths are inside `.claude/`

### Changed

**Documentation Updates**
- `CONTRIBUTING.md` - rewritten to reflect current architecture:
  - 4-tier progressive skill loading structure
  - CC 2.1.4+ hook JSON output requirements
  - Updated project structure and paths

## [4.7.0] - 2026-01-10

### Added

**Claude Code 2.1.3 Full Overhaul Release**

This release fully leverages Claude Code 2.1.3 features for a comprehensive upgrade.

**New Health Diagnostics Skill**
- `/ork:doctor` - Comprehensive health check command
- Permission rules analysis (unreachable rules detection - CC 2.1.3 feature)
- Hook health validation (executable permissions, dispatcher references)
- Schema compliance checks
- Coordination system integrity verification
- Context budget monitoring

**Quality Gate Hooks (10-Minute Timeout)**
- `full-test-suite.sh` - Runs complete test suite on conversation stop
- `security-scan-aggregator.sh` - Aggregates npm audit, pip-audit, semgrep results
- `llm-code-review.sh` - AI-powered code review for uncommitted changes
- All new hooks use 600,000ms timeout (CC 2.1.3 feature)

**Team Permission Profiles**
- `.claude/permissions/profiles/` - Shareable permission configurations
- `secure.json` - Minimal permissions for solo development
- `team.json` - Standard team permissions
- `enterprise.json` - Strict enterprise permissions
- `/ork:apply-permissions` - Apply profiles to settings.json

**Release Channel Documentation**
- `.claude/docs/release-channels.md` - Stable vs latest channel guidance
- CC version compatibility matrix
- Feature availability by version

### Changed

**Version Requirements**
- Claude Code requirement: `>=2.1.3` (was `>=2.1.2`)
- Plugin version: 4.7.0
- Engine specification added to plugin.json

**Agent Model Optimization**
- Added `model_preference` to all 20 agent definitions
- Complex reasoning agents (workflow-architect, backend-system-architect, system-design-reviewer): opus
- Balanced task agents: sonnet
- Fast routing agents: haiku
- CC 2.1.3 fixes sub-agent model selection

**Documentation Updates**
- README.md: Added CC 2.1.3+ compatibility badge
- CLAUDE.md: Updated version requirements
- Skill count: 79 (added doctor skill)
- Hook count: 93 (added quality gate hooks)

### Deprecated

**Commands Directory**
- 12 commands in `.claude/commands/` now have deprecation notices
- Commands continue to work for backwards compatibility
- Future versions will migrate to unified skills namespace

---

## [4.6.7] - 2026-01-09

### Changed

**MCP Integrations Now Opt-in**
- All MCPs disabled by default in `.mcp.json` (`"disabled": true`)
- Added Step 5 to `/ork:configure` for MCP selection
- Users explicitly choose which MCPs to enable via interactive wizard
- No surprise package downloads on plugin install

**Documentation Updates**
- Updated README MCP section to mark integrations as optional
- Updated CLAUDE.md MCP Integration line
- Added MCP step to README configuration wizard list

---

## [4.6.6] - 2026-01-09

**Skill Template Literal Bash Parsing**
- Fixed 13 SKILL.md files containing JavaScript template literals that caused bash parsing errors
- Replaced backtick template strings with string concatenation to prevent Claude Code Skill tool crashes
- Major refactor of `edge-computing-patterns` skill to reference-based architecture
- Affected skills: api-design-framework, edge-computing-patterns, github-cli, i18n-date-patterns,
  input-validation, llm-streaming, mcp-server-building, motion-animation-patterns,
  observability-monitoring, performance-optimization, react-server-components-framework,
  streaming-api-patterns, type-safety-validation

### Changed

**CI/CD Improvements**
- Enhanced `version-check.yml` to **block** PRs without version bump (was warn-only)
- Added CHANGELOG.md validation - PRs must include changelog entry for new version
- Updated `bump-version.sh` to auto-generate CHANGELOG template entry
- `bump-version.sh` now updates CLAUDE.md version references

---

## [4.6.5] - 2026-01-09

### Changed

**Plugin Namespace Rename**
- Renamed plugin from `orchestkit-complete` to `ork` for shorter agent prefixes
- Agents now appear as `ork:debug-investigator` instead of `orchestkit-complete:debug-investigator`

**Silent Hooks on Success**
- PreToolUse Task hooks now silent on success (no stderr output)
- Removed `info()` calls, replaced with `log_hook()` for file-only logging
- Warnings only shown for actual issues (context limits, unknown types)

**Improved Agent Discovery**
- Subagent validator now scans `.claude/agents/` directory for valid types
- Handles namespaced agent types (e.g., `ork:agent-name`)

- Updated author email to `yonatan2gross@gmail.com`
- Changed author from "OrchestKit Team" to "Yonatan Gross"

---

## [4.6.4] - 2026-01-09

**Marketplace Schema Compatibility**
- Rewrote `.claude-plugin/marketplace.json` to match official Anthropic schema
- Changed `owner` from string to object format `{name, email}`
- Replaced custom `plugins[].skills` array with standard `source` field
- Removed unrecognized fields: `includes_agents`, `includes_commands`, `includes_hooks`
- Removed custom `features`, `installation`, `marketplace_status` sections
- Plugin now validates against `https://anthropic.com/claude-code/marketplace.schema.json`

### Changed

- Simplified marketplace.json to single plugin entry pointing to repo root
- Bundle/tier concept moved to internal plugin.json (not marketplace registry)

---

## [4.6.3] - 2026-01-09

### Added

**6 New Retrieval & AI Skills**
- `hyde-retrieval` - HyDE (Hypothetical Document Embeddings) for vocabulary mismatch resolution
- `query-decomposition` - Multi-concept query handling with parallel retrieval and RRF fusion
- `reranking-patterns` - Cross-encoder and LLM-based reranking for search precision
- `contextual-retrieval` - Anthropic's context-prepending technique for improved RAG
- `langgraph-functional` - New @entrypoint/@task decorator API for modern LangGraph workflows
- `mcp-server-building` - Building MCP servers for Claude extensibility

**Enhanced Existing Skills**
- `embeddings` - Added late chunking, batch API patterns, embedding cache, Matryoshka dimensions
- `rag-retrieval` - Added HyDE integration, agentic RAG, Self-RAG, Corrective RAG (CRAG) patterns

**Subagent Integration**
- `data-pipeline-engineer` agent now uses: hyde-retrieval, query-decomposition, reranking-patterns, contextual-retrieval
- `workflow-architect` agent now uses: langgraph-functional
- `backend-system-architect` agent now uses: mcp-server-building

### Changed

- Skills count increased from 72 to 78
- Updated agent markdown files with new skill references
- All new skills follow slim Tier 1/Tier 2 format with proper schema validation

- capabilities.json files now include required `$schema`, `description`, and `capabilities` fields
- SKILL.md files now include required "When to Use" sections

---

## [4.6.2] - 2026-01-09

### Added

**Claude Code 2.1.2 Support**
- `agent_type` field parsing in `startup-dispatcher.sh`
- Agent-aware context initialization in `session-context-loader.sh`
- Agent type logging to session state in `session-env-setup.sh`

**Comprehensive Hook Tests (138 new tests)**
- `test-lifecycle-hooks.sh` - 57 tests for 7 lifecycle hooks
- `test-file-lock-hooks.sh` - 31 tests for 6 file lock hooks
- `test-permission-posttool-hooks.sh` - 50 tests for 5 hooks (permissions, posttool, input-mod)

### Changed

- Claude Code requirement updated from `>=2.1.0` to `>=2.1.2`
- Migrated deprecated `shared-context.json` → Context 2.0 (`session/state.json`)

- Placeholder values (XXX KB) in `evidence-verification/SKILL.md` now show realistic sizes (245 KB, 18 KB)

---

## [4.6.1] - 2026-01-08

### Added

**Comprehensive CI/CD Pipeline**
- GitHub Actions workflow with 5-stage pipeline (lint → unit → security → integration → performance)
- Matrix testing on Ubuntu and macOS
- Zero tolerance policy for security test failures

**New Test Suites**
- `tests/ci/lint.sh` - Static analysis: JSON validity, shellcheck, schema validation
- `tests/e2e/test-progressive-loading.sh` - Skill discovery and loading validation
- `tests/e2e/test-agent-lifecycle.sh` - Agent spawning and handoff testing
- `tests/e2e/test-coordination-e2e.sh` - Multi-worktree coordination system tests
- `tests/performance/test-token-budget.sh` - Token budget analysis and recommendations
- `tests/security/test-unicode-attacks.sh` - Unicode/homoglyph/BIDI attack prevention
- `tests/security/test-symlink-attacks.sh` - Symlink and TOCTOU attack prevention

**Test Runner v3.0**
- `tests/run-all-tests.sh` updated with all new test categories
- 19 test suites, organized by layer (lint, unit, security, integration, e2e, performance)

### Changed

- Skills count increased from 68 to 72
- Portable shell scripts (macOS + Linux compatibility)

### Removed

**Cleanup of AI Slop Documentation**
- Removed `.claude/archive/` - deprecated systems and docs
- Removed `.claude/docs/` - AI-generated design documents
- Removed `.claude/context/patterns/` - redundant with skills
- Removed `.claude/workflows/` - orphaned markdown files
- Removed 16 redundant instruction files (kept only `context-initialization.md`)
- Removed root slop files: `SECURITY_TEST_INDEX.md`, `HOOK_SECURITY_AUDIT.md`, `SKILL.md`
- Removed `tests/COMPREHENSIVE-TEST-STRATEGY.md` - replaced by actual tests


## [4.5.0] - 2026-01-08

### Added

#### Claude Code 2.1.1 Full Feature Utilization

This release fully leverages Claude Code 2.1.1 capabilities, upgrading the plugin from 6.5/10 to 9.5/10 maturity.

**Engine Requirement**
- Plugin now requires Claude Code `>=2.1.0`

**SubagentStart Hooks** (NEW hook type)
- `subagent-resource-allocator.sh` - Pre-allocates context resources before subagent spawn
- `subagent-context-stager.sh` - Stages relevant context based on task type

**SubagentStop Hooks** (NEW hook type)
- `subagent-completion-tracker.sh` - Tracks subagent completion metrics
- `subagent-quality-gate.sh` - Validates subagent output quality
- `coverage-threshold-gate.sh` - Enforces test coverage thresholds

**Input Modification Hooks** (NEW hook capability)
- `path-normalizer.sh` - Normalizes file paths to absolute paths for Read/Write/Edit/Glob/Grep
- `bash-defaults.sh` - Adds default timeout and prevents dangerous bash commands
- `write-headers.sh` - Adds standard file headers to new files

**Hook Chain Orchestration**
- `chain-config.json` - Centralized configuration for hook sequences
- `chain-executor.sh` - Sequential execution with timeout/retry support
- 4 predefined chains: error_handling, security_validation, test_workflow, code_quality

**Agent-Level Hooks** (all 20 agents)
- `output-validator.sh` - Validates agent output quality and completeness
- `context-publisher.sh` - Publishes agent decisions to shared context
- `handoff-preparer.sh` - Prepares context for next agent in pipeline (10 pipeline agents)

**Skill-Level Hooks** (all 68 skills)
- Testing skills: `test-runner.sh`, `coverage-check.sh`
- Security skills: `security-summary.sh`, `redact-secrets.sh`
- Code review skills: `review-summary-generator.sh`
- Architecture skills: `design-decision-saver.sh`
- Database skills: `migration-validator.sh`
- LLM/AI skills: `eval-metrics-collector.sh`
- Evidence skills: `evidence-collector.sh`

**MCP Tool Annotations**
- Added metadata for 6 tool patterns with safety, cost, and category flags
- Wildcard permission syntax: `mcp__server__*` for bulk tool approval
- Auto-approve and require-confirmation lists
- Fallback configuration for context7 and sequential-thinking
- Notification settings with refresh intervals

**Model Fallback Chains**
- 15+ complex skills now have `model-alternatives` for resilience
- Primary: opus → Fallback: sonnet → Last resort: haiku

**Workflow Auto-Triggers** (all 5 workflows)
- Keyword detection with 0.8 confidence threshold
- Auto-launch capability for matching patterns
- Keywords for: frontend-2026-compliance, api-design-compliance, security-audit-workflow, data-pipeline-workflow, ai-integration-workflow

**Dependency Graph**
- 42 skill-to-agent mappings across 8 domains
- 8 agent pipeline sequences defined:
  - product-thinking: market-intelligence → product-strategist → prioritization-analyst
  - full-stack-feature: requirements → backend → database → frontend → test → review
  - security-audit: security-auditor → code-quality-reviewer
  - ai-integration: llm-integrator → workflow-architect → data-pipeline-engineer
  - database-feature: database-engineer → backend-system-architect
  - ui-feature: rapid-ui-designer → frontend-ui-developer
  - bug-investigation: debug-investigator → test-generator
  - system-review: backend-system-architect → metrics-architect

**Security Manifest**
- Required permissions: read_project, write_project, execute_bash, call_llm
- Denied operations: delete_outside_project, execute_system_commands, network_without_approval
- 11 sensitive file patterns protected (*.env, *.pem, *.key, *credentials*, etc.)

**Tool Restrictions** (8 security-critical skills)
- `security-scanning`: Read, Grep, Glob, Bash (controlled)
- `owasp-top-10`: Read, Grep, Glob (read-only)
- `input-validation`: Read, Grep, Glob, Write, Edit
- `defense-in-depth`: Read, Grep, Glob (read-only)
- `auth-patterns`: Read, Grep, Glob, Write, Edit, Bash (full)
- `golden-dataset-management`: Read, Grep, Glob, Bash
- `golden-dataset-validation`: Read, Grep, Glob (read-only)
- `evidence-verification`: Read, Grep, Glob, Bash

### Changed

- `plugin.json` version bumped to 4.5.0
- Engine requirement updated from `>=1.0.0` to `>=2.1.0`
- All workflows now have `auto_trigger` configuration
- All agents now have Stop hooks for validation and context publishing
- All skills now have PostToolUse and Stop event hooks

- Agent pipeline sequencing now properly chains 10 pipeline agents
- MCP tool permissions now use proper wildcard syntax
- Hook execution order guaranteed through chain orchestration

---

## [4.4.1] - 2026-01-08

#### Version Consistency
- Updated `plugin.json` version from 1.0.0 to 4.4.1
- Updated `marketplace.json` version from 1.0.0 to 4.4.1
- Renamed `motion-animation-patterns/skill.md` to `SKILL.md` for consistency with other skills

#### Missing Metadata
- Added `capabilities.json` for `motion-animation-patterns` skill
- Added `capabilities.json` for `langgraph-human-in-loop` skill

### Added

#### MCP Configuration
- Added `.mcp.json` for MCP project-scope server configuration (Claude Code 2025+ feature)
- Pre-configured servers: context7, sequential-thinking, memory, playwright

---

## [4.4.0] - 2026-01-06

### Added

#### New Skills
- `motion-animation-patterns` - Motion (Framer Motion) animations, page transitions, modal effects, stagger lists, RTL support
- `i18n-date-patterns` - Internationalization, date formatting with dayjs, useFormatting hook, ICU MessageFormat, Trans component

#### Enhanced Skills (expanded with capabilities.json, checklists, examples)
- `e2e-testing` - Full Playwright 1.57+ patterns with AI-assisted test generation
- `auth-patterns` - JWT, OAuth, session management, password security
- `llm-testing` - LLM application testing, mocking, async timeouts
- `embeddings` - Embedding models, chunking strategies, similarity search
- `function-calling` - Tool use patterns for OpenAI, Anthropic, Ollama
- `input-validation` - Zod v4, sanitization, injection prevention
- `msw-mocking` - Mock Service Worker patterns for React testing
- `vcr-http-recording` - VCR.py for Python HTTP recording
- `langgraph-checkpoints` - Fault-tolerant checkpointing and recovery
- `langgraph-state` - State management and persistence
- `langgraph-parallel` - Fan-out/fan-in parallel execution
- `langgraph-routing` - Semantic routing and conditional branching
- `langgraph-supervisor` - Supervisor-worker orchestration
- `langgraph-human-in-loop` - Human approval and intervention
- `llm-evaluation` - Quality scoring, LLM-as-judge patterns
- `llm-streaming` - Token streaming, SSE patterns
- `multi-agent-orchestration` - Agent coordination and synthesis
- `test-data-management` - Test fixtures and factories
- `performance-testing` - k6 and Locust load testing
- `cache-cost-tracking` - LLM cost tracking and optimization
- `llm-safety-patterns` - Safety checklists and context separation

### Changed

#### Agent Updates
- `frontend-ui-developer` - Added Motion animations, i18n date patterns, Tailwind @theme utilities
- `rapid-ui-designer` - Added animation specs with Motion presets
- `code-quality-reviewer` - Added i18n date pattern checking (v3.8.0)
- `design-system-starter` - Added animation-tokens to provides

#### Workflow Updates
- `frontend-2026-compliance` - Added Motion and i18n skills, updated checklist with skeleton pulse, AnimatePresence, i18n dates

#### Pattern Updates
- New `frontend-animation-patterns.md` context pattern

### Fixed
- Removed project-specific references, now uses generic "OrchestKit Team" branding

---

## [1.0.0] - 2025-01-01

### Initial Release

The first public release of the OrchestKit plugin for Claude Code, providing comprehensive AI-native development capabilities.

### Added

#### Skills (33 total)

**AI Development**
- `ai-native-development` - RAG pipelines, embeddings, vector databases, agentic workflows
- `langgraph-workflows` - Multi-agent workflows with LangGraph 1.0
- `llm-caching-patterns` - Multi-level caching strategies for LLM applications
- `llm-safety-patterns` - Secure LLM integration patterns
- `langfuse-observability` - LLM observability with self-hosted Langfuse
- `pgvector-search` - Production hybrid search with PGVector + BM25
- `golden-dataset-curation` - Quality criteria for golden dataset entries
- `golden-dataset-management` - Backup, restore, and validate golden datasets
- `golden-dataset-validation` - Validation rules and schema checks

**Backend Development**
- `api-design-framework` - REST, GraphQL, and gRPC API design patterns
- `database-schema-designer` - Database schema design for SQL and NoSQL
- `streaming-api-patterns` - Real-time data streaming with SSE and WebSockets
- `type-safety-validation` - End-to-end type safety with Zod, tRPC, Prisma

**Frontend Development**
- `react-server-components-framework` - React Server Components with Next.js 15
- `design-system-starter` - Design systems with tokens and accessibility
- `performance-optimization` - Full-stack performance analysis and optimization

**DevOps & Infrastructure**
- `devops-deployment` - CI/CD pipelines, containerization, Kubernetes
- `edge-computing-patterns` - Edge runtime deployment patterns
- `observability-monitoring` - Structured logging, metrics, distributed tracing

**Security**
- `security-checklist` - OWASP Top 10 mitigations and security audits
- `defense-in-depth` - Multi-layer security architecture for AI systems

**Architecture & Design**
- `architecture-decision-record` - ADR templates following Nygard format
- `system-design-interrogation` - Systematic questioning for system design
- `brainstorming` - Structured Socratic questioning for idea development

**Testing & Quality**
- `testing-strategy-builder` - Comprehensive testing strategies
- `code-review-playbook` - Structured review processes and checklists
- `webapp-testing` - Playwright testing with autonomous test agents

**Workflow & Tools**
- `github-cli` - GitHub CLI mastery for issues, PRs, and automation
- `ascii-visualizer` - ASCII art visualizations for architectures
- `browser-content-capture` - Capture content from JS-rendered pages

#### Commands (10 total)

- `/implement` - Full-power feature implementation with parallel subagents
- `/brainstorm` - Multi-perspective idea exploration
- `/explore` - Deep codebase exploration with specialized agents
- `/run-tests` - Comprehensive test execution with parallel analysis
- `/verify` - Feature verification with highest standards
- `/fix-issue` - Fix GitHub issues with parallel analysis
- `/review-pr` - Comprehensive PR review with code quality agents
- `/create-pr` - Create PR with validation and auto-generated description
- `/commit` - Smart commit with validation and auto-generated message
- `/add-golden` - Curate and add documents to golden dataset

#### Agents (14 total)

- `implementation-agent` - Feature implementation specialist
- `testing-agent` - Test creation and execution
- `review-agent` - Code review and quality analysis
- `security-agent` - Security vulnerability detection
- `performance-agent` - Performance optimization analysis
- `documentation-agent` - Documentation generation
- `refactoring-agent` - Code refactoring specialist
- `debugging-agent` - Bug investigation and resolution
- `architecture-agent` - System design and architecture
- `database-agent` - Database schema and query optimization
- `frontend-agent` - React and UI development
- `backend-agent` - API and service development
- `devops-agent` - CI/CD and infrastructure
- `observability-agent` - Logging, metrics, and tracing

### Security

- All hook scripts hardened with `set -euo pipefail`
- No use of `eval` or dynamic code execution
- No network calls in hooks
- All user input properly escaped and validated
- Common utilities extracted to `common.sh` for consistent security patterns

### Documentation

- Comprehensive README with installation and usage instructions
- CONTRIBUTING.md with guidelines for adding skills, commands, and agents
- MIT License for open source distribution
- This CHANGELOG for tracking version history

---

## Future Releases

Planned enhancements for future versions:

- Additional language-specific skills (Rust, Go, Python advanced patterns)
- Integration with more observability platforms
- Enhanced testing automation capabilities
- Community-contributed skills and agents

[1.0.0]: https://github.com/OrchestKit/claude-plugin/releases/tag/v1.0.0