---
title: "json-render Package Ecosystem"
version: 1.0.0
---

# json-render Package Ecosystem

23 packages under the `@json-render` scope, organized by category. All packages share the same spec format — a spec generated for React works with Vue, Svelte, React Native, PDF, and email renderers.

## Foundation

| Package | Purpose |
|---------|---------|
| `@json-render/core` | `defineCatalog()`, `mergeCatalogs()`, spec validation, type utilities |

## Web Renderers

| Package | Framework | Notes |
|---------|-----------|-------|
| `@json-render/react` | React 18/19 | `<Render>` component, hooks, streaming support |
| `@json-render/vue` | Vue 3 | `<Render>` component, composables |
| `@json-render/svelte` | Svelte 5 | `<Render>` component, runes-compatible |
| `@json-render/solid` | SolidJS | `<Render>` component, fine-grained reactivity |

## Component Libraries

| Package | Components | Notes |
|---------|------------|-------|
| `@json-render/shadcn` | 29 | shadcn/ui components with Zod schemas and implementations |

## Mobile

| Package | Platform | Notes |
|---------|----------|-------|
| `@json-render/react-native` | iOS / Android | 25+ components, Expo and bare RN support |

## Output Renderers

| Package | Output | Notes |
|---------|--------|-------|
| `@json-render/react-pdf` | PDF | Generates PDF documents from specs via react-pdf |
| `@json-render/react-email` | Email HTML | Email-safe HTML from specs via react-email |
| `@json-render/image` | PNG / SVG | Renders specs to images via Satori |
| `@json-render/remotion` | Video | Animated specs rendered as video via Remotion |
| `@json-render/yaml` | YAML specs | Parse/stringify YAML format specs (30% fewer tokens) |

## 3D

| Package | Purpose | Notes |
|---------|---------|-------|
| `@json-render/react-three-fiber` | 3D scenes | WebGL rendering via React Three Fiber |

## MCP (Model Context Protocol)

| Package | Purpose | Notes |
|---------|---------|-------|
| `@json-render/mcp` | MCP tool output | Render specs as MCP tool results for AI agents |

## Code Generation

| Package | Purpose | Notes |
|---------|---------|-------|
| `@json-render/codegen` | JSX/TSX output | Convert specs to static React/Vue/Svelte component code |

## State Adapters

| Package | Library | Notes |
|---------|---------|-------|
| `@json-render/redux` | Redux Toolkit | Bidirectional state sync with Redux store |
| `@json-render/zustand` | Zustand | Adapter for Zustand stores |
| `@json-render/jotai` | Jotai | Atom-based state adapter |
| `@json-render/xstate` | XState 5 | State machine adapter for complex workflows |

## Installation Patterns

**Minimal (React + custom catalog):**
```bash
npm install @json-render/core @json-render/react zod
```

**With shadcn components:**
```bash
npm install @json-render/core @json-render/react @json-render/shadcn zod
```

**Cross-platform (web + mobile + PDF):**
```bash
npm install @json-render/core @json-render/react @json-render/react-native @json-render/react-pdf zod
```

**With YAML optimization:**
```bash
npm install @json-render/core @json-render/react @json-render/yaml zod
```

**With state management (Zustand example):**
```bash
npm install @json-render/core @json-render/react @json-render/zustand zod zustand
```

## Write Once, Render Anywhere

The key value proposition: a single spec works across all renderers. Generate a dashboard spec once, render it as:
- Interactive web UI (`@json-render/react`)
- Mobile app (`@json-render/react-native`)
- PDF report (`@json-render/react-pdf`)
- Email digest (`@json-render/react-email`)
- Static image (`@json-render/image`)

The catalog + spec is the shared contract. Each renderer maps catalog types to platform-specific implementations.
