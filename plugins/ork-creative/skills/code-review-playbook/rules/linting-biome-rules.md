---
title: Biome Rule Configuration and CI Integration
impact: HIGH
impactDescription: "Proper Biome configuration catches type errors, unused code, and security issues with 421 built-in rules"
tags: biome, rules, type-inference, ci, github-actions, configuration
---

## Biome Rule Configuration and CI Integration

**Incorrect — default config without key rules enabled:**
```json
{
  "linter": { "enabled": true }
  // Missing: noUnusedVariables, noUnusedImports, noExplicitAny
  // Missing: type-aware rules (Biome 2.0+)
}
```

**Correct — production Biome configuration:**
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
      },
      "nursery": {
        "noFloatingPromises": "error"
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

**Biome 2.0+ type inference features:**
- Reads `.d.ts` from node_modules for type-aware rules
- `noFloatingPromises`: Catches unhandled promises (previously required tsconfig)
- Multi-file analysis: Cross-module diagnostics

**Correct — CI integration (GitHub Actions):**
```yaml
# .github/workflows/lint.yml
name: Lint
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: biomejs/setup-biome@v2
      - run: biome ci .
```

**Biome vs ESLint comparison:**

| Aspect | Biome | ESLint + Prettier |
|--------|-------|-------------------|
| Speed | ~200ms for 10k lines | 3-5s |
| Config files | 1 (biome.json) | 4+ |
| npm packages | 1 binary | 127+ |
| Rules | 421 | Varies by plugins |
| Type inference | Yes (v2.0+) | Requires tsconfig |

Key decisions:
- Start with `recommended` rules, tighten over time
- Enable `noUnusedVariables` and `noUnusedImports` as errors
- Enable `noFloatingPromises` for TypeScript projects (v2.0+)
- Use `biome ci` in CI (strict), `biome check` locally
- Config strictness: recommended -> warn -> error progression
