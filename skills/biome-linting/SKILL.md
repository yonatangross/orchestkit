---
name: biome-linting
description: Biome 2.0+ linting and formatting for fast, unified code quality. Includes type inference, ESLint migration, CI integration, and 421 lint rules. Use when migrating from ESLint/Prettier or setting up new projects.
context: fork
agent: frontend-ui-developer
version: 1.0.0
tags: [biome, linting, formatting, eslint-migration, ci, code-quality, typescript]
user-invocable: false
---

# Biome Linting

Fast, unified linting and formatting (10-25x faster than ESLint + Prettier).

## Why Biome in 2026

| Aspect | Biome | ESLint + Prettier |
|--------|-------|-------------------|
| Speed | ~200ms for 10k lines | 3-5s |
| Config files | 1 (biome.json) | 4+ |
| npm packages | 1 binary | 127+ |
| Rules | 421 | Varies by plugins |
| Type inference | Yes (v2.0+) | Requires tsconfig |

## Quick Start

```bash
# Install
npm install --save-dev --save-exact @biomejs/biome

# Initialize
npx @biomejs/biome init

# Check (lint + format)
npx @biomejs/biome check .

# Fix
npx @biomejs/biome check --write .

# CI mode (fails on errors)
npx @biomejs/biome ci .
```

## Biome 2.0 Features

**Type Inference**: Reads `.d.ts` from node_modules for type-aware rules:

```json
{
  "linter": {
    "rules": {
      "nursery": {
        "noFloatingPromises": "error"  // Catches unhandled promises
      }
    }
  }
}
```

**Multi-file Analysis**: Cross-module analysis for better diagnostics.

## Basic Configuration

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all"
    }
  }
}
```

## ESLint Migration

```bash
# Auto-migrate configuration
npx @biomejs/biome migrate eslint --write
```

**Common Rule Mappings:**
| ESLint | Biome |
|--------|-------|
| no-unused-vars | correctness/noUnusedVariables |
| no-console | suspicious/noConsole |
| @typescript-eslint/* | Most supported |
| eslint-plugin-react | Most supported |
| eslint-plugin-jsx-a11y | Most supported |

## CI Integration

```yaml
# .github/workflows/lint.yml
- uses: biomejs/setup-biome@v2
- run: biome ci .
```

## Overrides for Gradual Adoption

```json
{
  "overrides": [
    {
      "include": ["*.test.ts", "*.spec.ts"],
      "linter": {
        "rules": {
          "suspicious": { "noExplicitAny": "off" }
        }
      }
    },
    {
      "include": ["legacy/**"],
      "linter": { "enabled": false }
    }
  ]
}
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| New vs migration | Biome first for new projects; migrate existing gradually |
| Config strictness | Start with recommended, tighten over time |
| CI strategy | Use `biome ci` for strict mode, `biome check` for local |
| Type inference | Enable for TypeScript projects (v2.0+) |

## Related Skills

- `vite-advanced` - Build tooling integration
- `react-server-components-framework` - React linting rules
- `ci-cd-engineer` - CI pipeline setup

## References

- [ESLint Migration](references/eslint-migration.md) - Step-by-step migration
- [Biome Config](references/biome-json-config.md) - Full configuration options
- [Type-Aware Rules](references/type-aware-rules.md) - Biome 2.0 type inference
- [CI Integration](references/ci-integration.md) - GitHub Actions setup
