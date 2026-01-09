# CLAUDE.md

This document provides essential context for Claude Code when working with the SkillForge Claude Plugin project.

## Project Overview

**SkillForge Complete** is a comprehensive AI-assisted development toolkit that transforms Claude Code into a full-stack development powerhouse. It provides:

- **78 Skills**: Reusable knowledge modules covering AI/LLM, backend, frontend, testing, security, and DevOps
- **20 Agents**: Specialized AI personas for product thinking, system architecture, code quality, and more
- **12 Commands**: Pre-configured workflows for common development tasks
- **92 Hooks**: Lifecycle automation for sessions, tools, permissions, and quality gates
- **Progressive Loading**: Semantic discovery system that loads skills on-demand based on task context

**Purpose**: Enable AI-assisted development of production-grade applications with built-in best practices, security patterns, and quality gates.

**Target Users**: Development teams building modern full-stack applications with AI/ML capabilities, particularly those using FastAPI, React 19, LangGraph, and PostgreSQL.

---

## Key Directories

```
.claude/
├── agents/              # 20 specialized AI agent personas (product + technical)
├── commands/            # 11 pre-configured development workflows
├── context/             # Session state, knowledge base, and shared context
├── coordination/        # Multi-worktree coordination system (locks, registries)
├── hooks/               # 89 lifecycle hooks for automation
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
├── skills/              # 72 skill modules organized by category
│   ├── **/capabilities.json    # Tier 1: Task matching metadata
│   ├── **/SKILL.md            # Tier 2: Overview and patterns
│   ├── **/references/*.md     # Tier 3: Specific implementations
│   └── **/templates/*         # Tier 4: Code generation templates
├── templates/           # Shared templates (ADR, commits, PRs)
└── workflows/           # Multi-agent workflow orchestrations

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
- **Claude Code**: >= 2.1.2 (CC 2.1.2 agent_type support)
- **MCP Integration**: Context7, Sequential Thinking, Memory, Playwright

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
/plugin install skillforge-complete@complete

# Or clone manually
git clone https://github.com/yonatangross/skillforge-claude-plugin ~/.claude/plugins/skillforge

# Verify installation
ls ~/.claude/plugins/skillforge/.claude/skills
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
```

### Hook Management
```bash
# View hook logs
tail -f .claude/hooks/logs/pretool-bash.log
tail -f .claude/hooks/logs/posttool.log

# Test specific hook
.claude/hooks/pretool/bash/git-branch-protection.sh

# Clear hook logs
rm -rf .claude/hooks/logs/*.log
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
# Validate new skill structure
./bin/validate-skill.sh .claude/skills/my-new-skill

# Test progressive loading
./bin/test-progressive-load.sh my-skill-id

# Generate skill from template
./bin/generate-skill.sh --name "My Skill" --category ai
```

---

## Testing Approach

### Security Testing (Priority: CRITICAL)
Located in `tests/security/`, this framework validates 8 defense-in-depth layers:

1. **Permission Layer**: Hook permission controls
2. **Execution Layer**: Bash command safety
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

**Example**:
```bash
# Step 1: Read capabilities.json to check if skill is relevant
Read .claude/skills/api-design-framework/capabilities.json

# Step 2: If relevant, read SKILL.md for patterns
Read .claude/skills/api-design-framework/SKILL.md

# Step 3: If implementing specific pattern, read reference
Read .claude/skills/api-design-framework/references/rest-pagination.md

# Step 4: If generating code, use template
Read .claude/skills/api-design-framework/templates/endpoint-template.py
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

### 4. Agent Handoff Pattern
When delegating to specialized agents:
```markdown
1. Read `.claude/agents/{agent-id}.md` for capabilities
2. Check `plugin.json` for agent skills_used
3. Load required skills BEFORE spawning agent
4. Use Task tool with proper context
5. Validate output against agent's success criteria
```

### 5. Context Protocol 2.0
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

### 6. Git Branch Protection
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

### 7. Quality Gates
Subagent completion triggers quality gates:
- Test coverage >= 70% (configurable)
- Security scans pass
- Schema validation passes
- No TODO/FIXME in critical paths

Configure in `.claude/hooks/subagent-stop/subagent-quality-gate.sh`

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

### Context Management
- **DO NOT** exceed context budget (2200 tokens total)
- **DO NOT** load entire skill directories (use progressive loading)
- **DO NOT** write to `shared-context.json` (deprecated - use Context 2.0)

### Agent Boundaries
- **DO NOT** use backend-system-architect for frontend code
- **DO NOT** use workflow-architect for API design (that's backend-system-architect)
- **DO NOT** spawn agents without checking `plugin.json` capabilities

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
# Step 1: Generate from template
./bin/generate-skill.sh --name "My Skill" --category backend

# Step 2: Create progressive loading files
mkdir -p .claude/skills/my-skill/references
touch .claude/skills/my-skill/capabilities.json  # Tier 1
touch .claude/skills/my-skill/SKILL.md          # Tier 2
touch .claude/skills/my-skill/references/impl.md # Tier 3

# Step 3: Update plugin.json
# Add to "skills" array with path, tags, description

# Step 4: Validate
./tests/schemas/validate-all.sh
./bin/validate-skill.sh .claude/skills/my-skill

# Step 5: Test discovery
./bin/test-progressive-load.sh my-skill
```

### 2. Creating a New Agent
```bash
# Step 1: Create agent markdown
cat > .claude/agents/my-agent.md <<EOF
# My Agent
[Agent definition following template]
EOF

# Step 2: Update plugin.json
# Add to "agents" array with triggers, capabilities, skills_used

# Step 3: Test agent spawning
# Use Task tool with: "spawn my-agent to do X"

# Step 4: Validate handoffs
# Check that agent loads required skills
```

### 3. Implementing a Security Hook
```bash
# Step 1: Create hook file
cat > .claude/hooks/pretool/bash/my-security-hook.sh <<EOF
#!/usr/bin/env bash
# Security hook implementation
exit 0  # 0=approve, 1=reject
EOF
chmod +x .claude/hooks/pretool/bash/my-security-hook.sh

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
.claude/hooks/logs/

# Coordination state
.claude/coordination/work-registry.json
.claude/coordination/decision-log.json

# Context 2.0
.claude/context/identity.json
.claude/context/session/state.json

# Schemas
.claude/schemas/*.json
```

### Environment Variables
```bash
CLAUDE_PROJECT_DIR=/Users/yonatangross/coding/skillforge-claude-plugin
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
tail -20 .claude/hooks/logs/pretool-bash.log

# Check coordination locks
cat .claude/coordination/work-registry.json | jq '.locks'

# List available skills
ls .claude/skills/

# List available agents
ls .claude/agents/
```

---

## Version Information

- **Current Version**: 4.6.0 (as of 2026-01-08)
- **Claude Code Requirement**: >= 2.1.2
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
tail -f .claude/hooks/logs/*.log

# Validate coordination state
.claude/coordination/lib/coordination.sh status

# Test schema compliance
./tests/schemas/validate-all.sh
```

### Common Issues
1. **Hook not firing**: Check `.claude/settings.json` matcher patterns
2. **Skill not loading**: Verify `capabilities.json` exists (Tier 1)
3. **Permission denied**: Check auto-approval hooks in `hooks/permission/`
4. **Lock timeout**: Run `.claude/coordination/lib/coordination.sh cleanup`
5. **Context budget exceeded**: Use progressive loading, don't load entire directories

---

**Last Updated**: 2026-01-08 (v4.6.0 - Multi-worktree coordination)