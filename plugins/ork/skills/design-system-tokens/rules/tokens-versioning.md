---
title: "Version token packages with semver and deprecation annotations"
impact: HIGH
impactDescription: "Unversioned token changes silently break consuming applications and design tools"
tags: [versioning, semver, deprecation, migration, tokens-changelog]
---

## Token Versioning & Migration

Version your token packages with semantic versioning. Use `$extensions` for deprecation metadata. Provide codemods or migration scripts for breaking changes.

**Incorrect:**
```json
{
  "color": {
    "brand": { "$type": "color", "$value": "oklch(0.55 0.18 250)" }
  }
}
```
```bash
# Renaming "brand" to "primary" with no warning, no migration path
git commit -m "rename brand to primary"
# Every consumer breaks silently
```

**Correct:**
```json
{
  "color": {
    "brand": {
      "$type": "color",
      "$value": "{color.primary.500}",
      "$extensions": {
        "com.tokens.deprecated": {
          "since": "2.0.0",
          "replacement": "color.primary.500",
          "removal": "3.0.0",
          "message": "Use color.primary.500 instead"
        }
      }
    },
    "primary": {
      "$type": "color",
      "500": { "$value": "oklch(0.55 0.18 250)" }
    }
  }
}
```

```js
// codemod for consumers (jscodeshift or custom script)
const tokenMigrations = {
  '--color-brand': '--color-primary-500',
  'var(--color-brand)': 'var(--color-primary-500)',
};

function migrateCSS(source) {
  let result = source;
  for (const [old, replacement] of Object.entries(tokenMigrations)) {
    result = result.replaceAll(old, replacement);
  }
  return result;
}
```

**Key rules:**
- **PATCH** (1.0.x): New tokens, updated `$description`, metadata changes
- **MINOR** (1.x.0): New token groups, new aliases, deprecated tokens (still functional)
- **MAJOR** (x.0.0): Removed tokens, renamed tokens, changed `$value` semantics
- Always deprecate before removing — minimum one minor version between deprecation and removal
- Include `replacement` path in deprecation metadata so tooling can auto-migrate
- Maintain a `CHANGELOG.md` for your token package with migration instructions
- Run a CI check that flags usage of deprecated tokens in consuming repos
- Publish tokens as an npm package (e.g., `@myorg/design-tokens`) for versioned consumption

Reference: [references/token-naming-conventions.md](../references/token-naming-conventions.md)
