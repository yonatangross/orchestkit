# CLAUDE.md

Essential context for Claude Code when working on OrchestKit.

## Project Overview

**OrchestKit** is a Claude Code plugin providing:
- **200 skills**: Reusable knowledge modules
- **36 agents**: Specialized AI personas
- **122 hooks**: TypeScript lifecycle automation (94 global + 22 agent-scoped + 6 skill-scoped, 6 fire-and-forget dispatchers)

**Purpose**: AI-assisted development with built-in best practices, security patterns, and quality gates.

---

## Directory Structure

```
src/                    ← SOURCE (edit here!)
├── skills/             # 200 skills
│   └── <skill-name>/
│       ├── SKILL.md    # Required: frontmatter + content
│       └── references/ # Optional: detailed guides
├── agents/             # 36 agents
│   └── <agent-name>.md # CC 2.1.6 format with frontmatter
└── hooks/              # TypeScript hooks
    ├── src/            # Source files
    ├── dist/           # Compiled bundles
    ├── bin/run-hook.mjs
    └── hooks.json      # Hook definitions

manifests/              ← Plugin definitions (JSON)
├── ork.json            # Full plugin
└── ork-*.json          # Domain-specific plugins

plugins/                ← GENERATED (never edit!)
└── ork/                # Built by npm run build

scripts/
└── build-plugins.sh    # Assembles plugins/ from src/
```

**Key rule**: Edit `src/` and `manifests/`, NEVER edit `plugins/`.

---

## Build System

```bash
# Build plugins from source (required after editing src/ or manifests/)
npm run build

# What it does:
# 1. Reads manifests/*.json
# 2. Copies skills, agents, hooks from src/ to plugins/
# 3. Generates .claude-plugin/plugin.json for each plugin
```

---

## Development Commands

```bash
# Build
npm run build              # Assemble plugins from source

# Test
npm test                   # Run all tests
npm run test:skills        # Skill structure validation
npm run test:agents        # Agent frontmatter validation
npm run test:security      # Security tests (MUST pass)

# Hooks
cd src/hooks && npm run build    # Compile TypeScript hooks
cd src/hooks && npm run typecheck
```

---

## Adding Components

### Add a Skill

```bash
mkdir -p src/skills/my-skill/references
```

Create `src/skills/my-skill/SKILL.md`:
```yaml
---
name: my-skill
description: Brief description of what this skill provides
tags: [keyword1, keyword2]
user-invocable: true  # If callable via /ork:my-skill
complexity: medium    # low|medium|high|max — for adaptive thinking alignment
---

# My Skill

Overview and patterns...
```

Then add to manifest and rebuild:
```bash
# Edit manifests/ork.json to include "my-skill" in skills array
npm run build
```

### Add an Agent

Create `src/agents/my-agent.md`:
```yaml
---
name: my-agent
description: What this agent does. Activates for keyword1, keyword2
model: sonnet
tools:
  - Read
  - Write
  - Bash
skills:
  - relevant-skill-1
  - relevant-skill-2
---

## Directive
Clear instruction for what this agent does.

## Task Boundaries
**DO:** List what this agent should do
**DON'T:** List what other agents handle
```

Then add to manifest and rebuild.

### Add a Hook

1. Create TypeScript file in `src/hooks/src/<category>/my-hook.ts`
2. Export function following `HookInput → HookResult` pattern
3. Register in `src/hooks/hooks.json`
4. Rebuild: `cd src/hooks && npm run build`

---

## Claude Code Integration

### Task Management
Use `TaskCreate` for multi-step work (3+ distinct steps). Set status to `in_progress` when starting, `completed` only when fully verified. Use `addBlockedBy` for dependencies.

See `skills/task-dependency-patterns` for comprehensive patterns.

### Skills
200 skills available. 24 are user-invocable via `/ork:skillname`. Skills auto-suggest based on prompt content via hooks. Use `Skill` tool to invoke.

**Skill Types:**
| Type | Count | Frontmatter | Description |
|------|-------|-------------|-------------|
| Command | 24 | `user-invocable: true` | User runs via `/ork:name` |
| Reference | 176 | `user-invocable: false`, `context: fork` | Knowledge for agents, auto-injected |

**Key Fields:**
- `context: fork` — Required for CC 2.1.0+. Skill runs in isolated context.
- `agent: <name>` — Which agent primarily uses this skill (e.g., `agent: demo-producer`)
- `complexity: low|medium|high|max` — Adaptive thinking alignment for Opus 4.6

