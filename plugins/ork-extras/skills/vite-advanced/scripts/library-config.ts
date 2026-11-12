// Vite Library Mode Configuration Template
// For building publishable npm packages

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    // Generate TypeScript declarations
    dts({
      include: ['src'],
      exclude: ['src/**/*.test.ts', 'src/**/*.stories.tsx'],
      rollupTypes: true, // Bundle all declarations
    }),
  ],

  build: {
    // Library mode configuration
    lib: {
      // Entry point
      entry: resolve(__dirname, 'src/index.ts'),

      // Global variable name for UMD/IIFE builds
      name: 'MyLib',

      // Output file naming
      fileName: (format) => `my-lib.${format}.js`,

      // Output formats
      // formats: ['es', 'cjs', 'umd', 'iife'],
    },

    rollupOptions: {
      // Externalize peer dependencies
      external: ['react', 'react-dom', 'react/jsx-runtime'],

      output: {
        // Global variables for UMD build
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
        },

        // Preserve export names
        exports: 'named',
      },
    },

    // Build optimizations
    sourcemap: true,
    minify: 'esbuild',

    // CSS handling
    cssCodeSplit: false, // Single CSS file
  },
})

// =========================================
// Multiple Entry Points Configuration
// =========================================
/*
export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        utils: resolve(__dirname, 'src/utils/index.ts'),
        hooks: resolve(__dirname, 'src/hooks/index.ts'),
        components: resolve(__dirname, 'src/components/index.ts'),
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        // Preserve module structure
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
})
*/

// =========================================
// Package.json Configuration
// =========================================
/*
{
  "name": "my-lib",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/my-lib.cjs.js",
  "module": "./dist/my-lib.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/my-lib.es.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/my-lib.cjs.js"
      }
    },
    "./styles.css": "./dist/style.css"
  },
  "files": [
    "dist"
  ],
  "sideEffects": [
    "**\/*.css"
  ],
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.0.0",
    "vite": "^7.0.0",
    "vite-plugin-dts": "^4.0.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  }
}
*/

// =========================================
// Exports for Multiple Entry Points
// =========================================
/*
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
    },
    "./components": {
      "import": "./dist/components.js",
      "require": "./dist/components.cjs",
      "types": "./dist/components.d.ts"
    }
  }
}
*/
