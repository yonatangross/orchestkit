# CLAUDE.md

This document provides essential context for Claude Code when working with the SkillForge Claude Plugin project.

## Project Overview

**SkillForge Complete** is a comprehensive AI-assisted development toolkit that transforms Claude Code into a full-stack development powerhouse. It provides:

- **92 skills**: Reusable knowledge modules in 10 category-based directories (CC 2.1.6 nested structure)
- **20 agents**: Specialized AI personas with native skill injection (CC 2.1.6)
- **12 commands**: Pre-configured workflows for common development tasks
- **95 hooks**: Lifecycle automation for sessions, tools, permissions, and quality gates
- **Progressive Loading**: Semantic discovery system that loads skills on-demand based on task context
- **Context Window HUD**: Real-time context usage monitoring with CC 2.1.6 statusline integration

**Purpose**: Enable AI-assisted development of production-grade applications with built-in best practices, security patterns, and quality gates.

**Target Users**: Development teams building modern full-stack applications with AI/ML capabilities, particularly those using FastAPI, React 19, LangGraph, and PostgreSQL.

---

## Key Directories

```
.claude/
├── agents/              # 20 specialized AI agent personas (CC 2.1.6 native format)
├── commands/            # 11 pre-configured development workflows
├── context/             # Session state, knowledge base, and shared context
├── coordination/        # Multi-worktree coordination system (locks, registries)
├── hooks/               # 95 lifecycle hooks for automation
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

skills/                  # 92 skills in CC 2.1.6 nested structure
├── ai-llm/.claude/skills/       # (19) RAG, embeddings, agents, caching
├── langgraph/.claude/skills/    # (7)  LangGraph workflows
├── backend/.claude/skills/      # (15) FastAPI, architecture, databases
├── frontend/.claude/skills/     # (6)  React 19, design systems
├── testing/.claude/skills/      # (9)  Unit, integration, E2E, mocking
├── security/.claude/skills/     # (5)  OWASP, auth, validation
├── devops/.claude/skills/       # (4)  CI/CD, observability
├── workflows/.claude/skills/    # (13) Git, PR, implementation, HUD
├── quality/.claude/skills/      # (8)  Quality gates, reviews
└── context/.claude/skills/      # (6)  Context management, planning

# Each skill follows progressive loading:
skills/<category>/.claude/skills/<skill-name>/
├── capabilities.json    # Tier 1: Task matching metadata (~100 tokens)
├── SKILL.md            # Tier 2: Overview and patterns (~500 tokens)
├── references/*.md     # Tier 3: Specific implementations (~200 tokens)
└── templates/*         # Tier 4: Code generation templates (~300 tokens)

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
- **Claude Code**: >= 2.1.6 (CC 2.1.6 nested skills, native agent skills, context HUD, security fixes)
- **MCP Integration**: Optional - Context7, Sequential Thinking, Memory, Playwright (configure via /skf:configure)

### Expected Application Stack (Skills Support)
- **Backend**: FastAPI + Python 3.11+ + SQLAlchemy 2.0 + PostgreSQL 18 + pgvector
- **Frontend**: React 19 + TypeScript 5.0+ + Vite + Zod + MSW
- **AI/ML**: LangGraph 1.0 + OpenAI/Anthropic SDKs + Langfuse
- **Infrastructure**: Docker + GitHub Actions

### Progressive Loading System
- **Tier 1 (Discovery)**: `capabilities.json` (100-110 tokens) - semantic matching
- **Tier 2 (Overview)**: `SKILL.md` (300-800 tokens) - patterns and best practices
- **Tier 3 (Specific)**: `references/*.md` (90-300 tokens) - implementation guides
- **Tier 4 (Generate)**: `templates/*` (150-400 tokens) - boilerplate generation

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
ls ~/.claude/plugins/skillforge/skills/*/.claude/skills/
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
./tests/skills/structure/test-capabilities-json.sh
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
# Validate new skill structure (nested path)
./bin/validate-skill.sh skills/backend/.claude/skills/my-new-skill

# Test progressive loading
./bin/test-progressive-load.sh my-skill-id

# Generate skill from template (automatically places in category)
./bin/generate-skill.sh --name "My Skill" --category backend
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
- `capabilities.schema.json`: Skill capabilities
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

