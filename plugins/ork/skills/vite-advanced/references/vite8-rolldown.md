# Vite 8: Rolldown-Powered Builds

Vite 8 replaces the esbuild+Rollup pipeline with **Rolldown**, a Rust-based unified bundler delivering dramatic performance improvements.

## Migration Options

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

## Performance Benchmarks

Real-world improvements from production deployments:

| Metric | Before (Vite 7) | After (Vite 8) | Improvement |
|--------|-----------------|----------------|-------------|
| Linear build time | 46s | 6s | **7.7x faster** |
| Dev server startup | ~3s | ~1s | **3x faster** |
| HMR updates | ~100ms | ~60ms | **40% faster** |
| Memory usage | ~800MB | ~400MB | **50% reduction** |

## advancedChunks (Replaces manualChunks)

Vite 8 introduces `advancedChunks` with declarative grouping, priority control, and size constraints:

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            {
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20,
              minSize: 20000,
              maxSize: 250000,
            },
            {
              name: 'ui-vendor',
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              priority: 15,
              minShareCount: 2,
            },
            {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
              maxSize: 500000,
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

## When to Use Vite 7 vs Vite 8

| Scenario | Recommendation | Reason |
|----------|----------------|--------|
| New greenfield project | Vite 8 | Latest features, best performance |
| Existing stable production app | Vite 7 (evaluate 8) | Stability, proven track record |
| Build times > 30s | Vite 8 | Significant improvement |
| Complex plugin ecosystem | Vite 7 (test 8) | Some plugins may need updates |
| Monorepo with many packages | Vite 8 | Memory and speed benefits |
| Enterprise with strict stability | Vite 7 | LTS-style support |

## Full Bundle Mode (Upcoming)

Vite 8.1+ will introduce optional **Full Bundle Mode** for production builds:

```typescript
export default defineConfig({
  build: {
    // Preview API - may change
    fullBundleMode: true,
  },
})
```

Benefits: Single unified bundle (no code splitting), optimal for small apps/libraries/embedded contexts, eliminates chunk loading overhead, better for offline-first applications.

## Breaking Changes from Vite 7

### Config Renames
```js
build.rollupOptions      → build.rolldownOptions      // auto-converted w/ deprecation
worker.rollupOptions     → worker.rolldownOptions
transformWithEsbuild     → transformWithOxc
esbuild.jsx              → oxc.jsx
esbuild.define           → oxc.define
```

### Plugin API Changes
```js
// Plugins converting non-JS to JS MUST add moduleType
transform(code, id) {
  return { code: transformedCode, moduleType: 'js' }  // NEW — required in v8
}
```

Removed hooks: `shouldTransformCachedModule`, `resolveImportMeta`, `renderDynamicImport`, `resolveFileUrl`

### Other Breaking Changes
- `manualChunks` object form removed — use function form or `advancedChunks`
- `'system'` / `'amd'` output formats removed
- `import.meta.hot.accept(url)` → `accept(id)` (relative module id, not full URL)
- Lightning CSS is now standard (replaces esbuild for CSS minification)
- Browser target bump: Chrome 107→111, Firefox 104→114, Safari 16.0→16.4
- `@vitejs/plugin-react` v6: Babel removed, Oxc handles transforms

### New Config Options
```js
export default {
  devtools: true,                     // built-in Vite Devtools
  resolve: { tsconfigPaths: true },   // auto-resolve tsconfig paths
  server: { forwardConsole: true },   // forward browser console to CLI
}
```

## Oxc Integration Benefits

Rolldown is built on **Oxc** (Oxidation Compiler), providing:

- **Parsing**: 3x faster than SWC, 100x faster than Babel
- **Transformation**: Unified transform pipeline (replaces Babel in plugin-react v6)
- **Tree-shaking**: More aggressive dead code elimination
- **Scope hoisting**: Better than Rollup's implementation
- **Minification**: Oxc minifier (replaces esbuild minifier)

## Migration Checklist

```
[ ] build.rollupOptions → build.rolldownOptions
[ ] Plugin transform() returning JS: add moduleType: 'js'
[ ] Remove plugins using deleted hooks (shouldTransformCachedModule, etc.)
[ ] manualChunks object form → function form or advancedChunks
[ ] Remove 'system'/'amd' format usage
[ ] transformWithEsbuild → transformWithOxc
[ ] @vitejs/plugin-react → v6 (Babel config changes if using React Compiler)
[ ] Browser target: Chrome 111+, Firefox 114+, Safari 16.4+
[ ] Test with rolldown-vite first if risk-averse
[ ] Update CI/CD build time expectations
[ ] Verify source maps work correctly
```

**Status:** Vite 8.0.0 stable as of Mar 12, 2026. Recommended for all new projects; evaluate for existing production apps.
