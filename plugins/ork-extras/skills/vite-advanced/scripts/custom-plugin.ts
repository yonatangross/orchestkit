// Custom Vite Plugin Template
// Copy and customize for your project

import type { Plugin, ResolvedConfig } from 'vite'

// =========================================
// Plugin Options Interface
// =========================================
interface MyPluginOptions {
  debug?: boolean
  include?: string[]
  exclude?: string[]
}

// =========================================
// Main Plugin Function
// =========================================
export function myPlugin(options: MyPluginOptions = {}): Plugin {
  // Plugin state
  let config: ResolvedConfig
  let isDev: boolean

  // Virtual module handling
  const virtualModuleId = 'virtual:my-plugin-data'
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  return {
    // Required: unique plugin name
    name: 'my-plugin',

    // Optional: run before/after core plugins
    // enforce: 'pre' | 'post',

    // =========================================
    // Configuration Hooks
    // =========================================

    // Modify config before resolution
    config(userConfig, env) {
      if (options.debug) {
        console.log('[my-plugin] config hook', env.mode)
      }

      // Return config modifications
      return {
        define: {
          __MY_PLUGIN_VERSION__: JSON.stringify('1.0.0'),
        },
      }
    },

    // Access resolved config
    configResolved(resolvedConfig) {
      config = resolvedConfig
      isDev = config.command === 'serve'

      if (options.debug) {
        console.log('[my-plugin] resolved config', {
          root: config.root,
          mode: config.mode,
          command: config.command,
        })
      }
    },

    // =========================================
    // Dev Server Hooks
    // =========================================

    // Configure dev server
    configureServer(server) {
      // Add custom middleware
      server.middlewares.use((req, res, next) => {
        if (req.url === '/__my-plugin') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ status: 'ok' }))
          return
        }
        next()
      })

      // Log startup
      if (options.debug) {
        console.log('[my-plugin] dev server configured')
      }
    },

    // =========================================
    // Build Hooks
    // =========================================

    buildStart() {
      if (options.debug) {
        console.log('[my-plugin] build started')
      }
    },

    // =========================================
    // Module Resolution Hooks
    // =========================================

    // Custom module resolution
    resolveId(id) {
      // Handle virtual module
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId
      }

      // Handle custom file extension
      if (id.endsWith('.custom')) {
        return id
      }

      return null // Let other plugins handle it
    },

    // Load module content
    load(id) {
      // Load virtual module
      if (id === resolvedVirtualModuleId) {
        return `
          export const version = '1.0.0'
          export const isDev = ${isDev}
          export const config = ${JSON.stringify(options)}
        `
      }

      return null
    },

    // =========================================
    // Transform Hooks
    // =========================================

    // Transform module code
    transform(code, id) {
      // Skip excluded files
      if (options.exclude?.some((pattern) => id.includes(pattern))) {
        return null
      }

      // Only transform included files
      if (options.include && !options.include.some((pattern) => id.includes(pattern))) {
        return null
      }

      // Example: Replace placeholders
      if (code.includes('__TIMESTAMP__')) {
        return {
          code: code.replace(/__TIMESTAMP__/g, Date.now().toString()),
          map: null, // Or generate source map
        }
      }

      return null
    },

    // =========================================
    // HMR Hooks
    // =========================================

    handleHotUpdate({ file, server }) {
      if (file.endsWith('.custom')) {
        // Custom HMR handling
        server.ws.send({
          type: 'custom',
          event: 'my-plugin:update',
          data: { file },
        })
        return [] // Prevent default HMR
      }
    },

    // =========================================
    // Build End Hooks
    // =========================================

    buildEnd(error) {
      if (error) {
        console.error('[my-plugin] build failed', error)
      } else if (options.debug) {
        console.log('[my-plugin] build completed')
      }
    },

    closeBundle() {
      // Cleanup after bundle is written
      if (options.debug) {
        console.log('[my-plugin] bundle closed')
      }
    },
  }
}

// =========================================
// TypeScript Declarations
// =========================================
declare module 'virtual:my-plugin-data' {
  export const version: string
  export const isDev: boolean
  export const config: Record<string, unknown>
}

// =========================================
// Usage
// =========================================
/*
// vite.config.ts
import { defineConfig } from 'vite'
import { myPlugin } from './plugins/my-plugin'

export default defineConfig({
  plugins: [
    myPlugin({
      debug: true,
      include: ['src/**'],
      exclude: ['node_modules'],
    }),
  ],
})

// In your app:
import { version, isDev } from 'virtual:my-plugin-data'
console.log('Plugin version:', version, 'Dev mode:', isDev)
*/
