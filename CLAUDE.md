# CLAUDE.md

This document provides essential context for Claude Code when working with the OrchestKit Claude Plugin project.

## Project Overview

**OrchestKit Complete** is a comprehensive AI-assisted development toolkit that transforms Claude Code into a full-stack development powerhouse. It provides:

- **164 skills**: Reusable knowledge modules in flat structure (including task-dependency-patterns for CC 2.1.16)
- **34 agents**: Specialized AI personas with native skill injection (CC 2.1.6)
- **23 user-invocable skills**: Pre-configured workflows (CC 2.1.3 unified skills/commands with `user-invocable: true`)
- **144 hooks**: Lifecycle automation via CC 2.1.11 Setup hooks + CC 2.1.7 native parallel execution
- **Progressive Loading**: Semantic discovery system that loads skills on-demand based on task context
- **Context Window HUD**: Real-time context usage monitoring with CC 2.1.6 statusline integration

**Purpose**: Enable AI-assisted development of production-grade applications with built-in best practices, security patterns, and quality gates.

**Target Users**: Development teams building modern full-stack applications with AI/ML capabilities, particularly those using FastAPI, React 19, LangGraph, and PostgreSQL.

---

## Key Directories

```
# MODULAR PLUGINS (33 domain-specific bundles)
.claude-plugin/
└── marketplace.json     # Marketplace manifest with all plugins

plugins/                 # Modular plugin bundles
└── ork-<domain>/        # Domain-specific plugin (e.g., ork-core, ork-rag)
    ├── .claude-plugin/
    │   └── plugin.json  # Plugin manifest (hooks, metadata)
    ├── agents/          # AI agent personas
    ├── skills/          # Knowledge modules with SKILL.md
    └── scripts/         # Hook executables

# FULL TOOLKIT (root level - for development/reference)
skills/                  # 164 skills (23 user-invocable, 141 internal)
agents/                  # 34 agents (all domains)
hooks/                   # 144 TypeScript hooks in 11 split bundles
│   ├── src/             # TypeScript source (Phase 4: 144 hooks in 11 bundles)
│   │   ├── index.ts     # Unified hook registry + exports
│   │   ├── types.ts     # HookInput, HookResult interfaces
│   │   ├── entries/     # Split bundle entry points
│   │   └── lib/         # Shared utilities
│   ├── dist/            # Compiled ESM bundles
│   │   ├── permission.mjs   # 8.35 KB
│   │   ├── pretool.mjs      # 47.68 KB
│   │   ├── posttool.mjs     # 58.16 KB
│   │   ├── prompt.mjs       # 56.91 KB
│   │   ├── lifecycle.mjs    # 31.45 KB
│   │   ├── subagent.mjs     # 56.16 KB
│   │   └── hooks.mjs        # 324.25 KB (unified for CLI)
│   ├── bin/
│   │   └── run-hook.mjs # CLI runner
│   ├── package.json     # NPM package config
│   ├── tsconfig.json    # TypeScript config
│   ├── esbuild.config.mjs  # Bundle config
│   ├── setup/           # CC 2.1.11 Setup hooks (--init, --maintenance)
│   ├── lifecycle/       # Session start/end hooks
│   ├── permission/      # Auto-approval for safe operations (deprecated - migrated to src/)
│   ├── pretool/         # Pre-execution validation (deprecated - migrated to src/)
│   ├── posttool/        # Post-execution logging and metrics
│   ├── prompt/          # Prompt enhancement and context injection
│   └── stop/            # Conversation stop handlers

.claude/
├── context/             # Session state, knowledge base
├── coordination/        # Multi-worktree coordination (locks, registries)
├── schemas/             # JSON schemas for validation
└── scripts/             # Helper utilities

# Skills use CC 2.1.7 native flat structure:
skills/<skill-name>/
├── SKILL.md            # Required: Overview and patterns (~500 tokens)
├── references/         # Optional: Specific implementations (~200 tokens)
├── scripts/            # Optional: Executable code and generators
├── assets/             # Optional: Templates and copyable files
└── checklists/         # Optional: Implementation checklists

tests/
├── plugins/             # Plugin validation suite
├── integration/         # Integration test suites
├── security/            # Security testing framework
└── unit/                # Unit test suites

bin/                     # CLI utilities and scripts
.github/workflows/       # CI/CD pipelines
```

