# CLAUDE.md

This document provides essential context for Claude Code when working with the SkillForge Claude Plugin project.

## Project Overview

**SkillForge Complete** is a comprehensive AI-assisted development toolkit that transforms Claude Code into a full-stack development powerhouse. It provides:

- **135 skills**: Reusable knowledge modules in flat structure (including 6 git/GitHub workflow skills)
- **27 agents**: Specialized AI personas with native skill injection (CC 2.1.6)
- **20 user-invocable skills**: Pre-configured workflows (CC 2.1.3 unified skills/commands with `user-invocable: true`)
- **129 hooks**: Lifecycle automation via CC 2.1.11 Setup hooks + CC 2.1.7 native parallel execution
- **Progressive Loading**: Semantic discovery system that loads skills on-demand based on task context
- **Context Window HUD**: Real-time context usage monitoring with CC 2.1.6 statusline integration

**Purpose**: Enable AI-assisted development of production-grade applications with built-in best practices, security patterns, and quality gates.

**Target Users**: Development teams building modern full-stack applications with AI/ML capabilities, particularly those using FastAPI, React 19, LangGraph, and PostgreSQL.

---

## Key Directories

```
.claude/
├── agents/              # 25 specialized AI agent personas (CC 2.1.6 native format)
├── commands/            # User-invocable skill workflows (CC 2.1.3+ unified)
├── context/             # Session state, knowledge base, and shared context
├── coordination/        # Multi-worktree coordination system (locks, registries)
├── hooks/               # 119 lifecycle hooks for automation
│   ├── setup/           # CC 2.1.11 Setup hooks (--init, --maintenance)
│   ├── lifecycle/       # Session start/end hooks
│   ├── permission/      # Auto-approval for safe operations
│   ├── pretool/         # Pre-execution validation (bash, write, skill, MCP)
│   ├── posttool/        # Post-execution logging and metrics
│   ├── prompt/          # Prompt enhancement and context injection
│   ├── notification/    # Desktop and sound notifications
│   └── stop/            # Conversation stop handlers
├── instructions/        # Initialization and onboarding guides
├── policies/            # Security policies and compliance rules
├── schemas/             # JSON schemas for validation
├── scripts/             # Helper utilities (coordination, metrics, validation)
├── templates/           # Shared templates (ADR, commits, PRs)
└── workflows/           # Multi-agent workflow orchestrations

# Skills use CC 2.1.7 native flat structure (135 skills):
skills/<skill-name>/
├── SKILL.md            # Required: Overview and patterns (~500 tokens)
├── references/         # Optional: Specific implementations (~200 tokens)
├── templates/          # Optional: Code generation templates (~300 tokens)
└── checklists/         # Optional: Implementation checklists

tests/
├── fixtures/            # Test data and golden datasets
├── integration/         # Integration test suites
├── schemas/             # Schema validation tests
├── security/            # Security testing framework
└── unit/                # Unit test suites

bin/                     # CLI utilities and scripts
.github/workflows/       # CI/CD pipelines
```

---

## Tech Stack

### Core Plugin Technology
- **Language**: Bash (hooks), JSON (schemas, config), Markdown (skills, agents)
- **Claude Code**: >= 2.1.11 (CC 2.1.11 Setup hooks, CC 2.1.9 additionalContext, auto:N MCP, plansDirectory, session ID substitution)
- **MCP Integration**: Optional - Context7, Sequential Thinking, Memory, Playwright (configure via /skf:configure, auto-enable via auto:N thresholds)

### Expected Application Stack (Skills Support)
- **Backend**: FastAPI + Python 3.11+ + SQLAlchemy 2.0 + PostgreSQL 18 + pgvector
- **Frontend**: React 19 + TypeScript 5.0+ + Vite + Zod + MSW
- **AI/ML**: LangGraph 1.0 + OpenAI/Anthropic SDKs + Langfuse
- **Infrastructure**: Docker + GitHub Actions

