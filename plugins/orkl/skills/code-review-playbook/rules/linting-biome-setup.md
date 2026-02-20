---
title: Set up Biome as a single-tool replacement for ESLint and Prettier with 10-25x speedup
impact: HIGH
impactDescription: "Biome replaces ESLint+Prettier with a single tool that is 10-25x faster with zero config complexity"
tags: biome, linting, formatting, eslint-migration, code-quality
---

## Biome Linting Setup and Migration

**Incorrect — complex multi-tool setup:**
```json
// 4+ config files: .eslintrc, .prettierrc, .prettierignore, .editorconfig
// 127+ npm packages for ESLint + Prettier + plugins
// 3-5s lint time for 10k lines
```

**Correct — Biome single-tool setup:**
```bash
# Install (single binary, no plugins needed)
npm install --save-dev --save-exact @biomejs/biome

# Initialize config
npx @biomejs/biome init

# Check (lint + format in one command)
npx @biomejs/biome check .

# Fix all auto-fixable issues
npx @biomejs/biome check --write .

# CI mode (strict, fails on errors)
npx @biomejs/biome ci .
```

**Correct — ESLint migration:**
```bash
# Auto-migrate ESLint configuration
npx @biomejs/biome migrate eslint --write
```

Common rule mappings:

| ESLint | Biome |
|--------|-------|
| no-unused-vars | correctness/noUnusedVariables |
| no-console | suspicious/noConsole |
| @typescript-eslint/* | Most supported |
| eslint-plugin-react | Most supported |
| eslint-plugin-jsx-a11y | Most supported |

**Correct — gradual adoption with overrides:**
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

Key decisions:
- New projects: Start with Biome directly
- Existing projects: Migrate gradually with overrides
- CI: Use `biome ci` for strict mode, `biome check` for local dev
- Speed: ~200ms for 10k lines vs 3-5s with ESLint+Prettier
