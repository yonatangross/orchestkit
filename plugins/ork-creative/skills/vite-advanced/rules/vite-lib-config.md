---
title: Configure Vite library mode with correct externals, exports, and type declarations
category: vite
impact: HIGH
impactDescription: "Bundling peer dependencies into a library inflates consumer bundles with duplicates; missing exports or type declarations break downstream TypeScript projects."
tags: [vite, library, npm, build]
---

## Vite: Library Mode

Configure `build.lib` with proper entry points, externalize peer dependencies, and provide dual ESM/CJS output with TypeScript declarations.

**Incorrect:**
```typescript
// Bundles React into the library — consumers get duplicate React
export default defineConfig({
  build: {
    lib: { entry: resolve(__dirname, 'src/index.ts'), formats: ['es'] },
    // Missing rollupOptions.external — peer deps are bundled
  },
})
```

**Correct:**
```typescript
import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts({ include: ['src'], rollupTypes: true })],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MyLib',
      fileName: (format) => `my-lib.${format}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: { react: 'React', 'react-dom': 'ReactDOM' },
      },
    },
  },
})
```

```json
{
  "name": "my-lib",
  "type": "module",
  "main": "./dist/my-lib.umd.js",
  "module": "./dist/my-lib.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/my-lib.es.js",
      "require": "./dist/my-lib.umd.js",
      "types": "./dist/index.d.ts"
    },
    "./styles.css": "./dist/style.css"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "sideEffects": ["**/*.css"]
}
```

**Key rules:**
- Always externalize peer dependencies via `rollupOptions.external` — never bundle them.
- Provide dual formats: ESM (`module`) for bundlers and UMD/CJS (`main`) for legacy consumers; use `exports` map.
- Generate TypeScript declarations with `vite-plugin-dts`; set `"types"` in top-level and each `exports` entry.
- Mark CSS in `"sideEffects"` so bundlers preserve styles during tree-shaking.
- For multi-entry libraries, use an object `entry` and match keys to `exports` subpaths.

Reference: `references/library-mode.md`