### Skill Loading (CC 2.1.7 Native)
- **Discovery**: SKILL.md frontmatter (name, description, tags) - semantic matching
- **Overview**: SKILL.md body (300-800 tokens) - patterns and best practices
- **Specific**: `references/*.md` (90-300 tokens) - implementation guides
- **Generate**: `templates/*` (150-400 tokens) - boilerplate generation

---

## Development Commands

### Installation & Setup
```bash
# Install from marketplace
/plugin marketplace add yonatangross/skillforge-claude-plugin
/plugin install skf

# Or clone manually
git clone https://github.com/yonatangross/skillforge-claude-plugin ~/.claude/plugins/skillforge

# Verify installation - check nested structure
ls ~/.claude/plugins/skillforge/skills/
```

### Testing
```bash
# Run all tests
./tests/run-all-tests.sh

# Run security tests
./tests/security/run-security-tests.sh

# Validate schemas
./tests/schemas/validate-all.sh

# Test coordination system
./tests/integration/test-coordination.sh

# Validate nested skills structure
./tests/skills/structure/test-skill-md.sh

# Agent validation tests (added in v4.11.1)
./tests/agents/test-agent-model-selection.sh
./tests/agents/test-agent-context-modes.sh
./tests/agents/test-agent-required-hooks.sh
./tests/agents/test-agent-frontmatter.sh

# Skill validation tests (added in v4.11.1)
./tests/skills/test-skill-structure.sh
./tests/skills/test-skill-context-modes.sh
./tests/skills/test-skill-references.sh
```

### Hook Management
```bash
# View hook logs
tail -f hooks/logs/pretool-bash.log
tail -f hooks/logs/posttool.log

# Test specific hook
hooks/pretool/bash/git-branch-protection.sh

# Clear hook logs
rm -rf hooks/logs/*.log
```

### Coordination System
```bash
# Initialize coordination
.claude/coordination/lib/coordination.sh init

# Check work status
.claude/coordination/lib/coordination.sh status

# Clean up locks
.claude/coordination/lib/coordination.sh cleanup
```

### Skill Development
```bash
# Validate all skill structures (comprehensive 10-test suite)
./tests/skills/structure/test-skill-md.sh

# Create a new skill manually
mkdir -p skills/my-new-skill/references
# Then create skills/my-new-skill/SKILL.md with required frontmatter

# Count and validate component numbers
./bin/validate-counts.sh
```

---

## Testing Approach

### Security Testing (Priority: CRITICAL)
Located in `tests/security/`, this framework validates 8 defense-in-depth layers:

1. **Permission Layer**: Hook permission controls
2. **Execution Layer**: Bash command safety (including CC 2.1.6 line continuation fix)
3. **State Layer**: Coordination locks and state integrity
4. **File Layer**: File guard protection
5. **Secret Layer**: Secret detection and masking
6. **Branch Layer**: Git branch protection
7. **Context Layer**: Context validation and budget
8. **Schema Layer**: JSON schema compliance

Run with: `./tests/security/run-security-tests.sh`

**Expected Result**: All 12 tests MUST pass. Any failure is a security violation.

### Schema Validation
All JSON files must conform to schemas in `.claude/schemas/`:
- `plugin.schema.json`: Plugin metadata
# capabilities.schema.json removed in CC 2.1.7 migration
- `context.schema.json`: Context protocol
- `coordination.schema.json`: Work registry and decision log

Run with: `./tests/schemas/validate-all.sh`

### Integration Testing
Tests multi-component workflows:
- Coordination system (locks, registries, cleanup)
- Hook dispatchers (bash, write, posttool)
- Agent workflows (product pipeline, full-stack feature)

Run with: `./tests/integration/run-integration-tests.sh`

### Unit Testing
Individual component tests for:
- Hook validation logic
- Schema parsing
- Skill discovery
- Context management

