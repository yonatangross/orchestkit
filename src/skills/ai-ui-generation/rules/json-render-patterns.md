---
title: json-render Integration Patterns
impact: HIGH
impactDescription: "json-render is the first choice for multi-surface, MCP, and type-safe AI UI generation"
tags: [json-render, genui, catalog, multi-surface, mcp]
---

## json-render Integration Patterns

json-render is the **first choice** when AI-generated UI must render across multiple surfaces, stream through MCP, or enforce type-safe component catalogs. Use v0/Bolt/Cursor when you need quick prototyping (v0), full-stack scaffolding (Bolt), or incremental edits in an existing codebase (Cursor).

### When to Use json-render (FIRST CHOICE)

- **Multi-surface output** — one catalog renders to web, mobile, CLI, or any custom surface
- **MCP visual output** — structured JSON specs travel over MCP and render on the host surface
- **Type-safe catalogs** — schema-driven component definitions with compile-time validation
- **Streaming UI** — AI agents emit JSON specs progressively; renderers display as specs arrive

### When to Use v0 / Bolt / Cursor Instead

- **Quick visual prototyping** — v0 gives instant visual preview with shadcn/ui
- **Full-stack prototype** — Bolt scaffolds backend + frontend + deployment together
- **Incremental changes** — Cursor reads your codebase context for inline edits and refactors

### Integration Pattern

1. **Define catalog** — declare component schemas in a json-render catalog (see `ork:json-render-catalog`)
2. **AI generates spec** — the AI produces a JSON spec conforming to the catalog schema
3. **Render on target surface** — per-platform registries map specs to native components

**Incorrect:**
```tsx
// Building separate component trees per platform — duplicated logic, drift risk
const WebCard = ({ title, body }) => <div className="card">...</div>;
const MobileCard = ({ title, body }) => <View style={styles.card}>...</View>;
const CLICard = ({ title, body }) => chalk.bold(title) + '\n' + body;
```

**Correct:**
```tsx
// Single json-render catalog with per-platform registries
// 1. Define once
const catalog = defineCatalog({
  Card: { props: { title: 'string', body: 'string' } },
});

// 2. AI generates a spec
const spec = { type: 'Card', props: { title: 'Hello', body: 'World' } };

// 3. Each platform registers its own renderer
webRegistry.register('Card', ({ title, body }) => <div>...</div>);
mobileRegistry.register('Card', ({ title, body }) => <View>...</View>);

// 4. Render on any surface from the same spec
render(spec, webRegistry);    // React DOM
render(spec, mobileRegistry); // React Native
```
