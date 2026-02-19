---
name: vite-advanced
license: MIT
compatibility: "Claude Code 2.1.47+."
author: OrchestKit
description: Advanced Vite 7+ patterns including Environment API, plugin development, SSR configuration, library mode, and build optimization. Use when customizing build pipelines, creating plugins, or configuring multi-environment builds.
context: fork
agent: frontend-ui-developer
version: 1.0.0
tags: [vite, build, bundler, plugins, ssr, library-mode, environment-api, optimization]
user-invocable: false
complexity: medium
metadata:
  category: document-asset-creation
---

# Vite Advanced Patterns

Advanced configuration for Vite 7+ including Environment API.

## Vite 7 Environment API (Key 2026 Feature)

Multi-environment support is now first-class:

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  environments: {
    // Browser client
    client: {
      build: {
        outDir: 'dist/client',
        manifest: true,
      },
    },
    // Node.js SSR
    ssr: {
      build: {
        outDir: 'dist/server',
        target: 'node20',
      },
    },
    // Edge runtime (Cloudflare, etc.)
    edge: {
      resolve: {
        noExternal: true,
        conditions: ['edge', 'worker'],
      },
      build: {
        outDir: 'dist/edge',
      },
    },
  },
})
```

**Key Changes:**
- Environments have their own module graph
- Plugins access `this.environment` in hooks
- `createBuilder` API for coordinated builds
- Node.js 20.19+ or 22.12+ required

## Plugin Development

Basic plugin structure:

```typescript
export function myPlugin(): Plugin {
  return {
    name: 'my-plugin',

    // Called once when config is resolved
    configResolved(config) {
      // Access resolved config
    },

    // Transform individual modules
    transform(code, id) {
      // this.environment available in Vite 7+
      if (id.endsWith('.special')) {
        return { code: transformCode(code) }
      }
    },

    // Virtual modules
    resolveId(id) {
      if (id === 'virtual:my-module') {
        return '\0virtual:my-module'
      }
    },
    load(id) {
      if (id === '\0virtual:my-module') {
        return 'export const value = "generated"'
      }
    },
  }
}
```

## SSR Configuration

Development (middleware mode):

```typescript
import { createServer } from 'vite'

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
})

app.use('*', async (req, res) => {
  const url = req.originalUrl
  let template = fs.readFileSync('index.html', 'utf-8')
  template = await vite.transformIndexHtml(url, template)

  const { render } = await vite.ssrLoadModule('/src/entry-server.tsx')
  const html = template.replace('<!--outlet-->', await render(url))

  res.send(html)
})
```

Production build scripts:

```json
{
  "scripts": {
    "build:client": "vite build --outDir dist/client",
    "build:server": "vite build --outDir dist/server --ssr src/entry-server.tsx"
  }
}
```

## Build Optimization

```typescript
export default defineConfig({
  build: {
    target: 'baseline-widely-available', // Vite 7 default
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
        },
      },
    },
  },
})
```

## Quick Reference

| Feature | Vite 7 Status |
|---------|---------------|
| Environment API | Stable |
| ESM-only distribution | Default |
| Node.js requirement | 20.19+ or 22.12+ |
| `buildApp` hook | New for plugins |
| `createBuilder` | Multi-env builds |

## Vite 8: Rolldown-Powered Builds

Vite 8 replaces the esbuild+Rollup pipeline with **Rolldown**, a Rust-based unified bundler delivering dramatic performance improvements.

### Migration Options

**Option 1: Direct Upgrade to Vite 8**
```bash
npm install vite@8
```
Best for: New projects, smaller codebases, teams ready to adopt cutting-edge tooling.

**Option 2: Gradual Migration with rolldown-vite**
```bash
npm install rolldown-vite
```
```typescript
// vite.config.ts - swap import only
import { defineConfig } from 'rolldown-vite' // instead of 'vite'