---

## Important Patterns to Follow

### 1. Progressive Loading Protocol
**ALWAYS** load skills in order:
```
Tier 1 (Discovery) → Tier 2 (Overview) → Tier 3 (Specific) → Tier 4 (Generate)
```

**Example** (CC 2.1.7 flat structure):
```bash
# Step 1: Read SKILL.md for overview and patterns
Read skills/api-design-framework/SKILL.md

# Step 2: If implementing specific pattern, read reference
Read skills/api-design-framework/references/rest-pagination.md

# Step 3: If generating code, use template
Read skills/api-design-framework/templates/endpoint-template.py
```

### 2. Hook Architecture (CC 2.1.7)
Lifecycle hooks use CC 2.1.7 native parallel execution with output aggregation:
- **SessionStart**: 8 hooks registered directly (context, env, memory, patterns, coordination)
- **UserPromptSubmit**: 4 hooks registered directly (context injection, memory search)
- **SessionEnd**: 4 hooks registered directly (cleanup, metrics, sync)
- **Stop**: 10 hooks registered directly (auto-save, compaction, cleanup)

Tool-based hooks still use dispatchers for routing:
- `pretool/bash-dispatcher.sh` → routes to branch-protection, etc.
- `pretool/write-dispatcher.sh` → routes to file-guard, lock-check
- `posttool/dispatcher.sh` → routes by file-type to validators

**All hooks output CC 2.1.7 compliant JSON**: `{"continue":true,"suppressOutput":true}`

### 3. Coordination Protocol (Multi-Worktree)
When multiple Claude Code instances run concurrently:
```bash
# 1. Acquire lock BEFORE writing to shared files
source .claude/coordination/lib/coordination.sh
acquire_lock "decision-log"

# 2. Perform operation
echo "decision" >> .claude/coordination/decision-log.json

# 3. ALWAYS release lock
release_lock "decision-log"
```

**Critical Files** requiring coordination:
- `.claude/coordination/decision-log.json`
- `.claude/coordination/work-registry.json`
- `.claude/context/shared-context.json` (deprecated - use Context 2.0)

### 4. Agent Spawning (CC 2.1.6 Native)
Agents use CC 2.1.6 native frontmatter with automatic skill injection:

```yaml
# agents/my-agent.md
---
name: my-agent
description: What this agent does...
model: sonnet  # or opus, haiku, inherit
color: blue
tools:
  - Read
  - Write
  - Bash
skills:  # CC 2.1.6 auto-injects these at spawn time
  - api-design-framework
  - database-schema-designer
---

Agent system prompt and instructions...
```

When spawning agents:
```markdown
1. Read `agents/{agent-id}.md` to understand capabilities
2. Skills are auto-injected by CC 2.1.6 (no manual loading needed!)
3. Use Task tool with subagent_type matching the agent name
4. Validate output against agent's success criteria
```

### 5. Skill Context Modes (CC 2.1.6)
Skills can specify how they share context:

```yaml
# In SKILL.md frontmatter
context: fork     # Isolated context (default) - full separation
context: inherit  # Share parent context - saves tokens for utilities
context: none     # No context management
```

**When to use each:**
- `fork`: Complex multi-step operations that shouldn't pollute main context
- `inherit`: Quick utilities (commit, configure, doctor) that benefit from shared state
- `none`: Stateless coordination tools

### 6. Context Protocol 2.0
**New Tiered Structure** (as of v4.6.0):
```
.claude/context/
├── identity.json          # START position (200 tokens)
├── session/state.json     # END position (500 tokens)
├── knowledge/             # MIDDLE position
│   ├── index.json         # Knowledge index (150 tokens)
│   ├── decisions/         # Architecture decisions (400 tokens)
│   ├── patterns/          # Code patterns (300 tokens)
│   └── blockers/          # Known issues (150 tokens)
└── archive/               # Never auto-loaded
```

