# Vite 7 Environment API

Multi-environment builds for client, SSR, and edge runtimes.

## Concept

Vite 6+ formalizes environments as a first-class concept. Each environment has its own:
- Module graph
- Configuration
- Plugin pipeline
- Build output

## Basic Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  // Shared config (inherited by all environments)
  build: {
    sourcemap: false,
  },

  environments: {
    // Browser client (default)
    client: {
      build: {
        outDir: 'dist/client',
        manifest: true,
      },
    },

    // Server-side rendering (Node.js)
    ssr: {
      build: {
        outDir: 'dist/server',
        target: 'node20',
        rollupOptions: {
          output: { format: 'esm' },
        },
      },
    },

    // Edge runtime (Cloudflare Workers, etc.)
    edge: {
      resolve: {
        noExternal: true, // Bundle all dependencies
        conditions: ['edge', 'worker'],
      },
      build: {
        outDir: 'dist/edge',
        rollupOptions: {
          external: ['cloudflare:workers'],
        },
      },
    },
  },
})
```

## Accessing Environments in Plugins

Plugins can access the current environment via `this.environment`:

```typescript
export function myPlugin(): Plugin {
  return {
    name: 'my-plugin',

    transform(code, id) {
      // Environment available in all hooks
      const env = this.environment

      if (env.name === 'ssr') {
        // SSR-specific transform
        return transformForSSR(code)
      }

      if (env.name === 'edge') {
        // Edge-specific transform
        return transformForEdge(code)
      }

      // Default client transform
      return transformForClient(code)
    },

    configureServer(server) {
      // Access specific environments
      const ssrEnv = server.environments.ssr
      const clientEnv = server.environments.client
    },
  }
}
```

## Per-Environment Plugins

Use `perEnvironmentPlugin` helper:

```typescript
import { perEnvironmentPlugin } from 'vite'

// Plugin only for SSR environment
export const ssrOnlyPlugin = perEnvironmentPlugin('ssr-only', (environment) => {
  if (environment.name !== 'ssr') {
    return null // Don't apply to other environments
  }

  return {
    transform(code, id) {
      // SSR-only transformation
    },
  }
})
```

## Builder API

For coordinated multi-environment builds:

```typescript
import { createBuilder } from 'vite'

async function build() {
  const builder = await createBuilder({
    environments: {
      client: { build: { outDir: 'dist/client' } },
      ssr: { build: { outDir: 'dist/server' } },
    },
  })

  // Build all environments in parallel
  await builder.build()

  // Or build individually
  await builder.build(builder.environments.client)
  await builder.build(builder.environments.ssr)

  // Cleanup
  await builder.close()
}
```

## buildApp Hook (Vite 7)

Plugins can coordinate environment builds:

```typescript
export function frameworkPlugin(): Plugin {
  return {
    name: 'framework-plugin',

    // Order: 'pre' runs before builder.buildApp, 'post' after
    buildApp: {
      order: 'pre',
      async handler(builder) {
        // Pre-build setup
        await prepareAssets()

        // Build specific environments
        await builder.build(builder.environments.client)

        // Check if environment already built
        if (!builder.environments.ssr.isBuilt) {
          await builder.build(builder.environments.ssr)
        }
      },
    },
  }
}
```

## Environment Instance API

```typescript
// In dev server
const server = await createServer()

const clientEnv = server.environments.client
const ssrEnv = server.environments.ssr

// Transform module in specific environment
const result = await ssrEnv.transformRequest('/src/app.js')

// Hot module handling
ssrEnv.hot.send({ type: 'custom', event: 'reload' })
```

## ModuleRunner (SSR)

Execute modules in the SSR environment:

```typescript
const ssrEnv = server.environments.ssr

// Import module through runner
const { render } = await ssrEnv.runner.import('/src/entry-server.js')

// Execute render
const html = await render(url)
```

## Real-World: Cloudflare Workers

The Cloudflare Vite plugin demonstrates Environment API:

```typescript
// Cloudflare plugin creates a custom environment
export default defineConfig({
  plugins: [cloudflare()],
  environments: {
    // Cloudflare Workers environment
    worker: {
      resolve: {
        conditions: ['workerd', 'worker', 'browser'],
      },
      build: {
        outDir: 'dist/worker',
        rollupOptions: {
          external: ['cloudflare:workers'],
        },
      },
    },
  },
})
```

## Node.js Requirements

Vite 7 requires:
- Node.js 20.19+ or
- Node.js 22.12+

These versions support `require(esm)` without a flag, enabling ESM-only distribution.
