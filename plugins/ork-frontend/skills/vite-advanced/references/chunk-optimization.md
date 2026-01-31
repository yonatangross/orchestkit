# Vite Build Optimization

Chunk splitting and build performance.

## Manual Chunks

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

1. [ ] Enable `manualChunks` for large vendors
2. [ ] Use dynamic imports for routes
3. [ ] Set appropriate `target` for audience
4. [ ] Remove console in production
5. [ ] Analyze bundle with visualizer
6. [ ] Check for duplicate dependencies
7. [ ] Ensure tree-shakeable imports
8. [ ] Set `sideEffects: false` in package.json
9. [ ] Consider CSS code splitting
10. [ ] Adjust `assetsInlineLimit` as needed