export default defineConfig({
  // Existing config works unchanged
})
```
Best for: Large production apps, risk-averse teams, testing Rolldown before full commitment.

### Performance Benchmarks

Real-world improvements from production deployments:

| Metric | Before (Vite 7) | After (Vite 8) | Improvement |
|--------|-----------------|----------------|-------------|
| Linear build time | 46s | 6s | **7.7x faster** |
| Dev server startup | ~3s | ~1s | **3x faster** |
| HMR updates | ~100ms | ~60ms | **40% faster** |
| Memory usage | ~800MB | ~400MB | **50% reduction** |

### advancedChunks (Replaces manualChunks)

Vite 8 introduces `advancedChunks` with declarative grouping, priority control, and size constraints:

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // NEW: advancedChunks replaces manualChunks
        advancedChunks: {
          groups: [
            {
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20,
              minSize: 20000,      // 20KB minimum
              maxSize: 250000,     // 250KB maximum
            },
            {
              name: 'ui-vendor',
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              priority: 15,
              minShareCount: 2,    // Must be used by 2+ chunks
            },
            {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
              maxSize: 500000,     // Auto-split if exceeds 500KB
            },
          ],
        },
      },
    },
  },
})
```

**Key Differences from manualChunks:**

| Feature | manualChunks | advancedChunks |
|---------|--------------|----------------|
| Syntax | Function or object | Declarative groups array |
| Priority control | Manual ordering | Explicit `priority` field |
| Size constraints | None | `minSize`, `maxSize` |
| Shared module handling | Manual | `minShareCount` |
| Regex support | Via function | Native `test` field |

### When to Use Vite 7 vs Vite 8

| Scenario | Recommendation | Reason |
|----------|----------------|--------|
| New greenfield project | Vite 8 | Latest features, best performance |
| Existing stable production app | Vite 7 (evaluate 8) | Stability, proven track record |
| Build times > 30s | Vite 8 | Significant improvement |
| Complex plugin ecosystem | Vite 7 (test 8) | Some plugins may need updates |
| Monorepo with many packages | Vite 8 | Memory and speed benefits |
| Enterprise with strict stability | Vite 7 | LTS-style support |

### Full Bundle Mode (Upcoming)

Vite 8.1+ will introduce optional **Full Bundle Mode** for production builds:

```typescript
export default defineConfig({
  build: {
    // Preview API - may change
    fullBundleMode: true,
  },
})
```

Benefits:
- Single unified bundle (no code splitting)
- Optimal for small apps, libraries, or embedded contexts
- Eliminates chunk loading overhead
- Better for offline-first applications

### Oxc Integration Benefits

Rolldown is built on **Oxc** (Oxidation Compiler), providing:

- **Parsing**: 3x faster than SWC, 100x faster than Babel
- **Transformation**: Unified transform pipeline
- **Tree-shaking**: More aggressive dead code elimination
- **Scope hoisting**: Better than Rollup's implementation
- **Minification**: Oxc minifier (optional, in development)

```typescript
export default defineConfig({
  build: {
    // Future Oxc minifier option (when stable)
    // minify: 'oxc',
  },
})
```

### Migration Checklist

```
[ ] Review plugin compatibility (most work unchanged)
[ ] Test with rolldown-vite first if risk-averse
[ ] Replace manualChunks with advancedChunks
[ ] Remove esbuild-specific workarounds (no longer needed)
[ ] Update CI/CD build time expectations
[ ] Test HMR behavior (should be faster, same API)
[ ] Verify source maps work correctly
```

**Status:** Vite 8 stable as of Feb 2026. Recommended for new projects; evaluate for existing production apps.

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Multi-env builds | Use Vite 7 Environment API |
| Plugin scope | Use `this.environment` for env-aware plugins |
| SSR | Middleware mode for dev, separate builds for prod |
| Chunks | Manual chunks for vendor/router separation |

## Related Skills

- `biome-linting` - Fast linting alongside Vite
- `react-server-components-framework` - SSR integration
- `edge-computing-patterns` - Edge environment builds

## References

- [Environment API](references/environment-api.md) - Multi-environment builds
- [Plugin Development](references/plugin-development.md) - Plugin hooks
- [SSR Configuration](references/ssr-configuration.md) - SSR setup
- [Library Mode](references/library-mode.md) - Building packages
- [Chunk Optimization](references/chunk-optimization.md) - Build optimization
