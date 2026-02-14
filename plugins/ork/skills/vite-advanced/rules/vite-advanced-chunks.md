---
title: "Vite: Chunk Optimization"
category: vite
impact: HIGH
impactDescription: "Without chunk splitting, the entire app ships as one bundle — slow initial loads, no caching granularity, and vendor code re-downloaded on every app change."
tags: [vite, build, chunks, performance]
---

## Vite: Chunk Optimization

Use `advancedChunks` (Vite 8+) or `manualChunks` (Vite 7) to split vendor and application code into separate, cacheable chunks. Assign priorities to resolve conflicts and use `maxSize` to prevent oversized bundles.

**Incorrect:**
```typescript
// No chunk config — everything in a single monolithic bundle
export default defineConfig({
  build: { rollupOptions: {} },  // No advancedChunks or manualChunks
})
```

**Correct (Vite 8+ — advancedChunks):**
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
              priority: 30,
              minSize: 20000,
              maxSize: 200000,
            },
            {
              name: 'router',
              test: /[\\/]node_modules[\\/](react-router|react-router-dom)[\\/]/,
              priority: 25,
            },
            {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              priority: 5,
              maxSize: 500000,  // Auto-splits into vendor, vendor-1, etc.
            },
          ],
        },
      },
    },
  },
})
```

**Correct (Vite 7 — manualChunks):**
```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
        },
      },
    },
  },
})
```

**Key rules:**
- Separate framework deps into a dedicated vendor chunk with the highest priority so it caches independently from app code.
- Add a catch-all `vendor` group at lowest priority with `maxSize` to prevent oversized bundles.
- Use `minShareCount` for shared UI libraries — only extract when imported by 2+ routes.
- When migrating Vite 7 to 8, convert package arrays to regex and make implicit ordering explicit via `priority`.
- `manualChunks` is deprecated in Vite 8 — prefer `advancedChunks` for new projects.

Reference: `references/chunk-optimization.md`
