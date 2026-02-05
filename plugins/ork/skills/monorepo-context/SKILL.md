---
name: monorepo-context
description: Multi-directory context patterns for monorepos. Use when working with --add-dir, per-service CLAUDE.md, or separating root vs service context
context: fork
version: 1.0.0
author: OrchestKit
tags: [monorepo, multi-directory, context, workspace, add-dir]
user-invocable: false
complexity: medium
---

# Monorepo Context Patterns

## Overview

Claude Code 2.1.20 introduces `--add-dir` for multi-directory context, enabling monorepo-aware sessions where each service maintains its own CLAUDE.md instructions.

## Monorepo Detection

Indicators that a project is a monorepo:

| Indicator | Tool |
|-----------|------|
| `pnpm-workspace.yaml` | pnpm |
| `lerna.json` | Lerna |
| `nx.json` | Nx |
| `turbo.json` | Turborepo |
| `rush.json` | Rush |
| 3+ nested `package.json` files | Generic |

## Per-Service CLAUDE.md

Each service can have its own context instructions:

```
monorepo/
  CLAUDE.md               # Root context (workspace-wide rules)
  packages/
    api/
      CLAUDE.md           # API-specific patterns
      package.json
    web/
      CLAUDE.md           # Frontend-specific patterns
      package.json
    shared/
      CLAUDE.md           # Shared library context
      package.json
```

## --add-dir Usage

Start Claude Code with additional directory context:

```bash
# From api service, add shared library context
claude --add-dir ../shared

# Multiple directories
claude --add-dir ../shared --add-dir ../web
```

## Environment Variable

Enable automatic CLAUDE.md loading from additional directories:

```bash
export CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1
```

When set, Claude Code reads CLAUDE.md from all `--add-dir` directories.

## Root vs Service Context Separation

### Root CLAUDE.md

- Workspace-wide conventions (commit messages, branch naming)
- Cross-service dependency rules
- CI/CD pipeline overview
- Shared tooling configuration

### Service CLAUDE.md

- Service-specific patterns and frameworks
- Local test commands
- API contracts and schemas
- Service-specific environment variables

## Related Skills

- `configure` - OrchestKit configuration including monorepo detection
- `project-structure-enforcer` - Folder structure enforcement
