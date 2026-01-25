# CLAUDE.md

Essential context for Claude Code when working on OrchestKit.

## Project Overview

**OrchestKit** is a Claude Code plugin providing:
- **179 skills**: Reusable knowledge modules
- **35 agents**: Specialized AI personas
- **144 hooks**: TypeScript lifecycle automation

**Purpose**: AI-assisted development with built-in best practices, security patterns, and quality gates.

---

## Directory Structure

```
src/                    ← SOURCE (edit here!)
├── skills/             # 179 skills
│   └── <skill-name>/
│       ├── SKILL.md    # Required: frontmatter + content
│       └── references/ # Optional: detailed guides
├── agents/             # 35 agents
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
179 skills available. 22 are user-invocable via `/ork:skillname`. Skills auto-suggest based on prompt content via hooks. Use `Skill` tool to invoke.

### Agents
34 specialized agents. Spawn with `Task` tool using `subagent_type` parameter. Agents auto-discovered from `src/agents/*.md`. Skills in agent frontmatter are auto-injected.

### Hooks
144 TypeScript hooks in 11 split bundles. Auto-loaded from `hooks/hooks.json`. Return `{"continue": true}` to proceed, `{"continue": false}` to block.

**Async Execution**: 31 hooks use `async: true` for non-blocking background execution (analytics, network I/O, startup tasks). See `src/hooks/README.md` for async hook patterns.

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

### Environment Variables
```bash
CLAUDE_PROJECT_DIR    # User's project directory
CLAUDE_PLUGIN_ROOT    # Plugin installation directory
CLAUDE_SESSION_ID     # Current session UUID
```

---

## Version

- **Current**: 5.2.8
- **Claude Code**: >= 2.1.19
- **Hooks**: 144 TypeScript (11 split bundles, 31 async)

See `CHANGELOG.md` for detailed version history and features.