**Attention Positioning**:
- START: Identity, decisions, knowledge index (high attention)
- MIDDLE: Patterns, agent context (medium attention)
- END: Blockers, session state (recent context)

### 7. Git Branch Protection
**CRITICAL**: The git-branch-protection hook **blocks** commits to `dev` and `main`:
```bash
# This will FAIL:
git checkout main
git commit -m "changes"  # BLOCKED by hook

# Correct workflow:
git checkout -b feature/my-feature
git commit -m "changes"  # ALLOWED
gh pr create  # Merge via PR
```

### 8. Quality Gates
Subagent completion triggers quality gates:
- Test coverage >= 70% (configurable)
- Security scans pass
- Schema validation passes
- No TODO/FIXME in critical paths

Configure in `hooks/subagent-stop/subagent-quality-gate.sh`

### 9. Context Window Monitoring (CC 2.1.6)
Use the statusline to monitor context usage:
```
[CTX: 45%] ████████░░░░░░░░ - GREEN: Plenty of room
[CTX: 72%] ██████████████░░ - YELLOW: Watch usage
[CTX: 89%] █████████████████ - ORANGE: Consider compacting
[CTX: 97%] ██████████████████ - RED: COMPACT NOW
```

Use `/skf:claude-hud` to configure statusline display.

### 10. Automatic Pattern Extraction (#48, #49)
The plugin automatically extracts and learns from development patterns without manual intervention:

**Three-Hook Pipeline:**
1. **pattern-extractor.sh** (PostToolUse/Bash): Extracts patterns from commits, tests, builds, PR merges
2. **antipattern-warning.sh** (UserPromptSubmit): Detects known anti-patterns and injects warnings via additionalContext
3. **session-patterns.sh** (Stop): Persists patterns to `.claude/feedback/learned-patterns.json`

**What Gets Extracted:**
- Git commits: Technology tags (JWT, cursor-pagination, etc.), categories
- Test results: Pass/fail outcomes with framework detection
- Build results: Success/failure with tool detection
- PR merges: Decision records

**Anti-Pattern Detection (7 built-in):**
- Offset pagination → cursor-based pagination
- Manual JWT validation → established libraries
- Plaintext passwords → bcrypt/argon2/scrypt
- Global state → dependency injection
- Synchronous file I/O → async operations
- N+1 queries → eager loading/batch queries
- Polling for real-time → SSE/WebSocket

**Storage Locations:**
```
.claude/feedback/
├── patterns-queue.json      # Temporary queue during session
└── learned-patterns.json    # Persistent pattern storage
```

**No manual commands required** - all extraction and warnings happen automatically via hooks.

---

## What NOT to Do

### File Operations
- **DO NOT** modify files outside `.claude/` without explicit user request
- **DO NOT** bypass file-guard.sh by using sudo or alternative paths
- **DO NOT** delete `.claude/coordination/` files (multi-worktree state)
- **DO NOT** commit secrets (`.env`, `*.pem`, `*credentials*`, `*secret*`)

