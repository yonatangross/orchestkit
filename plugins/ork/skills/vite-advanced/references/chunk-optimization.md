# Vite Build Optimization

Chunk splitting and build performance.

## advancedChunks (Vite 8+)

Vite 8 introduces `advancedChunks` as the recommended approach for chunk splitting. It provides declarative configuration with priority control and size constraints.

### Full Syntax

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            {
              // Required: Chunk name
              name: 'react-vendor',

              // Required: Module matching (regex or function)
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,

              // Optional: Higher priority wins when module matches multiple groups
              priority: 20,

              // Optional: Minimum chunk size in bytes (default: 0)
              minSize: 20000,  // 20KB

              // Optional: Maximum chunk size in bytes (auto-splits if exceeded)
              maxSize: 250000, // 250KB

              // Optional: Minimum number of chunks that must share this module
              minShareCount: 1,
            },
          ],
        },
      },
    },
  },
})
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | Required | Output chunk name |
| `test` | `RegExp \| (id: string) => boolean` | Required | Module matcher |
| `priority` | `number` | `0` | Higher wins on conflicts |
| `minSize` | `number` | `0` | Skip if chunk would be smaller |
| `maxSize` | `number` | `Infinity` | Auto-split if exceeded |
| `minShareCount` | `number` | `1` | Required shared imports |

### Complete Example

```typescript
// vite.config.ts - Production-ready advancedChunks
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            // Framework core - highest priority, always separate
            {
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 30,
              minSize: 20000,
              maxSize: 200000,
            },

            // Router - medium-high priority
            {
              name: 'router',
              test: /[\\/]node_modules[\\/](react-router|react-router-dom|@remix-run)[\\/]/,
              priority: 25,
            },

            // UI library - group all Radix components
            {
              name: 'radix-ui',
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              priority: 20,
              minShareCount: 2, // Only if used by 2+ routes
            },

            // Charts - large, load on demand
            {
              name: 'charts',
              test: /[\\/]node_modules[\\/](recharts|d3|victory)[\\/]/,
              priority: 15,
              maxSize: 300000, // Split if charts exceed 300KB
            },

            // Date libraries
            {
              name: 'dates',
              test: /[\\/]node_modules[\\/](date-fns|dayjs|luxon)[\\/]/,
              priority: 15,
            },

            // Catch-all vendor chunk
            {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              priority: 5,
              maxSize: 500000, // Auto-split large vendor chunks
            },
          ],
        },
      },
    },
  },
})
```

### Function-Based Test

For complex matching logic:

```typescript
advancedChunks: {
  groups: [
    {
      name: 'heavy-deps',
      test: (id) => {
        if (!id.includes('node_modules')) return false
        const heavyPackages = ['three', 'monaco-editor', 'pdf-lib']
        return heavyPackages.some(pkg => id.includes(`node_modules/${pkg}`))
      },
      priority: 25,
    },
  ],
}
```

---

## Manual Chunks (Vite 7 and Earlier)

> **Deprecation Notice (Vite 8):** `manualChunks` still works in Vite 8 for backward compatibility, but `advancedChunks` is the recommended approach. Consider migrating to `advancedChunks` for new projects or when updating existing configurations.

Split large dependencies into separate chunks:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for React
          'react-vendor': ['react', 'react-dom'],

          // Router chunk
          'router': ['react-router-dom'],

          // UI library chunk
          'ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],

          // Chart libraries
          'charts': ['recharts', 'd3'],
        },
      },
    },
  },
})
```

## Dynamic Manual Chunks

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // All node_modules in vendor chunk
          if (id.includes('node_modules')) {
            // Split by package name
            const match = id.match(/node_modules\/([^/]+)/)
            if (match) {
              const packageName = match[1]

              // Group related packages
              if (['react', 'react-dom', 'scheduler'].includes(packageName)) {
                return 'react-vendor'
              }

              if (packageName.startsWith('@radix-ui')) {
                return 'radix-vendor'
              }

              // Large packages get their own chunk
              if (['lodash', 'moment', 'three'].includes(packageName)) {
                return packageName
              }

              // Everything else in common vendor
              return 'vendor'
            }
          }
        },
      },
    },
  },
})
```

## Build Target

Vite 7 default: `'baseline-widely-available'`

```typescript
export default defineConfig({
  build: {
    target: 'baseline-widely-available', // Default in Vite 7
    // Or specific targets:
    // target: 'esnext',
    // target: 'es2022',
    // target: ['es2022', 'edge88', 'firefox78', 'chrome87', 'safari14'],
  },
})
```

## Minification

```typescript
export default defineConfig({
  build: {
    minify: 'esbuild', // Default, fastest
    // minify: 'terser', // More aggressive, slower

    // Terser options
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log
        drop_debugger: true,
      },
    },
  },
})
```

## Source Maps

```typescript
export default defineConfig({
  build: {
    sourcemap: false,           // No source maps (production)
    // sourcemap: true,         // Separate .map files
    // sourcemap: 'inline',     // Inline in JS (dev)
    // sourcemap: 'hidden',     // Maps for error reporting only
  },
})
```

## Tree Shaking

Ensure packages support tree shaking:

```json
// package.json of your lib
{
  "sideEffects": false,
  // Or specify files with side effects:
  "sideEffects": ["**/*.css", "./src/polyfills.js"]
}
```

## Analyze Bundle