**Skill Budget (CC 2.1.33+):** Platform scales skill character budget to 2% of context window. Token budgets auto-scale: 200K context → ~1200 tokens, 1M context → ~6000 tokens for skill injection.

### Agents
36 specialized agents. Spawn with `Task` tool using `subagent_type` parameter. Agents auto-discovered from `src/agents/*.md`. Skills in agent frontmatter are auto-injected.

### Hooks
122 hook entries (94 global + 22 agent-scoped + 6 skill-scoped) across 11 split bundles. Auto-loaded from `hooks/hooks.json`. Return `{"continue": true}` to proceed, `{"continue": false}` to block.

**Async Execution**: 6 unified dispatchers use fire-and-forget pattern for non-blocking background execution (analytics, network I/O, startup tasks). See `src/hooks/README.md` for async hook patterns.

---

## Critical Rules

### DO
- Edit files in `src/` (source of truth)
- Run `npm run build` after changes
- Commit to feature branches
- Run tests before pushing
- Use Task Management for multi-step work

### DON'T
- Edit `plugins/` directory (generated, gitignored)
- Commit to `main` or `dev` branches directly
- Skip security tests
- Bypass hooks with `--no-verify`
- Add skills without SKILL.md frontmatter

### File Safety
- Don't modify files outside project without explicit request
- Don't commit secrets (`.env`, `*.pem`, `*credentials*`)
- Don't delete `.claude/coordination/` files

---

## Testing

```bash
# All tests
npm test

# Individual suites
npm run test:security        # Security (MUST pass)
npm run test:skills          # Skill structure
npm run test:agents          # Agent frontmatter

# Direct execution
./tests/security/run-security-tests.sh
./tests/skills/structure/test-skill-md.sh
./tests/agents/test-agent-frontmatter.sh
```

Security tests validate 8 defense-in-depth layers. All must pass before merge.

---

## Quick Reference

| Component | Location | Format |
|-----------|----------|--------|
| Skills | `src/skills/<name>/SKILL.md` | YAML frontmatter + Markdown |
| Agents | `src/agents/<name>.md` | YAML frontmatter + Markdown |
| Hooks | `src/hooks/hooks.json` | JSON with TypeScript handlers |
| Manifests | `manifests/<plugin>.json` | JSON plugin definitions |
| Built plugins | `plugins/<name>/` | Generated, don't edit |

### Two-Tier Plugin Structure

| Plugin | Skills | Description |
|--------|--------|-------------|
| `orkl` | 109 | Universal toolkit — works for any stack. All workflows, agents, hooks. |
| `ork` | 200 | Full specialized — lite + Python, React, LLM/RAG, LangGraph, MCP. |

Both include all 36 agents, 122 hooks, and all memory skills (remember, memory, memory-fabric, mem0-memory).

### Environment Variables
```bash
CLAUDE_PROJECT_DIR    # User's project directory
CLAUDE_PLUGIN_ROOT    # Plugin installation directory
CLAUDE_SESSION_ID     # Current session UUID
MEM0_API_KEY          # Optional: enables mem0 cloud memory
TAVILY_API_KEY        # Optional: enables Tavily search/extract/map (middle tier in web research)
BRIGHTDATA_API_TOKEN  # Optional: enables BrightData web scraping MCP
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS  # Enabled: coordination hooks yield to CC native Agent Teams
```

### Memory Architecture (CC 2.1.30+ Integration)

OrchestKit bridges to Claude Code's native auto memory:

| Tier | Storage | Behavior |
|------|---------|----------|
| **1. Graph** | MCP `mcp__memory__*` | Primary, zero-config, always available |
| **2. Local** | `.claude/memory/*.jsonl` | Backup, session persistence |
| **3. Mem0** | Cloud (optional) | Semantic search, cross-session |
| **4. CC Native** | `~/.claude/projects/*/memory/MEMORY.md` | Auto-injected into system prompt |

High-confidence decisions (≥0.7) are automatically written to CC native MEMORY.md, ensuring they persist even without OrchestKit installed.

---

## Version

- **Current**: 6.0.2
- **Claude Code**: >= 2.1.34
- **Hooks**: 122 entries (94 global + 22 agent-scoped + 6 skill-scoped, 11 split bundles, 6 fire-and-forget dispatchers)

See `CHANGELOG.md` for detailed version history and features.
