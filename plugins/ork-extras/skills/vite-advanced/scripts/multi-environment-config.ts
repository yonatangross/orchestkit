// Vite 7 Multi-Environment Configuration Template
// Copy and customize for your project

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],

  // Shared configuration (inherited by all environments)
  build: {
    sourcemap: process.env.NODE_ENV !== 'production',
    target: 'baseline-widely-available', // Vite 7 default
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  // Environment-specific configuration
  environments: {
    // =========================================
    // Client Environment (Browser)
    // =========================================
    client: {
      build: {
        outDir: 'dist/client',
        manifest: true, // Generate manifest for SSR
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              'router': ['react-router-dom'],
            },
          },
        },
      },
    },

    // =========================================
    // SSR Environment (Node.js)
    // =========================================
    ssr: {
      build: {
        outDir: 'dist/server',
        ssr: 'src/entry-server.tsx',
        target: 'node20',
        rollupOptions: {
          output: {
            format: 'esm',
          },
        },
      },
      // SSR-specific externals
      resolve: {
        // Don't bundle Node.js built-ins
        external: ['fs', 'path', 'http', 'stream'],
      },
    },

    // =========================================
    // Edge Environment (Workers)
    // =========================================
    edge: {
      resolve: {
        // Bundle all dependencies for edge
        noExternal: true,
        // Prioritize edge-compatible exports
        conditions: ['edge', 'worker', 'browser', 'import'],
      },
      build: {
        outDir: 'dist/edge',
        rollupOptions: {
          // Externalize platform-specific APIs
          external: ['cloudflare:workers', 'node:*'],
          output: {
            format: 'esm',
            // Single file output for edge
            inlineDynamicImports: true,
          },
        },
      },
    },
  },
})

// =========================================
// Usage with createBuilder (build script)
// =========================================
/*
// build.ts
import { createBuilder } from 'vite'
import config from './vite.config'

async function build() {
  const builder = await createBuilder(config)

  // Build all environments
  await builder.build()

  // Or build individually
  // await builder.build(builder.environments.client)
  // await builder.build(builder.environments.ssr)
  // await builder.build(builder.environments.edge)

  await builder.close()
}

build()
*/

// =========================================
// Package.json scripts
// =========================================
/*
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:client": "vite build --environment client",
    "build:ssr": "vite build --environment ssr",
    "build:edge": "vite build --environment edge",
    "preview": "vite preview"
  }
}
*/
