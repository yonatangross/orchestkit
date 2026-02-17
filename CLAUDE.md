# CLAUDE.md

Essential context for Claude Code when working on OrchestKit.

## Project Overview

**OrchestKit** — Claude Code plugin: **62 skills**, **37 agents**, **86 hooks** (63 global + 22 agent-scoped + 1 skill-scoped).

**Purpose**: AI-assisted development with built-in best practices, security patterns, and quality gates.

## Directory Structure

```
src/                    ← SOURCE (edit here!)
├── skills/<name>/SKILL.md    # 62 skills (YAML frontmatter + Markdown)
├── agents/<name>.md          # 37 agents (CC 2.1.34 format)
└── hooks/                    # TypeScript hooks (hooks.json + src/ + dist/)
manifests/                    # Plugin definitions (JSON)
plugins/                      # GENERATED (never edit!)
scripts/build-plugins.sh      # Assembles plugins/ from src/
```

**Key rule**: Edit `src/` and `manifests/`, NEVER edit `plugins/`.

## Commands

```bash
npm run build              # Build plugins from source (required after editing src/)
npm test                   # Run all tests
npm run test:skills        # Skill structure validation
npm run test:agents        # Agent frontmatter validation
npm run test:security      # Security tests (MUST pass)
cd src/hooks && npm run build    # Compile TypeScript hooks
```

## Adding Components

**Skill**: See `src/skills/CONTRIBUTING-SKILLS.md` for full authoring standards. Create `src/skills/my-skill/SKILL.md` with YAML frontmatter (`name`, `description`, `tags`, `user-invocable`, `complexity`). Add to `manifests/ork.json`, run `npm run build`.

**Agent**: Create `src/agents/my-agent.md` with frontmatter (`name`, `description`, `model`, `tools`, `skills`). Add to manifest, rebuild.

**Hook**: Create `src/hooks/src/<category>/my-hook.ts`, register in `src/hooks/hooks.json`, rebuild with `cd src/hooks && npm run build`.

## Critical Rules

**DO**: Edit `src/`, run `npm run build`, commit to feature branches, run tests before pushing, use TaskCreate for 3+ step work.

**DON'T**: Edit `plugins/`, commit to `main`/`dev` directly, skip security tests, bypass hooks with `--no-verify`, commit secrets.

## Three-Tier Plugins

| Plugin | Skills | Agents | Description |
|--------|--------|--------|-------------|
| `orkl` | 45 | 36 | Universal toolkit — any stack |
| `ork-creative` | 3 | 1 | Video production add-on |
| `ork` | 62 | 36 | Full — lite + creative + Python, React, LLM/RAG |

All plugins include 86 hooks. 24 skills are user-invocable via `/ork:skillname`.

## Quick Reference

| Component | Location | Format |
|-----------|----------|--------|
| Skills | `src/skills/<name>/SKILL.md` | YAML frontmatter + Markdown |
| Agents | `src/agents/<name>.md` | YAML frontmatter + Markdown |
| Hooks | `src/hooks/hooks.json` | JSON with TypeScript handlers |
| Manifests | `manifests/<plugin>.json` | JSON plugin definitions |

## Version

- **Current**: 6.0.12 · **Claude Code**: >= 2.1.34
- **Hooks**: 86 entries (63 global + 22 agent-scoped + 1 skill-scoped, 12 bundles, 7 fire-and-forget dispatchers)

See `CHANGELOG.md` for history. See `src/hooks/README.md` for hook architecture.