---

## Tech Stack

### Core Plugin Technology
- **Language**: TypeScript (hooks), JSON (schemas, config), Markdown (skills, agents)
- **Hook Infrastructure**: TypeScript ESM (144 hooks in 11 split bundles, 379 KB total)
- **Claude Code**: >= 2.1.19 (CC 2.1.19 modernization, CC 2.1.16 Task Management + VSCode plugins, CC 2.1.15 plugin engine field, CC 2.1.14 plugin versioning, CC 2.1.11 Setup hooks, CC 2.1.9 additionalContext, auto:N MCP, plansDirectory)
- **MCP Integration**: Optional - Context7, Sequential Thinking, Memory (configure via /ork:configure, auto-enable via auto:N thresholds)
- **Browser Automation**: agent-browser CLI (Vercel) - 93% less context vs Playwright MCP, Snapshot + Refs workflow

### Expected Application Stack (Skills Support)
- **Backend**: FastAPI + Python 3.11+ + SQLAlchemy 2.0 + PostgreSQL 18 + pgvector
- **Frontend**: React 19 + TypeScript 5.0+ + Vite + Zod + MSW
- **AI/ML**: LangGraph 1.0 + OpenAI/Anthropic SDKs + Langfuse
- **Infrastructure**: Docker + GitHub Actions

### Skill Loading (CC 2.1.7 Native)
- **Discovery**: SKILL.md frontmatter (name, description, tags) - semantic matching
- **Overview**: SKILL.md body (300-800 tokens) - patterns and best practices
- **Specific**: `references/*.md` (90-300 tokens) - implementation guides
- **Generate**: `assets/*` (templates, copyable files) - boilerplate and templates
- **Execute**: `scripts/*` (executable code) - generators and utilities

---

## Development Commands

### Installation & Setup
```bash
# Install from marketplace
/plugin marketplace add yonatangross/orchestkit
/plugin install skf

# Or clone manually
git clone https://github.com/yonatangross/orchestkit ~/.claude/plugins/orchestkit

# Verify installation - check nested structure
ls ~/.claude/plugins/orchestkit/skills/
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

### TypeScript Hook Development
```bash
# Build TypeScript hooks
cd hooks && npm run build

# Type check hooks
cd hooks && npm run typecheck

# Watch mode for development
cd hooks && npm run dev

# Validate hook bundle
ls -lh hooks/dist/hooks.mjs
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

