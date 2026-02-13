---
title: Monorepo Context Patterns
impact: MEDIUM
impactDescription: "Working in monorepos without per-service context causes Claude Code to miss service-specific patterns — --add-dir and per-service CLAUDE.md solve this"
tags: monorepo, multi-directory, workspace, add-dir, context
---

## Monorepo Context Patterns

Configure Claude Code for monorepo workflows with per-service CLAUDE.md and multi-directory context.

**Incorrect — single flat context for entire monorepo:**
```bash
# WRONG: Claude Code only sees root, misses service-specific patterns
claude  # From monorepo root — no service context
```

**Correct — multi-directory context with --add-dir:**
```bash
# Start Claude Code with additional service context
claude --add-dir ../shared
claude --add-dir ../shared --add-dir ../web

# Enable CLAUDE.md loading from added directories
export CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1
```

**Per-service CLAUDE.md structure:**
```
monorepo/
  CLAUDE.md               # Root: workspace-wide rules
  packages/
    api/
      CLAUDE.md           # API: FastAPI patterns, test commands
      package.json
    web/
      CLAUDE.md           # Web: Next.js patterns, component library
      package.json
    shared/
      CLAUDE.md           # Shared: library API, versioning rules
      package.json
```

**Root CLAUDE.md (workspace-wide):**
```markdown
# Monorepo Root

## Conventions
- Commit format: conventional commits
- Branch naming: issue/<number>-<desc>
- CI: Turborepo pipeline, affected-only builds

## Cross-Service Rules
- Shared types live in packages/shared
- API changes require web compatibility check
```

**Service CLAUDE.md (service-specific):**
```markdown
# API Service

## Stack
- FastAPI 0.115+, Python 3.12+
- SQLAlchemy 2.x async

## Test Commands
npm run test:api       # Unit tests
npm run test:api:e2e   # Integration tests

## Patterns
- All endpoints return RFC 9457 errors
- Use dependency injection via FastAPI Depends()
```

**Monorepo detection indicators:**

| Indicator | Tool |
|-----------|------|
| `pnpm-workspace.yaml` | pnpm |
| `lerna.json` | Lerna |
| `nx.json` | Nx |
| `turbo.json` | Turborepo |
| `rush.json` | Rush |
| 3+ nested `package.json` | Generic |

**Key rules:**
- Root CLAUDE.md: workspace conventions, cross-service rules, CI pipeline
- Service CLAUDE.md: framework patterns, test commands, API contracts
- Use `--add-dir` when working across service boundaries
- Set `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` for full context loading
- Keep service CLAUDE.md focused — avoid duplicating root-level rules