**Example** (with CC 2.1.6 nested paths):
```bash
# Step 1: Read capabilities.json to check if skill is relevant
Read skills/backend/.claude/skills/api-design-framework/capabilities.json

# Step 2: If relevant, read SKILL.md for patterns
Read skills/backend/.claude/skills/api-design-framework/SKILL.md

# Step 3: If implementing specific pattern, read reference
Read skills/backend/.claude/skills/api-design-framework/references/rest-pagination.md

# Step 4: If generating code, use template
Read skills/backend/.claude/skills/api-design-framework/templates/endpoint-template.py
```

### 2. Hook Dispatcher Pattern
All hooks use consolidated dispatchers that output colored ANSI:
- `pretool/bash-dispatcher.sh` → calls individual bash hooks
- `pretool/write-dispatcher.sh` → calls write/edit hooks
- `posttool/dispatcher.sh` → calls audit, error tracking, metrics

**Never bypass dispatchers** - they provide proper sequencing and error handling.

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
- **DO NOT** add skills without `capabilities.json` (Tier 1 Discovery)
- **DO NOT** modify `plugin.json` without validating against schema
- **DO NOT** create hooks without adding to `.claude/settings.json`

### Testing Shortcuts
- **DO NOT** skip security tests before commits
- **DO NOT** merge PRs without passing all quality gates
- **DO NOT** disable coverage thresholds without documented justification

---

## Common Workflows

### 1. Adding a New Skill
```bash
# Step 1: Generate from template (automatically places in nested structure)
./bin/generate-skill.sh --name "My Skill" --category backend

# Step 2: Create progressive loading files
mkdir -p skills/backend/.claude/skills/my-skill/references
touch skills/backend/.claude/skills/my-skill/capabilities.json  # Tier 1
touch skills/backend/.claude/skills/my-skill/SKILL.md          # Tier 2
touch skills/backend/.claude/skills/my-skill/references/impl.md # Tier 3

# Step 3: Update capabilities.json $schema path
# Use: "../../../../../.claude/schemas/skill-capabilities.schema.json"

# Step 4: Validate
./tests/schemas/validate-all.sh
./bin/validate-skill.sh skills/backend/.claude/skills/my-skill

# Step 5: Test discovery
./bin/test-progressive-load.sh my-skill
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
skills/<category>/.claude/skills/<skill-name>/

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

# List available skill categories
ls skills/

# List skills in a category
ls skills/backend/.claude/skills/

# List available agents
ls agents/
```

---

## Skill Categories (CC 2.1.6)

| Category | Skills | Description |
|----------|--------|-------------|
| `ai-llm` | 19 | RAG, embeddings, agents, caching, observability |
| `langgraph` | 7 | State, routing, parallel, checkpoints, human-in-loop |
| `backend` | 15 | FastAPI, architecture, databases, APIs, resilience |
| `frontend` | 6 | React 19, design systems, animations, i18n |
| `testing` | 9 | Unit, integration, E2E, mocking, data management |
| `security` | 5 | OWASP, auth, validation, defense-in-depth |
| `devops` | 4 | CI/CD, observability, GitHub CLI |
| `workflows` | 13 | Git, PR, implementation, exploration, HUD |
| `quality` | 8 | Quality gates, reviews, golden datasets |
| `context` | 6 | Compression, engineering, brainstorming, planning |

---

## Version Information

- **Current Version**: 4.10.0 (as of 2026-01-13)
- **Claude Code Requirement**: >= 2.1.6
- **Skills Structure**: CC 2.1.6 nested (.claude/skills/ pattern)
- **Agent Format**: CC 2.1.6 native (skills array in frontmatter)
- **Context Protocol**: 2.0.0 (tiered, attention-aware)
- **Coordination System**: Multi-worktree support added in v4.6.0
- **Security Testing**: Comprehensive 8-layer framework added in v4.5.1

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
2. **Skill not loading**: Verify `capabilities.json` exists at nested path (Tier 1)
3. **Permission denied**: Check auto-approval hooks in `hooks/permission/`
4. **Lock timeout**: Run `.claude/coordination/lib/coordination.sh cleanup`
5. **Context budget exceeded**: Use progressive loading, don't load entire directories
6. **Agent skills not injected**: Verify agent uses CC 2.1.6 frontmatter with `skills:` array

---

**Last Updated**: 2026-01-13 (v4.10.0 - CC 2.1.6 Native Agent Skills)