# Step 3: If generating code, use template from assets/
Read skills/api-design-framework/assets/openapi-template.yaml
```

### 2. Hook Architecture (CC 2.1.7)
Lifecycle hooks use CC 2.1.7 native parallel execution with output aggregation:
- **SessionStart**: 8 hooks registered directly (context, env, memory, patterns, coordination)
- **UserPromptSubmit**: 4 hooks registered directly (context injection, memory search)
- **SessionEnd**: 4 hooks registered directly (cleanup, metrics, sync)
- **Stop**: 10 hooks registered directly (auto-save, compaction, cleanup)

Tool-based hooks use CC 2.1.7 native registration (direct hooks, no dispatchers):
- `pretool/bash/*` → git-branch-protection, dangerous-command-blocker, etc.
- `pretool/write-edit/*` → file-guard, file-lock-check, multi-instance-lock
- `posttool/*` → audit-logger, error-tracker, memory-bridge, etc.

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

Use `/ork:claude-hud` to configure statusline display.

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

### 11. Agent Orchestration Layer (#197)
Intelligent agent dispatch system that automatically spawns specialized agents based on prompt analysis.

**Architecture:**
```
UserPromptSubmit
      │
      ▼
┌─────────────────┐
│ Intent Classifier│  Hybrid scoring: 30% keyword + 25% phrase +
│ (85%+ accuracy) │  20% context + 15% co-occurrence + 10% negation
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│            Decision Engine                   │
│  ≥85%: AUTO-DISPATCH  │  ≥80%: SKILL-INJECT │
│  ≥70%: STRONG RECOMMEND │  ≥50%: SUGGEST    │
└────────────────────────────────────────────-┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Agent Spawned   │────►│ CC 2.1.16 Task  │
│ (Task tool)     │     │ TaskCreate      │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Calibration     │  Records outcomes, adjusts keyword weights
│ Engine          │  for continuous accuracy improvement
└─────────────────┘
```

**Confidence Thresholds:**
| Threshold | Value | Action |
|-----------|-------|--------|
| AUTO_DISPATCH | 85% | Immediately spawn agent |
| SKILL_INJECT | 80% | Auto-inject skill content |
| STRONG_RECOMMEND | 70% | Strong recommendation |
| SUGGEST | 50% | Suggestion only |
| MINIMUM | 40% | Filter threshold |

**Multi-Agent Pipelines (5 predefined):**
- `product-thinking`: market-intelligence → product-strategist → prioritization-analyst → business-case-builder → requirements-translator → metrics-architect
- `full-stack-feature`: backend-system-architect → frontend-ui-developer → test-generator → security-auditor
- `ai-integration`: workflow-architect → llm-integrator → data-pipeline-engineer → test-generator
- `security-audit`: security-auditor → security-layer-auditor → test-generator
- `frontend-compliance`: ux-researcher → rapid-ui-designer → frontend-ui-developer

**Pipeline Detection Triggers:**
- "should we build" → product-thinking pipeline
- "full-stack feature" → full-stack-feature pipeline
- "add RAG/LLM" → ai-integration pipeline

**Key Files:**
```
hooks/src/lib/
├── intent-classifier.ts      # Hybrid scoring engine
├── orchestration-types.ts    # THRESHOLDS, type definitions
├── orchestration-state.ts    # Session state management
├── task-integration.ts       # CC 2.1.16 bridge
├── retry-manager.ts          # Exponential backoff + alternatives
├── calibration-engine.ts     # Outcome learning
└── multi-agent-coordinator.ts # Pipeline definitions

hooks/src/prompt/
├── agent-orchestrator.ts     # Auto-dispatch hook
├── skill-injector.ts         # Skill auto-injection
└── pipeline-detector.ts      # Pipeline detection
```

**Retry Logic:**
- Max 3 retries with exponential backoff (2^n seconds, capped at 30s)
- Suggests alternative agents after failures
- Keeps task in_progress during retry, marks blocked on give-up

**Calibration:**
- Records: agent, confidence, outcome (success/partial/failure/rejected)
- Adjusts keyword weights: +3 for success, -3 for failure (capped at ±15)
- Stored in `.claude/feedback/calibration-data.json`

### 12. Task Management (CC 2.1.16) - CRITICAL
**ALWAYS use TaskCreate proactively** when starting non-trivial work. This is NOT optional.

**When to use TaskCreate:**
- User request involves 3+ distinct steps
- Implementing a feature that touches multiple files
- Fixing a bug that requires investigation + implementation + verification
- Any work that would benefit from progress tracking

**Required workflow:**
```
1. TaskCreate - Create tasks BEFORE starting work
   - Use imperative subject: "Add authentication"
   - Use continuous activeForm: "Adding authentication"

2. TaskUpdate status: "in_progress" - When starting a task

3. TaskUpdate status: "completed" - When task is FULLY verified
   - Only mark complete after tests pass
   - Only mark complete after manual verification

4. TaskUpdate addBlockedBy - For dependent tasks
   - Task #3 depends on #1 and #2:
   - {"taskId": "3", "addBlockedBy": ["1", "2"]}
```

**activeForm Examples (action-specific, not generic):**
| Task Type | Subject (imperative) | activeForm (continuous) |
|-----------|---------------------|------------------------|
| API design | Design user endpoints | Designing user endpoints |
| Database | Create schema migration | Creating schema migration |
| Frontend | Build login component | Building login component |
| Tests | Write integration tests | Writing integration tests |
| Review | Audit security patterns | Auditing security patterns |

**Task Creation Responsibility:**
- **Orchestrator creates**: Pipeline tasks (auto via multi-agent-coordinator), auto-dispatched agent tasks
- **User creates**: Ad-hoc feature work, investigation/research tasks
- **Agents create**: Sub-tasks for complex work, related parallel work

**Failure Handling:**
- If task fails (tests don't pass, errors occur): Keep as `in_progress`, create blocker task
- If blocked by external dependency: Create new task describing the blocker
- NEVER mark `completed` if work is partial or has unresolved errors
- CC 2.1.16 has no `failed` status - use `pending` for retry or create new task

**Owner Field (multi-agent):**
- Set `owner` when claiming a task: `{"taskId": "1", "owner": "backend-system-architect"}`
- Clear owner when releasing: `{"taskId": "1", "owner": ""}`
- Check owner before claiming to avoid conflicts

**Example for "Implement user authentication":**
```
#1. [pending] Create User model schema
#2. [pending] Add auth endpoints (blockedBy: #1)
#3. [pending] Implement JWT token handling (blockedBy: #2)
#4. [pending] Add auth middleware (blockedBy: #3)
#5. [pending] Write integration tests (blockedBy: #4)
```

**Anti-Patterns:**
- Creating tasks for trivial single-line changes
- Creating circular dependencies (A blocks B, B blocks A)
- Over-blocking (task D blockedBy [A, B, C] when only C matters)
- Leaving tasks `in_progress` indefinitely when blocked
- Marking `completed` before verification

**DO NOT skip Task Management** - It provides:
- Progress visibility for the user
- Structured execution tracking
- Dependency management for parallel work
- Clear completion criteria

See `skills/task-dependency-patterns` for comprehensive patterns.

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

# Step 4: Add assets if needed (optional - for templates/copyable files)
mkdir -p skills/my-skill/assets
touch skills/my-skill/assets/my-template.tsx

# Step 5: Validate
./tests/skills/structure/test-skill-md.sh
./tests/skills/structure/test-assets-directory.sh
```

### 2. Creating a New Agent (CC 2.1.6 Format)
```bash
# Step 1: Create agent markdown with CC 2.1.6 native frontmatter
cat > agents/my-agent.md << 'EOF'
---
name: my-agent
description: What this agent does and when to use it. Activates for keyword1, keyword2, pattern
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
# NOTE: Activation keywords MUST be in description field (not ## Auto Mode section)
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

# Step 2: Register hook in .claude/settings.json
# CC 2.1.7 uses direct registration, no dispatchers

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
# - Frontend 2026 Compliance: "modernize the frontend"

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
ORCHESTKIT_SKIP_SETUP=1  # Skip Setup hook entirely (runs before SessionStart) - use if startup hangs
ORCHESTKIT_SKIP_SLOW_HOOKS=1  # Skip slow SessionStart hooks (pattern-sync, dependency-check, coordination) for faster startup
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

164 skills in flat structure at `skills/`. Common skill types include:

- **AI/LLM**: RAG, embeddings, agents, caching, observability, agentic-rag-patterns, prompt-engineering-suite, alternative-agent-frameworks, high-performance-inference, fine-tuning-customization (27 skills)
- **AI Security**: MCP security hardening, advanced guardrails, LLM safety patterns (3 skills - NEW)
- **LangGraph**: State, routing, parallel, checkpoints, human-in-loop (7 skills)
- **Backend**: FastAPI, asyncio, SQLAlchemy async, connection pooling, idempotency, resilience (19 skills)
- **Frontend**: React 19, design systems, animations, i18n, Radix primitives, shadcn patterns, render optimization, Vite, Biome, Zustand, TanStack Query, forms, Core Web Vitals, image optimization, lazy-loading, view-transitions, scroll-driven-animations, responsive-patterns, PWA, Recharts, dashboards (23 skills)
- **Testing**: Unit, integration, E2E, mocking, data management, a11y-testing (10 skills)
- **Security**: OWASP, auth, validation, defense-in-depth (5 skills)
- **DevOps**: CI/CD, observability, GitHub CLI (4 skills)
- **MCP**: MCP advanced patterns, server building, tool composition (2 skills - NEW)
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
- Browser automation now uses `agent-browser` CLI via Bash (not MCP)

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

## CC 2.1.14-2.1.15 Features

### Plugin Versioning (CC 2.1.14)
Pin plugins to specific git commits for reproducible installations:
```bash
# Pin to specific commit
/plugin install user/plugin@abc123

# Pin to tag
/plugin install user/plugin@v1.0.0
```

### Engine Field (CC 2.1.15)
Plugins can now declare minimum Claude Code version requirements:
```json
{
  "name": "my-plugin",
  "engine": ">=2.1.15"
}
```

### Other 2.1.14-2.1.15 Features
- **Bash history autocomplete**: Use `!` + Tab to search command history
- **Plugin search**: Search marketplace with `/plugin search <query>`
- **Context window fix**: Now uses 98% of context (was incorrectly limited to 65%)
- **NPM deprecation notice**: Migrate to `/plugin install` from npm
- **MCP timeout fix**: Improved connection reliability
- **VSCode /usage command**: Display current plan usage in VSCode

### NPM to Plugin Migration Guide

As of CC 2.1.15, npm-based plugin installations are **deprecated**. Follow this guide to migrate:

**Step 1: Remove npm installation**
```bash
# Check if installed via npm
npm list -g | grep claude

# Remove npm installations
npm uninstall -g @anthropic/claude-plugin-orchestkit
npm uninstall -g claude-code-plugins
```

**Step 2: Install via native plugin system**
```bash
# In Claude Code
/plugin marketplace add yonatangross/orchestkit
/plugin install ork
```

**Step 3: Verify migration**
```bash
/ork:doctor
```

**Benefits of Native Plugin System:**
| Feature | npm (deprecated) | /plugin install |
|---------|-----------------|-----------------|
| Version pinning | Package version only | Git SHA + tags |
| Installation | Requires Node.js | Built-in |
| Sandboxing | None | Full isolation |
| Updates | `npm update` | `/plugin update` |
| Marketplace | npm registry | Claude marketplace |

**Timeline:**
- **CC 2.1.15**: Deprecation warning shown
- **CC 2.2.0** (est.): npm support removed

---

## CC 2.1.16 Features

### Task Management System
CC 2.1.16 introduces native task tracking with four new tools:

| Tool | Purpose |
|------|---------|
| `TaskCreate` | Create tasks with subject, description, activeForm |
| `TaskUpdate` | Update status, set dependencies (blocks/blockedBy) |
| `TaskGet` | Retrieve full task details including blockers |
| `TaskList` | View all tasks with status summary |

**Status Workflow:**
```
pending → in_progress → completed
```

**Dependency Tracking:**
```json
// Task #3 blocked until #1 and #2 complete
{"taskId": "3", "addBlockedBy": ["1", "2"]}
```

**Best Practices:**
- Use imperative form for subject: "Add authentication" (not "Adding")
- Use present continuous for activeForm: "Adding authentication"
- Keep tasks atomic and independently completable
- Mark completed only when work is fully verified

See `skills/task-dependency-patterns` for comprehensive patterns.

### VSCode Native Plugin Management
VSCode extension now supports plugin operations directly in the UI:

- **Install plugins**: Click to install from marketplace
- **Manage plugins**: View installed plugins, enable/disable
- **Trust warnings**: Security prompts before installation
- **Install counts**: See plugin popularity in listings

### Bug Fixes
- **OOM prevention**: Better memory management for large contexts
- **Context warning accuracy**: Improved 90% context warning thresholds
- **Session title handling**: Fixed title persistence issues

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
ORCHESTKIT_SKIP_SETUP=1 claude  # Skip all setup hooks
```

### VSCode Plugin Enhancements
- Install count display in plugin listings
- Trust warning when installing plugins

---

## Version Information

- **Current Version**: 5.1.4 (as of 2026-01-23)
- **Claude Code Requirement**: >= 2.1.16
- **Skills Structure**: CC 2.1.7 native flat (skills/<skill>/)
- **Agent Format**: CC 2.1.6 native (skills array in frontmatter)
- **Hook Architecture**: CC 2.1.16 task dependencies + CC 2.1.15 engine field + CC 2.1.14 plugin versioning + CC 2.1.11 Setup hooks + CC 2.1.9 additionalContext + CC 2.1.7 native parallel (144 TypeScript hooks in 11 bundles)
- **Context Protocol**: 2.0.0 (tiered, attention-aware)
- **Memory Fabric**: v2.1.0 (graph-first architecture, knowledge graph PRIMARY, mem0 optional enhancement)
- **Coordination System**: Multi-worktree support added in v4.6.0
- **Security Testing**: Comprehensive 8-layer framework added in v4.5.1
- **CC 2.1.9 Integration**: additionalContext, auto:N MCP, plansDirectory (v4.16.0)
- **User-Invocable Skills**: CC 2.1.3 `user-invocable` field for 22 skills (v4.17.0)
- **Git Enforcement**: Commit message, branch naming, atomic commits, issue creation (v4.18.0)
- **CC 2.1.11 Integration**: Setup hooks (--init, --init-only, --maintenance), self-healing, maintenance automation (v4.19.0)
- **Automatic Pattern Extraction**: Hook-driven pattern learning and anti-pattern warnings (#48, #49) (v4.19.0)
- **Memory Fabric v2.1**: Graph-first architecture (v4.21.0) - knowledge graph PRIMARY, mem0 optional cloud enhancement
- **Frontend Skills Expansion**: lazy-loading-patterns, view-transitions, scroll-driven-animations, responsive-patterns, pwa-patterns, recharts-patterns, dashboard-patterns + performance-engineer agent (v4.26.0)
- **AI/ML Roadmap 2026**: 8 new AI security/ML skills + 2 agents (ai-safety-auditor, prompt-engineer) (v4.27.0)
- **agent-browser Integration**: Replaced Playwright MCP with Vercel agent-browser CLI (93% less context, Snapshot + Refs workflow) (v4.28.0)
- **CC 2.1.16 Integration**: Task Management System (TaskCreate, TaskUpdate, TaskGet, TaskList), VSCode native plugins, new task-dependency-patterns skill (v5.0.0)
- **TypeScript Hook Migration**: Phase 4 complete (144 TypeScript hooks in 11 split bundles, 379 KB total), ~77% load size reduction per hook type (v5.1.0)

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
7. **Claude Code hangs on startup**: 
   - **Quick fix**: Use `ORCHESTKIT_SKIP_SETUP=1 claude` to bypass Setup hook (runs before SessionStart)
   - **Full bypass**: Use `ORCHESTKIT_SKIP_SLOW_HOOKS=1 claude` to skip all slow hooks
   - **Both**: `ORCHESTKIT_SKIP_SETUP=1 ORCHESTKIT_SKIP_SLOW_HOOKS=1 claude` for maximum speed
   - Setup hook runs FIRST and can block - this is usually the culprit

---

**Last Updated**: 2026-01-24 (v5.1.5)