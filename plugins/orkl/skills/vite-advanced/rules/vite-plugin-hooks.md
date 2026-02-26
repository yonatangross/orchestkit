---
title: Use correct Vite plugin hooks with enforce and apply modifiers to avoid silent failures
category: vite
impact: MEDIUM
impactDescription: "Using the wrong hook or missing enforce/apply modifiers causes plugins to silently fail, run at the wrong phase, or conflict with core Vite plugins."
tags: [vite, plugins, hooks, development]
---

## Vite: Plugin Hooks

Vite plugins follow a strict hook execution order inherited from Rollup. Choose the correct hook for each task and use `enforce`/`apply` to control when a plugin runs.

**Hook execution order:**
```
1. config          — Modify config before resolution
2. configResolved  — Access final config (read-only)
3. configureServer — Dev server setup (dev only)
4. buildStart      — Build begins
5. resolveId       — Resolve import paths to module IDs
6. load            — Provide module content for a resolved ID
7. transform       — Transform loaded module source code
8. buildEnd / closeBundle — Cleanup
```

**Incorrect:**
```typescript
// Wrong: transform can't create modules — virtual modules need resolveId + load
export function brokenVirtualPlugin(): Plugin {
  return {
    name: 'broken-virtual',
    transform(code, id) {
      if (id === 'virtual:my-data') {
        return `export default ${JSON.stringify({ key: 'value' })}`
      }
    },
  }
}
```

**Correct:**
```typescript
const VIRTUAL_ID = 'virtual:my-data'
const RESOLVED_ID = '\0' + VIRTUAL_ID

export function virtualDataPlugin(data: Record<string, unknown>): Plugin {
  return {
    name: 'virtual-data',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id === RESOLVED_ID) return `export default ${JSON.stringify(data)}`
    },
  }
}
```

**Correct — enforce and apply modifiers:**
```typescript
export function preProcessPlugin(): Plugin {
  return {
    name: 'pre-process',
    enforce: 'pre',    // Run BEFORE core Vite plugins
    apply: 'build',    // Only during vite build (not dev)
    transform(code, id) {
      if (!id.endsWith('.special.ts')) return null
      return { code: code.replace(/PLACEHOLDER/g, 'REPLACED'), map: null }
    },
  }
}
```

**Key rules:**
- Use `resolveId` + `load` for virtual modules; `transform` only modifies already-loaded source.
- Prefix resolved virtual IDs with `\0` to exclude them from other plugins and filesystem resolution.
- Set `enforce: 'pre'` to run before core plugins, `enforce: 'post'` to run after.
- Set `apply: 'build'` or `apply: 'serve'` to restrict a plugin to one mode.
- Access `this.environment` in hooks (Vite 6+) for environment-specific transforms.

Reference: `references/plugin-development.md`
