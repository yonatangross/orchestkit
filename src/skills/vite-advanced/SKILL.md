---
name: vite-advanced
license: MIT
compatibility: "Claude Code 2.1.220+."
author: OrchestKit
description: Advanced Vite 8 patterns including Rolldown-powered builds, advancedChunks, Environment API, plugin development, SSR configuration, library mode, and build optimization. Use when customizing build pipelines, creating plugins, or configuring multi-environment builds.
context: fork
agent: frontend-ui-developer
version: 2.0.0
tags: [vite, vite8, rolldown, build, bundler, plugins, ssr, library-mode, environment-api, optimization, advancedchunks]
user-invocable: false
disable-model-invocation: true
complexity: medium
persuasion-type: reference
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

A wrapper around **Vite 8** (Rolldown-powered), not a copy of its documentation.
Vite's own docs are the source of truth for config keys, API surface, and migration
mechanics. This skill carries the house delta plus four enforceable rules.

Vite 8 replaces the esbuild+Rollup pipeline with **Rolldown** (Rust-based unified
bundler) and is the default for new projects. `advancedChunks` supersedes
`manualChunks`; `build.rollupOptions` becomes `build.rolldownOptions`.

## Upstream coverage (do not restate)

Fetch these from Vite rather than expecting them here. Rows marked with a rule keep a
narrower, enforceable house subset in that rule file: read the rule for the house
position, fetch the doc for the full API.

| Topic | Fetch from |
|-------|------------|
| Vite 7 to 8 migration: `rolldownOptions`, `transformWithOxc`, `moduleType: 'js'`, removed hooks and output formats, browser target bumps | https://vite.dev/guide/migration |
| Rolldown adoption path, `rolldown-vite`, Oxc, `advancedChunks` group syntax (house subset stays in `rules/vite-advanced-chunks.md`) | https://vite.dev/guide/rolldown |
| Build options: `target`, `minify`, `sourcemap`, `cssCodeSplit`, `cssMinify`, `assetsInlineLimit`, `chunkSizeWarningLimit` | https://vite.dev/config/build-options |
| Dependency pre-bundling and `optimizeDeps` include/exclude/force | https://vite.dev/guide/dep-pre-bundling |
| SSR: client and server entry points, middleware-mode dev server, production server wiring, streaming | https://vite.dev/guide/ssr |
| Environment API config and per-environment build output (house subset stays in `rules/vite-environments.md`) | https://vite.dev/guide/api-environment |
| Environment API for plugins: `this.environment`, `perEnvironmentPlugin`, `applyToEnvironment` | https://vite.dev/guide/api-environment-plugins |
| Environment API for frameworks: `createBuilder`, `buildApp`, `ModuleRunner` | https://vite.dev/guide/api-environment-frameworks |
| Plugin hook reference, virtual modules, `enforce`/`apply`, `handleHotUpdate` (house subset stays in `rules/vite-plugin-hooks.md`) | https://vite.dev/guide/api-plugin |
| Env variables and modes, `.env` files, the `VITE_` prefix | https://vite.dev/guide/env-and-mode |
| Deploying a static site and verifying with `vite preview` | https://vite.dev/guide/static-deploy |

Library mode is not in the table: `references/library-mode.md` and
`rules/vite-lib-config.md` still carry it in full.

## House delta

Read `${CLAUDE_SKILL_DIR}/references/ork-delta.md` for the rules Vite's docs do not
state: the Vite 8 adoption path for existing production apps, the `VITE_` secrets
rule, the production sourcemap setting, the house build budget, the `vite preview`
gate, chunk-name stability across the `advancedChunks` migration, the visualizer
diff requirement, and the `node_modules/.vite` cache-clearing step.

## House config

Not a Vite tutorial: these are the settings the delta above makes non-negotiable, in the
shape we actually ship them.

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // 'hidden' emits maps for the error reporter without publishing source.
    // Never true (publishes source) and never 'inline' (inflates every JS file).
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        // Carry existing chunk NAMES across the manualChunks to advancedChunks
        // migration. A renamed group changes its filename and invalidates that
        // chunk for every returning visitor, even with identical contents.
        advancedChunks: {
          groups: [
            { name: 'vendor', test: /node_modules/, priority: 10 },
            { name: 'app', priority: 0 },
          ],
        },
      },
    },
  },
});
```

```bash
# Prove the build. `vite build` exiting 0 means the bundler finished, not that the
# app runs: base-path mistakes and dev-only env vars survive a green build.
vite build && vite preview      # then walk the routes, console must be clean

# Diff the chunk graph before and after any chunk-config change.
npx vite-bundle-visualizer

# Stale pre-bundle cache mimics a broken plugin. Clear it BEFORE editing plugin code.
rm -rf node_modules/.vite && vite --force
```

> `VITE_`-prefixed variables are inlined into the client bundle at build time. They are
> public bundle content, never secrets. Audit `.env.production` before deploy.

## Rules

| Rule | Covers |
|------|--------|
| `rules/vite-advanced-chunks.md` | Chunk splitting: `advancedChunks` groups, priority, `maxSize`, `minShareCount` |
| `rules/vite-environments.md` | `environments` config for client, SSR, and edge; per-environment `outDir` |
| `rules/vite-lib-config.md` | Library mode externals, dual ESM/CJS output, `exports` map, type declarations |
| `rules/vite-plugin-hooks.md` | Hook order, virtual modules via `resolveId` + `load`, `enforce` and `apply` |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| New projects | **Vite 8** (default) |
| Existing production apps | Stage the upgrade through `rolldown-vite` before committing |
| Multi-env builds | Environment API (`environments` config) |
| Plugin scope | Use `this.environment` for env-aware plugins |
| SSR | Middleware mode for dev, separate builds for prod |
| Chunks | `advancedChunks` for Vite 8, `manualChunks` for Vite 7 compat |

## Related Skills

- `ork:react-server-components-framework` - SSR integration
- `ork:storybook-testing` - Component testing with Vitest
- `ork:performance` - Core Web Vitals targets behind the build budget

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:

| File | Content |
|------|---------|
| `ork-delta.md` | House rules that Vite's docs do not state |
| `library-mode.md` | Building publishable npm packages |