### Hook Circumvention
- **DO NOT** use `--no-verify` flag on git commands (bypasses hooks)
- **DO NOT** modify hook files without testing in `tests/security/`
- **DO NOT** disable hooks in `.claude/settings.json` without security review
- **DO NOT** use line continuation (`\`) to bypass command validation (CC 2.1.6 fix)

### Context Management
- **DO NOT** exceed context budget (2200 tokens total)
- **DO NOT** load entire skill directories (use progressive loading)
- **DO NOT** write to `shared-context.json` (deprecated - use Context 2.0)

### Agent Boundaries
- **DO NOT** use backend-system-architect for frontend code
- **DO NOT** use workflow-architect for API design (that's backend-system-architect)
- **DO NOT** spawn agents without reading their agent markdown first

### Security Violations
- **DO NOT** auto-approve writes outside `$CLAUDE_PROJECT_DIR`
- **DO NOT** execute unvalidated bash commands (use allowlist patterns)
- **DO NOT** bypass permission hooks
- **DO NOT** commit to protected branches (dev, main)

### Schema Compliance
- **DO NOT** add skills without `SKILL.md` with valid frontmatter
- **DO NOT** modify `plugin.json` without validating against schema
- **DO NOT** create hooks without adding to `.claude/settings.json`

### Testing Shortcuts
- **DO NOT** skip security tests before commits
- **DO NOT** merge PRs without passing all quality gates
- **DO NOT** disable coverage thresholds without documented justification

---

## Common Workflows

### 1. Adding a New Skill (CC 2.1.7)
```bash
# Step 1: Create skill directory
mkdir -p skills/my-skill/references

# Step 2: Create SKILL.md (required)
cat > skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: Brief description of what this skill provides
tags: [keyword1, keyword2, keyword3]
---

# My Skill

Brief overview...

## When to Use
- Use case 1
- Use case 2

## Key Patterns
...
EOF

# Step 3: Add references (optional)
touch skills/my-skill/references/impl.md

# Step 4: Validate
./tests/skills/structure/test-skill-md.sh
```

### 2. Creating a New Agent (CC 2.1.6 Format)
```bash
# Step 1: Create agent markdown with CC 2.1.6 native frontmatter
cat > agents/my-agent.md << 'EOF'
---
name: my-agent
description: What this agent does and when to use it
model: sonnet
color: cyan
tools:
  - Read
  - Write
  - Bash
  - Grep
skills:
  - skill-one
  - skill-two
  - skill-three
---

## Directive
Clear instruction for what this agent does.

## Auto Mode
Activates for: keyword1, keyword2, pattern

## Concrete Objectives
1. First objective
2. Second objective

## Task Boundaries
**DO:** List what this agent should do
**DON'T:** List what other agents handle
EOF

# Step 2: Test agent spawning
# Use Task tool with subagent_type: "my-agent"

# Step 3: Validate agent loads skills correctly
# CC 2.1.6 automatically injects skills from frontmatter
```

### 3. Implementing a Security Hook
```bash
# Step 1: Create hook file
cat > hooks/pretool/bash/my-security-hook.sh <<EOF
#!/usr/bin/env bash
# Security hook implementation
exit 0  # 0=approve, 1=reject
EOF
chmod +x hooks/pretool/bash/my-security-hook.sh

# Step 2: Add to bash-dispatcher.sh
# Source and call hook in dispatcher

# Step 3: Write test
cat > tests/security/test-my-hook.sh

# Step 4: Run security tests
./tests/security/run-security-tests.sh

# Step 5: Update .claude/settings.json if needed
```

### 4. Using Workflows
```bash
# Auto-triggered workflows (no manual invocation needed):
# - Product Thinking Pipeline: "should we build X feature?"
# - Secure API Endpoint: "create a secure /users endpoint"
# - Full Stack Feature: "build a feature for user profiles"
# - AI Integration: "add RAG to the app"
# - Frontend 2025 Compliance: "modernize the frontend"

# Manual workflow check:
# Read plugin.json workflows array to see triggers and estimated tokens
```

---

## Quick Reference

### File Locations
```bash
# Plugin root
$CLAUDE_PROJECT_DIR/.claude/

# Hook logs
hooks/logs/

# Coordination state
.claude/coordination/work-registry.json
.claude/coordination/decision-log.json

# Context 2.0
.claude/context/identity.json
.claude/context/session/state.json

# Schemas
.claude/schemas/*.json

# Skills (CC 2.1.6 nested structure)
skills/<skill-name>/

# Agents (CC 2.1.6 native format)
agents/<agent-name>.md
```

### Environment Variables
```bash
CLAUDE_PROJECT_DIR=<path-to-user-project>
CLAUDE_PLUGIN_ROOT=<path-to-cached-plugin>  # Set when installed via /plugin install
CLAUDE_SESSION_ID=<session-uuid>
CLAUDE_AGENT_ID=<agent-id-if-subagent>
```

### Common Tasks
```bash
# Check security status
./tests/security/run-security-tests.sh

# Validate all schemas
./tests/schemas/validate-all.sh

# View recent hook activity
tail -20 hooks/logs/pretool-bash.log

# Check coordination locks
cat .claude/coordination/work-registry.json | jq '.locks'

# List available skills
ls skills/

# View a skill
cat skills/api-design-framework/SKILL.md

# List available agents
ls agents/
```

---

## Skills Overview (CC 2.1.7)

135 skills in flat structure at `skills/`. Common skill types include:

- **AI/LLM**: RAG, embeddings, agents, caching, observability (19 skills)
- **LangGraph**: State, routing, parallel, checkpoints, human-in-loop (7 skills)
- **Backend**: FastAPI, asyncio, SQLAlchemy async, connection pooling, idempotency, resilience (19 skills)
- **Frontend**: React 19, design systems, animations, i18n, Radix primitives, shadcn patterns, render optimization, Vite, Biome, Zustand, TanStack Query, forms, Core Web Vitals, image optimization (16 skills)
- **Testing**: Unit, integration, E2E, mocking, data management, a11y-testing (10 skills)
- **Security**: OWASP, auth, validation, defense-in-depth (5 skills)
- **DevOps**: CI/CD, observability, GitHub CLI (4 skills)
- **Git/GitHub**: Milestones, atomic commits, branch strategy, stacked PRs, releases, recovery (6 skills)
- **Workflows**: Git, PR, implementation, exploration, HUD (13 skills)
- **Quality**: Quality gates, reviews, golden datasets (8 skills)
- **Context**: Compression, engineering, brainstorming, planning (6 skills)
- **Event-Driven**: Event sourcing, message queues, outbox pattern (3 skills)
- **Database**: Alembic migrations, zero-downtime migrations, database versioning (3 skills)
- **Accessibility**: WCAG compliance, focus management, React ARIA patterns (3 skills)

---

## CC 2.1.9 Features

### PreToolUse additionalContext
Hooks can inject contextual guidance BEFORE tool execution using `additionalContext`:
```json
{
  "continue": true,
  "hookSpecificOutput": {
    "additionalContext": "Context injected before tool execution"
  }
}
```
Enhanced hooks: `git-branch-protection.sh`, `error-pattern-warner.sh`, `context7-tracker.sh`, `architecture-change-detector.sh`

### MCP Auto-Enable Thresholds
MCP servers use `auto:N` syntax to auto-enable based on context window percentage:
- `context7`: auto:75 (high-value docs, keep available longer)
- `sequential-thinking`: auto:60 (complex reasoning needs room)
- `memory`: auto:90 (knowledge graph - PRIMARY, preserve until compaction)
- `mem0`: auto:85 (optional cloud enhancement, less critical than graph)
- `playwright`: auto:50 (browser-heavy, disable early)

**Graph-First Architecture (v2.1):** Knowledge graph (memory) is PRIMARY and always available. Mem0 is an optional enhancement for semantic search. When context is tight, graph memory is MORE important as it preserves session context before compaction.

### Plans Directory
Configure custom plans directory in `.claude/defaults/config.json`:
```json
{
  "plansDirectory": ".claude/plans"
}
```

### Session ID Direct Substitution
Hooks use `${CLAUDE_SESSION_ID}` directly without fallback patterns (CC 2.1.9 guarantees availability).

---

## CC 2.1.11 Features

### Setup Hook Event
New hook event triggered via CLI flags for repository initialization and maintenance:

```bash
# Interactive first-run setup wizard
claude --init

# Silent setup for CI/CD (non-interactive)
claude --init-only

# Run maintenance tasks (log rotation, cleanup, migrations)
claude --maintenance
```

**Setup Hooks Architecture:**
```
hooks/setup/
├── setup-check.sh          # Entry point - fast validation (< 10ms happy path)
├── first-run-setup.sh      # Full setup + interactive wizard
├── setup-repair.sh         # Self-healing for broken installations
└── setup-maintenance.sh    # Periodic maintenance tasks
```

**Hybrid Marker File Detection:**
- Marker file (`.setup-complete`) for fast first-run detection
- Quick validation (< 50ms) for self-healing
- Automatic repair of corrupted configs, permissions, directories

**Maintenance Tasks:**
| Task | Frequency | Description |
|------|-----------|-------------|
| Log rotation | Daily | Rotate logs > 200KB |
| Stale lock cleanup | Daily | Remove locks > 24h old |
| Session archive | Daily | Archive sessions > 7 days |
| Metrics aggregation | Weekly | Aggregate usage metrics |
| Health validation | Weekly | Full component validation |

**Emergency Bypass:**
```bash
SKILLFORGE_SKIP_SETUP=1 claude  # Skip all setup hooks
```

### VSCode Plugin Enhancements
- Install count display in plugin listings
- Trust warning when installing plugins

---

## Version Information

- **Current Version**: 4.21.0 (as of 2026-01-18)
- **Claude Code Requirement**: >= 2.1.11
- **Skills Structure**: CC 2.1.7 native flat (skills/<skill>/)
- **Agent Format**: CC 2.1.6 native (skills array in frontmatter)
- **Hook Architecture**: CC 2.1.11 Setup hooks + CC 2.1.9 additionalContext + CC 2.1.7 native parallel (129 hooks)
- **Context Protocol**: 2.0.0 (tiered, attention-aware)
- **Memory Fabric**: v2.1.0 (graph-first architecture, knowledge graph PRIMARY, mem0 optional enhancement)
- **Coordination System**: Multi-worktree support added in v4.6.0
- **Security Testing**: Comprehensive 8-layer framework added in v4.5.1
- **CC 2.1.9 Integration**: additionalContext, auto:N MCP, plansDirectory (v4.16.0)
- **User-Invocable Skills**: CC 2.1.3 `user-invocable` field for 17 commands (v4.17.0)
- **Git Enforcement**: Commit message, branch naming, atomic commits, issue creation (v4.18.0)
- **CC 2.1.11 Integration**: Setup hooks (--init, --init-only, --maintenance), self-healing, maintenance automation (v4.19.0)
- **Automatic Pattern Extraction**: Hook-driven pattern learning and anti-pattern warnings (#48, #49) (v4.19.0)
- **Memory Fabric v2.1**: Graph-first architecture (v4.21.0) - knowledge graph PRIMARY, mem0 optional cloud enhancement

---

## Getting Help

### Documentation
- `README.md`: Installation and quick start
- `.claude/instructions/context-initialization.md`: Context setup
- `.claude/docs/`: Additional documentation
- `plugin.json`: Canonical reference for all plugin metadata

### Debugging
```bash
# Enable verbose hook logging
export CLAUDE_HOOK_DEBUG=1

# Check hook execution
tail -f hooks/logs/*.log

# Validate coordination state
.claude/coordination/lib/coordination.sh status

# Test schema compliance
./tests/schemas/validate-all.sh
```

### Common Issues
1. **Hook not firing**: Check `.claude/settings.json` matcher patterns
2. **Skill not loading**: Verify `SKILL.md` exists with valid frontmatter
3. **Permission denied**: Check auto-approval hooks in `hooks/permission/`
4. **Lock timeout**: Run `.claude/coordination/lib/coordination.sh cleanup`
5. **Context budget exceeded**: Use progressive loading, don't load entire directories
6. **Agent skills not injected**: Verify agent uses CC 2.1.6 frontmatter with `skills:` array

---

**Last Updated**: 2026-01-17 (v4.19.0)