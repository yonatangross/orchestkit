---
title: Configure Vite environment API to separate client and SSR build targets correctly
category: vite
impact: MEDIUM
impactDescription: "Mixing client and SSR configuration in a flat config causes wrong build targets, missing externals, or bundling server-only code into the client."
tags: [vite, environments, ssr, edge]
---

## Vite: Environment API

Vite 6+ treats environments (client, SSR, edge) as first-class concepts, each with its own module graph, config, plugin pipeline, and build output. Use `environments` config instead of mixing targets in top-level config.

**Incorrect:**
```typescript
// Flat config — SSR and client share the same target and externals
export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'node20',                            // Wrong for client!
    rollupOptions: { external: ['cloudflare:workers'] },  // Wrong for client!
  },
  ssr: { noExternal: ['some-package'] },  // Legacy SSR config
})
```

**Correct:**
```typescript
export default defineConfig({
  build: { sourcemap: false },  // Shared config

  environments: {
    client: {
      build: { outDir: 'dist/client', manifest: true },
    },
    ssr: {
      build: {
        outDir: 'dist/server',
        target: 'node20',
        rollupOptions: { output: { format: 'esm' } },
      },
    },
    edge: {
      resolve: { noExternal: true, conditions: ['edge', 'worker'] },
      build: {
        outDir: 'dist/edge',
        rollupOptions: { external: ['cloudflare:workers'] },
      },
    },
  },
})
```

**Correct — environment-aware plugins:**
```typescript
export function envAwarePlugin(): Plugin {
  return {
    name: 'env-aware',
    transform(code, id) {
      const env = this.environment  // Available in Vite 6+
      if (env.name === 'ssr') return transformForSSR(code)
      if (env.name === 'edge') return transformForEdge(code)
      return transformForClient(code)
    },
  }
}
```

**Key rules:**
- Put only shared settings at the top level; environment-specific settings go under `environments.client`, `environments.ssr`, etc.
- Each environment gets its own module graph and build output — never share `outDir` between environments.
- Use `this.environment` in hooks to branch per environment; use `perEnvironmentPlugin()` to skip environments entirely.
- For edge runtimes, set `resolve.noExternal: true` and `resolve.conditions` for edge-specific package exports.
- Vite 7 requires Node.js 20.19+ or 22.12+ for `require(esm)` support.

Reference: `references/environment-api.md`
