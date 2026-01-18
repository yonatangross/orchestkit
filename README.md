<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

# SkillForge Claude Plugin

**Comprehensive AI-Assisted Development Toolkit**

*Transform Claude Code into a full-stack development powerhouse*

[![Claude Code](https://img.shields.io/badge/Claude_Code-≥2.1.11-7C3AED?style=flat-square&logo=anthropic)](https://claude.ai/claude-code)
[![Skills](https://img.shields.io/badge/Skills-135-blue?style=flat-square)](./skills)
[![Agents](https://img.shields.io/badge/Agents-27-green?style=flat-square)](./agents)
[![Hooks](https://img.shields.io/badge/Hooks-128-orange?style=flat-square)](./hooks)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](./LICENSE)

[Features](#features) • [Quick Start](#quick-start) • [Skills](#skill-system) • [Agents](#agents) • [Hooks](#hooks) • [Commands](#commands)

</div>

---

## Overview

SkillForge Complete is a production-ready plugin for Claude Code that provides:

- **135 Skills** (20 user-invocable + 115 internal) with progressive loading (saves ~70% context tokens)
- **27 Specialized Agents** with native CC 2.1.6+ skill injection
- **128 Registered Hooks** for lifecycle automation, security gates, and quality enforcement
- **Context Window HUD** with real-time usage monitoring
- **Multi-Instance Coordination** for parallel Claude Code sessions

Built for teams building modern full-stack applications with FastAPI, React 19, LangGraph, and PostgreSQL.

---

## What's New in v4.22.0 (Context Pruning Advisor)

- **Context Pruning Advisor Hook** (#126): Intelligent context management when usage exceeds 70%
- 3D scoring algorithm: recency (time since access), frequency (session count), relevance (keyword overlap)
- Recommends top 5 pruning candidates via CC 2.1.9 additionalContext
- Critical warning at 95% usage with compression suggestions
- **Total**: 135 skills, 27 agents, 130 hooks

### Previous (v4.21.0 - Skill Auto-Suggest)

- **Skill Auto-Suggest Hook** (#123): Proactive skill suggestions based on prompt analysis
- Analyzes prompts for 100+ keywords across API, database, auth, testing, frontend, AI/LLM, DevOps domains

### Previous (v4.20.0 - Memory Fabric & Frontend Skills)

- **Memory Fabric v2.1**: Graph-first architecture with optional Mem0 cloud enhancement
- **10 Frontend Skills Expanded**: zustand-patterns, tanstack-query-advanced, form-state-patterns, core-web-vitals, image-optimization, render-optimization, shadcn-patterns, radix-primitives, vite-advanced, biome-linting
- **2 New Commands**: `/load-context` (auto-load memories), `/mem0-sync` (sync to Mem0)

### Previous (v4.19.0 - CC 2.1.11 Setup Hooks)

- **CC 2.1.11 Setup Hooks**: `--init`, `--init-only`, `--maintenance` CLI support
- **Automatic Pattern Extraction**: Auto-extracts patterns from commits, tests, builds
- **Total**: 129 skills, 27 agents, 124 hooks

### Previous (v4.18.0 - Skills & Agents Expansion)

- **10 New Skills**: Event-driven, Database, Accessibility categories
- **5 New Agents**: accessibility-specialist, ci-cd-engineer, deployment-manager, etc.

### Previous (v4.17.2 - Commands Autocomplete Fix)

- **Commands Autocomplete**: Added `commands/` directory with 17 command files - commands now appear when typing `/skf:`
- **Test Coverage**: New `tests/commands/test-commands-structure.sh` validates commands match user-invocable skills
- **Bug Fix**: Resolved #68 - User-invocable skills were missing from autocomplete

### Previous (v4.17.1 - Documentation Update)

- **CC 2.1.9 Integration**: `additionalContext` for pre-tool guidance, `auto:N` MCP thresholds, `plansDirectory` support
- **17 User-Invocable Skills**: Commands available via `/skf:*` menu (commit, review-pr, explore, implement, verify, etc.)
- **80 Internal Knowledge Skills**: Auto-loaded based on task context (not directly invocable)

### Previous (v4.16.0 - CC 2.1.9 Features)

- **additionalContext Support**: Hooks can inject contextual guidance before tool execution
- **MCP Auto-Enable Thresholds**: `auto:N` syntax for context-aware MCP server activation
- **Plans Directory**: Custom plans directory configuration support

### Previous (v4.15.2 - Comprehensive CI & Agent Fixes)

- **CI Coverage**: 88 tests in CI (was 37), 96% test coverage
- **105 Hooks**: All hooks now registered directly (zero dispatchers)
- **Agent Context**: All 20 agents have explicit `context: fork|inherit` declarations

### Previous (v4.15.0 - CC 2.1.7 Skills Migration)

- **Skills Structure**: Migrated from category-based to CC 2.1.7 native flat structure
- **Removed capabilities.json**: Skills now use SKILL.md frontmatter for discovery
- **97 Skills**: All skills at `skills/<skill-name>/`

### Previous (v4.13.0 - CC 2.1.7 Compatibility)

- **Hook Refactoring**: Removed lifecycle dispatchers, now uses CC 2.1.7 native parallel execution
- **105 Direct Hooks**: SessionStart (8), UserPromptSubmit (4), SessionEnd (4), Stop (10) registered individually
- **MCP Auto-Mode**: Tools defer when context >10% (~7200 tokens/session savings)
- **Effective Context Window**: Uses actual usable window for accurate budget tracking
- **Compound Command Security**: Validates shell operators (&&, ||, |, ;) in chained commands
- **Permission Feedback**: Logs permission decisions for security auditing
- **Skill Enhancements**: 6 skills updated with CC 2.1.7 documentation

### Previous (v4.11.1 - Agent Fixes)

- **Agent Model Fixes**: Changed 4 agents from haiku→sonnet for deeper reasoning
- **Context Modes**: Added explicit `context:` declaration to all 20 agents
- **Hook Completeness**: Added missing `handoff-preparer.sh` to 10 agents
- **CI Tests**: 7 new tests to validate agent/skill configurations

### Previous (v4.11.0 - Hook Consolidation)

- Hook Consolidation: Reduced from 44 to 23 registered hooks using dispatcher pattern
- MCP Updates: Memory Fabric v2.1 - graph-first architecture (knowledge graph PRIMARY, mem0 optional)
- Note: Dispatchers for lifecycle hooks removed in v4.13.0 (CC 2.1.7 native parallel)

### Previous (v4.10.0 - CC 2.1.6 Integration)

```
skills/     # 97 skills in flat CC 2.1.7 structure
├── api-design-framework/
├── auth-patterns/
├── database-schema-designer/
├── react-server-components/
├── ... (97 skills total)
```

## Quick Start

### Installation

```bash
# From Claude Code marketplace (recommended)
/plugin marketplace add yonatangross/skillforge-claude-plugin
/plugin install skf

# Or clone manually
git clone https://github.com/yonatangross/skillforge-claude-plugin ~/.claude/plugins/skillforge
```

### First Session

After installation, the plugin automatically:

1. **Loads Context**: Session state, identity, and knowledge index
2. **Initializes Hooks**: Security gates, quality enforcement, metrics
3. **Enables Skills**: Available on-demand via semantic discovery

Try these to explore:

```markdown
"What skills are available for API development?"
"Help me design a database schema" (triggers backend-system-architect)
"Run /skf:doctor to check plugin health"
```

---

## Features

### Skill System

**115 skills** organized in CC 2.1.7 nested structure with 4-tier progressive loading:

| Tier | Content | Tokens | When Loaded |
|------|---------|--------|-------------|
| 2 - Overview | `SKILL.md` | ~500 | When skill is relevant |
| 3 - Specific | `references/*.md` | ~200 | When implementing pattern |
| 4 - Generate | `templates/*` | ~300 | When generating code |

**Token savings**: ~70% compared to loading entire skills upfront.

### Agents

**25 specialized agents** with native CC 2.1.6+ skill injection:

| Agent | Purpose | Model |
|-------|---------|-------|
| `backend-system-architect` | REST/GraphQL APIs, microservices | sonnet |
| `database-engineer` | PostgreSQL, pgvector, migrations | sonnet |
| `frontend-ui-developer` | React 19, TypeScript, Zod | sonnet |
| `workflow-architect` | LangGraph, multi-agent orchestration | sonnet |
| `security-auditor` | OWASP Top 10, vulnerability scanning | sonnet |
| `test-generator` | Unit/integration tests, MSW mocking | sonnet |
| `accessibility-specialist` | WCAG 2.2, ARIA, focus management | sonnet |
| `event-driven-architect` | Event sourcing, message queues | opus |
| `ci-cd-engineer` | GitHub Actions, deployment pipelines | sonnet |
| ... | See `agents/` for full list | |

### Hooks

**32 registered hooks** leveraging CC 2.1.7 native parallel execution:

| Event | Hooks | Purpose |
|-------|-------|---------|
| `SessionStart` | 8 | Context loading, coordination init |
| `UserPromptSubmit` | 4 | Context injection, memory search |
| `SessionEnd` | 4 | Cleanup, metrics, pattern sync |
| `Stop` | 10 | Auto-save, compaction, cleanup |
| `PreToolUse` | Dispatched | Security gates (branch protection, file guards) |
| `PostToolUse` | Dispatched | Audit logging, validators, metrics |
| `PermissionRequest` | 3 | Auto-approve safe operations |

### Commands

**11 pre-configured commands** for common workflows:

```bash
/skf:doctor          # Check plugin health
/skf:configure       # Configure MCP servers
/skf:claude-hud      # Setup context HUD
/skf:commit          # Guided commit flow
/skf:pr              # Create pull request
/skf:review          # Code review checklist
```

---

## Architecture

```
skillforge-claude-plugin/
├── .claude/
│   ├── agents/           # 25 agent definitions
│   ├── commands/         # 11 workflow commands
│   ├── context/          # Session state, knowledge base
│   ├── coordination/     # Multi-instance locks
│   ├── policies/         # Security policies
│   └── schemas/          # JSON schemas
├── hooks/
│   ├── lifecycle/        # SessionStart, SessionEnd hooks
│   ├── prompt/           # UserPromptSubmit hooks
│   ├── stop/             # Stop event hooks
│   ├── pretool/          # PreToolUse dispatchers (tool-based routing)
│   ├── posttool/         # PostToolUse dispatcher (file-type routing)
│   └── permission/       # Auto-approval hooks
├── skills/       # 115 skills in flat structure
│   └── <skill-name>/
│       ├── SKILL.md           # Required
│       ├── references/        # Optional
│       └── templates/         # Optional
└── tests/                # Comprehensive test suite
```

---

## Configuration

### MCP Servers (Optional)

Configure via `/skf:configure`:

- **Context7**: Up-to-date library documentation
- **Sequential Thinking**: Complex reasoning chains
- **Memory (graph)**: Knowledge graph for persistent memory (PRIMARY, zero-config)
- **Mem0 (cloud)**: Semantic search enhancement (OPTIONAL, requires MEM0_API_KEY)
- **Playwright**: Browser automation for E2E testing

### Environment Variables

```bash
CLAUDE_PROJECT_DIR      # User's project directory
CLAUDE_PLUGIN_ROOT      # Plugin installation path
CLAUDE_SESSION_ID       # Current session identifier
CLAUDE_MULTI_INSTANCE   # "1" when multi-instance mode active
```

---

## Development

### Running Tests

```bash
# All tests
./tests/run-all-tests.sh

# Security tests (critical)
./tests/security/run-security-tests.sh

# Schema validation
./tests/schemas/validate-all.sh

# Agent/skill validation
./tests/agents/test-agent-frontmatter.sh
./tests/skills/test-skill-structure.sh
```

### Adding a Skill

```bash
# Create skill directory
mkdir -p skills/my-skill

# Create SKILL.md with frontmatter
# Then validate
./tests/skills/structure/test-skill-md.sh
```

### Hook Development

```bash
# View hook logs
tail -f hooks/logs/hooks.log

# Test specific hook
echo '{}' | bash hooks/lifecycle/session-context-loader.sh
```

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

<div align="center">

**[Documentation](./CLAUDE.md)** • **[Issues](https://github.com/yonatangross/skillforge-claude-plugin/issues)** • **[Discussions](https://github.com/yonatangross/skillforge-claude-plugin/discussions)**

</div>