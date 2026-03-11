---
name: vite-advanced
license: MIT
compatibility: "Claude Code 2.1.72+."
author: OrchestKit
description: Advanced Vite 7+ patterns including Environment API, plugin development, SSR configuration, library mode, and build optimization. Use when customizing build pipelines, creating plugins, or configuring multi-environment builds.
context: fork
agent: frontend-ui-developer
version: 1.0.0
tags: [vite, build, bundler, plugins, ssr, library-mode, environment-api, optimization]
user-invocable: false
disable-model-invocation: true
complexity: medium
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Vite Advanced Patterns

Advanced configuration for Vite 7+ including Environment API.

## Vite 7 Environment API (Key 2026 Feature)

Multi-environment support (client/SSR/edge) is now first-class:

```typescript
export default defineConfig({
  environments: {
    client: { build: { outDir: 'dist/client' } },
    ssr: { build: { outDir: 'dist/server', ssr: true } },
  },
});
```

Load Read("${CLAUDE_SKILL_DIR}/references/environment-api.md") for full configuration, per-environment plugins, Builder API, and `buildApp` hook.

## Plugin Development

Hooks for `config`, `transform`, `resolveId`, `load`, virtual modules, HMR, and environment-aware transforms.

Load Read("${CLAUDE_SKILL_DIR}/references/plugin-development.md") for plugin structure, hook execution order, and advanced patterns.

## SSR Configuration

Middleware mode for dev, separate client/server builds for prod, streaming SSR support.

Load Read("${CLAUDE_SKILL_DIR}/references/ssr-configuration.md") for entry points, dev/prod server setup, and streaming patterns.

## Build Optimization

Chunk splitting with `manualChunks` (Vite 7) or `advancedChunks` (Vite 8+), tree shaking, minification, and bundle analysis.

Load Read("${CLAUDE_SKILL_DIR}/references/chunk-optimization.md") for chunk strategies, build targets, and optimization checklist.

## Quick Reference

| Feature | Vite 7 Status |
|---------|---------------|
| Environment API | Stable |
| ESM-only distribution | Default |
| Node.js requirement | 20.19+ or 22.12+ |
| `buildApp` hook | New for plugins |
| `createBuilder` | Multi-env builds |

## Vite 8: Rolldown-Powered Builds

Vite 8 replaces esbuild+Rollup with Rolldown (Rust-based), delivering 7.7x faster builds and 50% less memory. Introduces `advancedChunks` with declarative grouping, priority control, and size constraints. Stable as of Feb 2026.

Load Read("${CLAUDE_SKILL_DIR}/references/vite8-rolldown.md") for migration options, benchmarks, advancedChunks syntax, and migration checklist.

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Multi-env builds | Use Vite 7 Environment API |
| Plugin scope | Use `this.environment` for env-aware plugins |
| SSR | Middleware mode for dev, separate builds for prod |
| Chunks | Manual chunks for vendor/router separation |

## Related Skills

- `biome-linting` - Fast linting alongside Vite
- `ork:react-server-components-framework` - SSR integration
- `edge-computing-patterns` - Edge environment builds

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:

| File | Content |
|------|---------|
| `environment-api.md` | Multi-environment builds, Builder API, per-env plugins |
| `plugin-development.md` | Plugin hooks, virtual modules, HMR, env-aware transforms |
| `ssr-configuration.md` | Entry points, dev/prod servers, streaming SSR |
| `library-mode.md` | Building publishable npm packages |
| `chunk-optimization.md` | advancedChunks, manualChunks, tree shaking, bundle analysis |
| `vite8-rolldown.md` | Rolldown migration, benchmarks, advancedChunks, Oxc benefits |
