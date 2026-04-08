---
name: vite-advanced
license: MIT
compatibility: "Claude Code 2.1.76+."
author: OrchestKit
description: Advanced Vite 8 patterns including Rolldown-powered builds, advancedChunks, Environment API, plugin development, SSR configuration, library mode, and build optimization. Use when customizing build pipelines, creating plugins, or configuring multi-environment builds.
context: fork
agent: frontend-ui-developer
version: 2.0.0
tags: [vite, vite8, rolldown, build, bundler, plugins, ssr, library-mode, environment-api, optimization, advancedchunks]
user-invocable: false
disable-model-invocation: true
complexity: medium
targets:
  - library: vite
    version: ">=8.0.0"
metadata:
  category: document-asset-creation
  vite-version: "8.0"
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
path_patterns: ["vite.config.*", "**/vite/**"]
---

# Vite Advanced Patterns

Advanced configuration for **Vite 8** (Rolldown-powered, stable Mar 2026) with Environment API from Vite 7.

## Vite 8: Rolldown-Powered Builds (Default)

Vite 8 replaces esbuild+Rollup with **Rolldown** (Rust-based unified bundler), delivering 7.7x faster builds and 50% less memory. This is now the default for all new projects.

```bash
npm install vite@8  # Direct upgrade
```

**Key improvements:**

| Metric | Vite 7 | Vite 8 | Improvement |
|--------|--------|--------|-------------|
| Build time (Linear) | 46s | 6s | **7.7x faster** |
| Dev server startup | ~3s | ~1s | **3x faster** |
| HMR updates | ~100ms | ~60ms | **40% faster** |
| Memory usage | ~800MB | ~400MB | **50% reduction** |

**Breaking changes from Vite 7:**
- `build.rollupOptions` → `build.rolldownOptions` (auto-converted with deprecation warning)
- `transformWithEsbuild` → `transformWithOxc`
- Plugin `transform()` returning JS must add `moduleType: 'js'` to return value
- `manualChunks` object form removed — use function form or `advancedChunks`
- `'system'` / `'amd'` output formats no longer supported
- Lightning CSS is now standard (replaces esbuild for CSS minification)
- Browser target bump: Chrome 107→111, Firefox 104→114, Safari 16.0→16.4

### advancedChunks (Replaces manualChunks)

Vite 8 introduces declarative chunk grouping with priority control and size constraints:

```typescript
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'react-vendor', test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/, priority: 20 },
            { name: 'ui-vendor', test: /[\\/]node_modules[\\/]@radix-ui[\\/]/, priority: 15, minShareCount: 2 },
            { name: 'vendor', test: /[\\/]node_modules[\\/]/, priority: 10, maxSize: 500000 },
          ],
        },
      },
    },
  },
})
```

Load Read("${CLAUDE_SKILL_DIR}/references/vite8-rolldown.md") for full migration options, benchmarks, advancedChunks syntax, Oxc benefits, and migration checklist.

## Environment API (from Vite 7, stable)

Multi-environment support (client/SSR/edge) is first-class:

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

Chunk splitting with `advancedChunks` (Vite 8, preferred) or `manualChunks` (Vite 7 legacy), tree shaking, minification, and bundle analysis.

Load Read("${CLAUDE_SKILL_DIR}/references/chunk-optimization.md") for chunk strategies, build targets, and optimization checklist.

## Quick Reference

| Feature | Vite 8 Status |
|---------|---------------|
| Rolldown bundler | **Default** (replaces esbuild+Rollup) |
| Environment API | Stable (from Vite 7) |
| ESM-only distribution | Default |
| Node.js requirement | 20.19+ or 22.12+ |
| `advancedChunks` | New (replaces `manualChunks`) |
| `buildApp` hook | Stable (for multi-env plugins) |
| `createBuilder` | Multi-env builds |
| Oxc integration | Parsing 3x faster than SWC |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| New projects | **Vite 8** (default) |
| Existing production apps | Evaluate Vite 8, use `rolldown-vite` for gradual migration |
| Multi-env builds | Environment API (`environments` config) |
| Plugin scope | Use `this.environment` for env-aware plugins |
| SSR | Middleware mode for dev, separate builds for prod |
| Chunks | `advancedChunks` for Vite 8, `manualChunks` for Vite 7 compat |

## Related Skills

- `biome-linting` - Fast linting alongside Vite
- `ork:react-server-components-framework` - SSR integration
- `edge-computing-patterns` - Edge environment builds
- `ork:storybook-testing` - Component testing with Vitest

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:

| File | Content |
|------|---------|
| `vite8-rolldown.md` | Rolldown migration, benchmarks, advancedChunks, Oxc benefits |
| `environment-api.md` | Multi-environment builds, Builder API, per-env plugins |
| `plugin-development.md` | Plugin hooks, virtual modules, HMR, env-aware transforms |
| `ssr-configuration.md` | Entry points, dev/prod servers, streaming SSR |
| `library-mode.md` | Building publishable npm packages |
| `chunk-optimization.md` | advancedChunks, manualChunks, tree shaking, bundle analysis |
