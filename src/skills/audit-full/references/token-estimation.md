# Token Estimation Guide

Planning context budget for whole-codebase loading.

## Token Ratios by File Type

| File Type | Tokens/Line | Tokens/KB | Notes |
|-----------|-------------|-----------|-------|
| TypeScript/JavaScript | ~8 | ~320 | Variable names inflate count |
| Python | ~7 | ~280 | Indentation is efficient |
| Go | ~7 | ~280 | Verbose but predictable |
| JSON | ~5 | ~200 | High repetition, low entropy |
| YAML | ~5 | ~200 | Similar to JSON |
| Markdown | ~6 | ~240 | Prose-heavy content |
| CSS/SCSS | ~6 | ~240 | Property-value pairs |
| SQL | ~6 | ~240 | Keyword-heavy |
| HTML/JSX | ~9 | ~360 | Attribute-heavy markup |
| Protobuf/GraphQL schema | ~5 | ~200 | Declarative, repetitive |

## Quick Estimation Formula

```
Total tokens ≈ Total LOC × 7.5 (average)
```

For more precision:
```
Total tokens ≈ (TS lines × 8) + (Py lines × 7) + (Config lines × 5) + (Other × 7)
```

## Context Budget Planning

| Context Size | Total | Reserved for Prompt | Available for Code | Max LOC |
|-------------|-------|--------------------|--------------------|---------|
| 200K | 200,000 | ~50,000 | ~150,000 | ~20,000 |
| 500K | 500,000 | ~50,000 | ~450,000 | ~60,000 |
| 1M | 1,000,000 | ~50,000 | ~950,000 | ~125,000 |

**Reserved for prompt** includes: system prompt, skill content, analysis instructions, and output space.

## Exclusion Priority

When codebase exceeds budget, exclude in this order:

1. **Always exclude**: `node_modules/`, `vendor/`, `.venv/`, `dist/`, `build/`, `.next/`
2. **Exclude first**: Test fixtures, snapshots, migration files, generated code
3. **Exclude second**: Test files (unless auditing test quality)
4. **Exclude third**: Documentation, README files
5. **Keep last**: Source files, config, entry points

## Loading Priority

When partially loading, prioritize in this order:

1. **Entry points**: `index.ts`, `main.py`, `app.ts`, `server.ts`
2. **Route definitions**: API routes, page routes
3. **Middleware/interceptors**: Auth, validation, error handling
4. **Business logic**: Services, use cases, domain models
5. **Data access**: Repositories, ORM models, migrations
6. **Config**: Environment config, feature flags, secrets management
7. **Utilities**: Shared helpers, common functions

## Real-World Sizing Examples

| Project Type | Typical LOC | Estimated Tokens | Fits in |
|-------------|-------------|-----------------|---------|
| Microservice | 5-15K | 40-120K | 200K |
| Small app | 15-30K | 120-240K | 500K |
| Medium app | 30-60K | 240-480K | 1M |
| Large monolith | 60-150K | 480K-1.2M | Partial load |
| Monorepo | 150K+ | 1M+ | Directory-scoped only |
