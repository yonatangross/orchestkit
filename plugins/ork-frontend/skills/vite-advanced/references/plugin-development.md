# Vite Plugin Development

Creating custom Vite plugins.

## Basic Plugin Structure

```typescript
import type { Plugin } from 'vite'

export function myPlugin(options?: { debug?: boolean }): Plugin {
  return {
    name: 'my-plugin', // Required: unique plugin name

    // Hooks listed in execution order
    config(config, env) {
      // Modify config before resolution
      return {
        define: {
          __MY_PLUGIN__: JSON.stringify(true),
        },
      }
    },

    configResolved(config) {
      // Called once config is fully resolved
      if (options?.debug) {
        console.log('Resolved config:', config)
      }
    },

    configureServer(server) {
      // Add middleware or modify dev server
      server.middlewares.use((req, res, next) => {
        if (req.url === '/my-plugin-endpoint') {
          res.end('Hello from plugin')
          return
        }
        next()
      })
    },

    buildStart() {
      // Called at build start
    },

    resolveId(id) {
      // Custom module resolution
      if (id === 'virtual:my-module') {
        return '\0virtual:my-module'
      }
    },

    load(id) {
      // Load virtual modules
      if (id === '\0virtual:my-module') {
        return `export const data = ${JSON.stringify({ version: '1.0' })}`
      }
    },

    transform(code, id) {
      // Transform individual modules
      if (id.endsWith('.custom')) {
        return {
          code: transformCustomFormat(code),
          map: null,
        }
      }
    },

    buildEnd() {
      // Called after build completes
    },

    closeBundle() {
      // Cleanup after bundle is written
    },
  }
}
```

## Hook Execution Order

```
1. config          - Modify/extend config
2. configResolved  - Access final config
3. configureServer - Dev server setup (dev only)
4. buildStart      - Build begins
5. resolveId       - Resolve import paths
6. load            - Load module content
7. transform       - Transform module code
8. buildEnd        - Build complete
9. closeBundle     - Bundle written
```

## Virtual Modules

Generate modules at runtime:

```typescript
const virtualModuleId = 'virtual:my-data'
const resolvedVirtualModuleId = '\0' + virtualModuleId

export function virtualDataPlugin(data: Record<string, unknown>): Plugin {
  return {
    name: 'virtual-data',

    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId
      }
    },

    load(id) {
      if (id === resolvedVirtualModuleId) {
        return `export default ${JSON.stringify(data)}`
      }
    },
  }
}

// Usage in app:
// import data from 'virtual:my-data'
```

## Transform Hook Patterns

```typescript
export function transformPlugin(): Plugin {
  return {
    name: 'transform-plugin',

    transform(code, id) {
      // Only transform specific files
      if (!id.endsWith('.special.ts')) {
        return null
      }

      // Return transformed code
      return {
        code: code.replace(/PLACEHOLDER/g, 'REPLACED'),
        map: null, // Or source map
      }
    },
  }
}
```

## Using Rollup Plugins

Many Rollup plugins work in Vite:

```typescript
import { defineConfig } from 'vite'
import commonjs from '@rollup/plugin-commonjs'

export default defineConfig({
  plugins: [
    // Rollup plugins work in Vite
    commonjs(),
  ],
})
```

## Environment-Aware Plugins (Vite 7)

```typescript
export function envAwarePlugin(): Plugin {
  return {
    name: 'env-aware',

    transform(code, id) {
      // Access current environment
      const env = this.environment

      if (env.name === 'ssr') {
        return transformForServer(code)
      }

      return transformForClient(code)
    },
  }
}
```

## Applying Plugins Conditionally

```typescript
export function conditionalPlugin(): Plugin {
  let isDev: boolean

  return {
    name: 'conditional',

    configResolved(config) {
      isDev = config.command === 'serve'
    },

    transform(code, id) {
      if (isDev) {
        // Dev-only transformation
        return injectDevHelpers(code)
      }
      return null
    },
  }
}
```

## Plugin Ordering

```typescript
export function orderedPlugin(): Plugin {
  return {
    name: 'ordered',
    enforce: 'pre', // Run before core plugins
    // enforce: 'post' // Run after core plugins
  }
}
```

## Hot Module Replacement

```typescript
export function hmrPlugin(): Plugin {
  return {
    name: 'hmr-plugin',

    handleHotUpdate({ file, server }) {
      if (file.endsWith('.custom')) {
        // Custom HMR handling
        server.ws.send({
          type: 'custom',
          event: 'custom-update',
          data: { file },
        })
        return [] // Prevent default HMR
      }
    },
  }
}

// Client-side HMR handling:
// if (import.meta.hot) {
//   import.meta.hot.on('custom-update', (data) => {
//     console.log('Custom file updated:', data.file)
//   })
// }
```

## TypeScript Declarations

```typescript
// Type declarations for virtual module
declare module 'virtual:my-data' {
  const data: { version: string }
  export default data
}
```
