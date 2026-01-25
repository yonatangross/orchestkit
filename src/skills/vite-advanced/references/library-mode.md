# Vite Library Mode

Building publishable npm packages.

## Basic Library Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    react(),
    dts({ include: ['src'] }), // Generate .d.ts files
  ],

  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MyLib', // Global variable name for UMD
      fileName: (format) => `my-lib.${format}.js`,
    },
    rollupOptions: {
      // Externalize dependencies that shouldn't be bundled
      external: ['react', 'react-dom'],
      output: {
        // Global variables for UMD build
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
})
```

## Package.json Setup

```json
{
  "name": "my-lib",
  "version": "1.0.0",
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
  "files": [
    "dist"
  ],
  "sideEffects": [
    "**/*.css"
  ],
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "vite": "^7.0.0",
    "vite-plugin-dts": "^4.0.0"
  },
  "scripts": {
    "build": "vite build",
    "dev": "vite"
  }
}
```

## Multiple Entry Points

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        utils: resolve(__dirname, 'src/utils/index.ts'),
        hooks: resolve(__dirname, 'src/hooks/index.ts'),
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
  },
})
```

With matching exports:

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./utils": {
      "import": "./dist/utils.js",
      "require": "./dist/utils.cjs",
      "types": "./dist/utils.d.ts"
    },
    "./hooks": {
      "import": "./dist/hooks.js",
      "require": "./dist/hooks.cjs",
      "types": "./dist/hooks.d.ts"
    }
  }
}
```

## CSS Handling

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
    },
    cssCodeSplit: false, // Bundle all CSS into one file
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
  },
})
```

For CSS modules with TypeScript:

```typescript
// vite.config.ts
export default defineConfig({
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
})
```

## Preserving File Structure

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        preserveModules: true, // Keep file structure
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
})
```

## TypeScript Declarations

Install and configure vite-plugin-dts:

```bash
npm install -D vite-plugin-dts
```

```typescript
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      exclude: ['src/**/*.test.ts', 'src/**/*.stories.tsx'],
      rollupTypes: true, // Bundle .d.ts files
    }),
  ],
})
```

## Development Testing

```typescript
// vite.config.ts
export default defineConfig(({ command }) => ({
  plugins: [react()],

  // Only apply library config for build
  ...(command === 'build' && {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
      },
    },
  }),
}))
```

## Pre-publish Checklist

```bash
# 1. Build
npm run build

# 2. Check output
ls -la dist/

# 3. Verify types
cat dist/index.d.ts

# 4. Test locally
cd ../test-project
npm link ../my-lib

# 5. Publish
npm publish
```