```bash
# Install visualizer
npm install -D rollup-plugin-visualizer

# Or use npx
npx vite-bundle-visualizer
```

```typescript
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    visualizer({
      open: true,
      filename: 'stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
})
```

## CSS Optimization

```typescript
export default defineConfig({
  build: {
    cssCodeSplit: true, // Split CSS per entry point
    cssMinify: 'lightningcss', // Faster CSS minification
  },

  css: {
    devSourcemap: true, // CSS source maps in dev
  },
})
```

## Asset Inlining

```typescript
export default defineConfig({
  build: {
    assetsInlineLimit: 4096, // Inline assets < 4kb as base64
  },
})
```

## Chunk Size Warnings

```typescript
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 500, // Warn if chunk > 500kb
  },
})
```

## Dependency Optimization

```typescript
export default defineConfig({
  optimizeDeps: {
    // Pre-bundle these dependencies
    include: ['lodash-es', 'axios'],

    // Don't pre-bundle these
    exclude: ['@my/local-package'],

    // Force re-optimization
    force: true,
  },
})
```

## Quick Optimization Checklist

1. [ ] Use `advancedChunks` (Vite 8+) or `manualChunks` (Vite 7)
2. [ ] Use dynamic imports for routes
3. [ ] Set appropriate `target` for audience
4. [ ] Remove console in production
5. [ ] Analyze bundle with visualizer
6. [ ] Check for duplicate dependencies
7. [ ] Ensure tree-shakeable imports
8. [ ] Set `sideEffects: false` in package.json
9. [ ] Consider CSS code splitting
10. [ ] Adjust `assetsInlineLimit` as needed

---

## Migration: manualChunks to advancedChunks

When upgrading to Vite 8, convert your `manualChunks` configuration to `advancedChunks`.

### Example 1: Object-Based manualChunks

**Before (Vite 7):**
```typescript
manualChunks: {
  'react-vendor': ['react', 'react-dom'],
  'router': ['react-router-dom'],
  'ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
}
```

**After (Vite 8):**
```typescript
advancedChunks: {
  groups: [
    {
      name: 'react-vendor',
      test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
      priority: 20,
    },
    {
      name: 'router',
      test: /[\\/]node_modules[\\/]react-router-dom[\\/]/,
      priority: 15,
    },
    {
      name: 'ui',
      test: /[\\/]node_modules[\\/]@radix-ui[\\/]react-(dialog|dropdown-menu)[\\/]/,
      priority: 10,
    },
  ],
}
```

### Example 2: Function-Based manualChunks

**Before (Vite 7):**
```typescript
manualChunks(id) {
  if (id.includes('node_modules')) {
    if (id.includes('react') || id.includes('react-dom')) {
      return 'react-vendor'
    }
    if (id.includes('@radix-ui')) {
      return 'radix-vendor'
    }
    if (id.includes('lodash') || id.includes('moment')) {
      return 'utils'
    }
    return 'vendor'
  }
}
```

**After (Vite 8):**
```typescript
advancedChunks: {
  groups: [
    {
      name: 'react-vendor',
      test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
      priority: 30,
    },
    {
      name: 'radix-vendor',
      test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
      priority: 20,
    },
    {
      name: 'utils',
      test: /[\\/]node_modules[\\/](lodash|moment)[\\/]/,
      priority: 15,
    },
    {
      name: 'vendor',
      test: /[\\/]node_modules[\\/]/,
      priority: 5,
    },
  ],
}
```

### Example 3: Adding Size Constraints

One key benefit of `advancedChunks` is automatic chunk splitting based on size.

**Before (Vite 7):** No built-in size control
```typescript
manualChunks: {
  'vendor': ['lodash', 'moment', 'axios', 'd3', 'three'],
  // This could produce a 2MB chunk with no warning
}
```

**After (Vite 8):** Automatic splitting with maxSize
```typescript
advancedChunks: {
  groups: [
    {
      name: 'vendor',
      test: /[\\/]node_modules[\\/]/,
      priority: 5,
      maxSize: 250000, // Auto-split into vendor, vendor-1, vendor-2, etc.
    },
  ],
}
```

### Example 4: Shared Module Optimization

Use `minShareCount` to only chunk modules used by multiple entry points.

**After (Vite 8):**
```typescript
advancedChunks: {
  groups: [
    {
      name: 'shared-ui',
      test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
      priority: 15,
      minShareCount: 2, // Only if imported by 2+ chunks
    },
    {
      name: 'shared-utils',
      test: /[\\/]src[\\/]utils[\\/]/,
      priority: 10,
      minShareCount: 3, // Common utilities used across 3+ pages
      minSize: 5000,    // At least 5KB
    },
  ],
}
```

### Migration Tips

1. **Start with existing chunk names** - Keep the same `name` values for cache consistency
2. **Convert package arrays to regex** - `['react', 'react-dom']` becomes `/[\\/]node_modules[\\/](react|react-dom)[\\/]/`
3. **Add priorities** - Earlier items in manualChunks had implicit priority; make it explicit
4. **Add size constraints** - Use `maxSize` to prevent oversized chunks
5. **Test thoroughly** - Compare bundle output before/after with `rollup-plugin-visualizer`

### Compatibility Note

Both `manualChunks` and `advancedChunks` can coexist during migration, but `advancedChunks` takes precedence when both match the same module. For cleanest results, fully migrate to `advancedChunks`.
