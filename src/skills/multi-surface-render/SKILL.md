---
name: multi-surface-render
description: "Multi-surface rendering with json-render — same JSON spec produces React web, Next.js apps, React Native, Ink terminal UIs, PDFs, emails, Remotion videos, OG images, and 3D scenes. Covers renderer target selection, registry mapping, and platform-specific APIs (renderToBuffer, renderToStream, renderToFile). Use when generating output for multiple platforms, creating PDF reports, email templates, demo videos, or social media images from a single component spec."
tags: [json-render, multi-surface, pdf, email, remotion, video, image, react, rendering, ink, nextjs]
version: 1.1.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
context: inherit
persuasion-type: reference
metadata:
  category: frontend
  upstream-package: "@json-render/core"
  upstream-version-tested: "0.17.0"
---

# Multi-Surface Rendering with json-render

Define once, render everywhere. A single json-render catalog and spec can produce React web UIs, PDF reports, HTML emails, Remotion demo videos, and OG images — each surface gets its own registry that maps catalog types to platform-native components.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Target Selection](#target-selection) | 1 | HIGH | Choosing which renderer for your use case |
| [React Renderer](#react-renderer) | 1 | MEDIUM | Web apps, SPAs, dashboards |
| [PDF & Email Renderer](#pdf--email-renderer) | 1 | HIGH | Reports, documents, notifications |
| [Video & Image Renderer](#video--image-renderer) | 1 | MEDIUM | Demo videos, OG images, social cards |
| [Registry Mapping](#registry-mapping) | 1 | HIGH | Platform-specific component implementations |

**Total: 5 rules across 5 categories**

## How Multi-Surface Rendering Works

1. **One catalog** — Zod-typed component definitions shared across all surfaces
2. **One spec** — flat-tree JSON/YAML describing the UI structure
3. **Many registries** — each surface maps catalog types to its own component implementations
4. **Many renderers** — each package renders the spec using its registry

The catalog is the contract. The spec is the data. The registry is the platform-specific implementation.

## Quick Start — Same Catalog, Different Renderers

### Shared Catalog (used by all surfaces)

```typescript
import { defineCatalog } from '@json-render/core'
import { z } from 'zod'

export const catalog = defineCatalog({
  Heading: {
    props: z.object({
      text: z.string(),
      level: z.enum(['h1', 'h2', 'h3']),
    }),
    children: false,
  },
  Paragraph: {
    props: z.object({ text: z.string() }),
    children: false,
  },
  StatCard: {
    props: z.object({
      label: z.string(),
      value: z.string(),
      trend: z.enum(['up', 'down', 'flat']).optional(),
    }),
    children: false,
  },
})
```

### Render to Web (React)

```tsx
import { Renderer } from '@json-render/react'
import { catalog } from './catalog'
import { webRegistry } from './registries/web'

export const Dashboard = ({ spec }) => (
  <Renderer spec={spec} catalog={catalog} registry={webRegistry} />
)
```

### Render to PDF

```typescript
import { renderToBuffer, renderToFile } from '@json-render/react-pdf'
import { catalog } from './catalog'
import { pdfRegistry } from './registries/pdf'

// Buffer for HTTP response
const buffer = await renderToBuffer(spec, { catalog, registry: pdfRegistry })

// Direct file output
await renderToFile(spec, './output/report.pdf', { catalog, registry: pdfRegistry })
```

### Render to Email

```typescript
import { renderToHtml } from '@json-render/react-email'
import { catalog } from './catalog'
import { emailRegistry } from './registries/email'

const html = await renderToHtml(spec, { catalog, registry: emailRegistry })
await sendEmail({ to: user.email, subject: 'Weekly Report', html })
```

### Render to OG Image (Satori)

```typescript
import { renderToSvg, renderToPng } from '@json-render/image'
import { catalog } from './catalog'
import { imageRegistry } from './registries/image'

const png = await renderToPng(spec, {
  catalog,
  registry: imageRegistry,
  width: 1200,
  height: 630,
})
```

### Render to Video (Remotion)

```tsx
import { JsonRenderComposition } from '@json-render/remotion'
import { catalog } from './catalog'
import { remotionRegistry } from './registries/remotion'

export const DemoVideo = () => (
  <JsonRenderComposition
    spec={spec}
    catalog={catalog}
    registry={remotionRegistry}
    fps={30}
    durationInFrames={150}
  />
)
```

### Render to Terminal (Ink, 0.15+)

```tsx
import { render } from 'ink'
import { InkRenderer } from '@json-render/ink'
import { catalog } from './catalog'
import { inkRegistry } from './registries/ink'

render(<InkRenderer spec={spec} catalog={catalog} registry={inkRegistry} />)
```

Useful for `/ork:*` CLI dashboards and streaming agent chat interfaces — ships 20+ Ink-native components (Box, Text, Spinner, Table, Markdown, Progress, etc.).

### Render to Next.js App (0.16+)

```typescript
import { generateNextApp } from '@json-render/next'

await generateNextApp(spec, {
  catalog,
  registry: webRegistry,
  outDir: './out',
  // generates routes, layouts, SSR handlers, and metadata
})
```

Output is a full Next.js App Router project — specs describe route trees, not just components.

## Decision Matrix — When to Use Each Target

| Target | Package | When to Use | Output |
|--------|---------|-------------|--------|
| React | `@json-render/react` | Web apps, SPAs | JSX |
| Next.js | `@json-render/next` *(0.16+)* | Full apps: routes, layouts, SSR, metadata | Next.js app |
| Vue | `@json-render/vue` | Vue projects | Vue components |
| Svelte | `@json-render/svelte` | Svelte projects | Svelte components |
| Svelte+shadcn | `@json-render/shadcn-svelte` *(0.16+)* | 36-component Svelte 5 catalog | Svelte + Tailwind |
| React Native | `@json-render/react-native` | Mobile apps (25+ components) | Native views |
| Terminal | `@json-render/ink` *(0.15+)* | CLI UIs, TUIs, streaming chat | Ink (terminal) |
| PDF | `@json-render/react-pdf` | Reports, documents | PDF buffer/file |
| Email | `@json-render/react-email` | Notifications, digests | HTML string |
| Remotion | `@json-render/remotion` | Demo videos, marketing | MP4/WebM |
| Image | `@json-render/image` | OG images, social cards | SVG/PNG (Satori) |
| YAML | `@json-render/yaml` *(0.14+)* | Token optimization, streaming parser | YAML string |
| MCP | `@json-render/mcp` | Claude/Cursor/ChatGPT conversations | Sandboxed iframe |
| 3D | `@json-render/react-three-fiber` | 3D scenes (20 components, incl. `GaussianSplat` in 0.17) | Three.js canvas |
| Codegen | `@json-render/codegen` | Source code from specs | TypeScript/JSX |

Load `rules/target-selection.md` for detailed selection criteria and trade-offs.

## PDF Renderer — Reports and Documents

The `@json-render/react-pdf` package renders specs to PDF using react-pdf under the hood. Three output modes: buffer, file, and stream.

```typescript
import { renderToBuffer, renderToFile, renderToStream } from '@json-render/react-pdf'

// In-memory buffer (for HTTP responses, S3 upload)
const buffer = await renderToBuffer(spec, { catalog, registry: pdfRegistry })
res.setHeader('Content-Type', 'application/pdf')
res.send(buffer)

// Direct file write
await renderToFile(spec, './output/report.pdf', { catalog, registry: pdfRegistry })

// Streaming (for large documents)
const stream = await renderToStream(spec, { catalog, registry: pdfRegistry })
stream.pipe(res)
```

Load `rules/pdf-email-renderer.md` for PDF registry patterns and email rendering.

## Image Renderer — OG Images and Social Cards

The `@json-render/image` package uses Satori to convert specs to SVG, then optionally to PNG. Designed for server-side generation of social media images.

```typescript
import { renderToSvg, renderToPng } from '@json-render/image'

// SVG output (smaller, scalable)
const svg = await renderToSvg(spec, {
  catalog,
  registry: imageRegistry,
  width: 1200,
  height: 630,
})

// PNG output (universal compatibility)
const png = await renderToPng(spec, {
  catalog,
  registry: imageRegistry,
  width: 1200,
  height: 630,
})
```

Load `rules/video-image-renderer.md` for Satori constraints and Remotion composition patterns.

## Registry Mapping — Same Catalog, Platform-Specific Components

Each surface needs its own registry. The registry maps catalog types to platform-specific component implementations while the catalog and spec stay identical.

```typescript
// Web registry — uses HTML elements
const webRegistry = {
  Heading: ({ text, level }) => {
    const Tag = level // h1, h2, h3
    return <Tag className="font-bold">{text}</Tag>
  },
  StatCard: ({ label, value, trend }) => (
    <div className="rounded border p-4">
      <span className="text-sm text-gray-500">{label}</span>
      <strong className="text-2xl">{value}</strong>
    </div>
  ),
}

// PDF registry — uses react-pdf primitives
import { Text, View } from '@react-pdf/renderer'
const pdfRegistry = {
  Heading: ({ text, level }) => (
    <Text style={{ fontSize: level === 'h1' ? 24 : level === 'h2' ? 18 : 14 }}>
      {text}
    </Text>
  ),
  StatCard: ({ label, value }) => (
    <View style={{ border: '1pt solid #ccc', padding: 8 }}>
      <Text style={{ fontSize: 10, color: '#666' }}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{value}</Text>
    </View>
  ),
}
```

Load `rules/registry-mapping.md` for registry creation patterns and type safety.

## Rule Details

### Target Selection

Decision criteria for choosing the right renderer target.

| Rule | File | Key Pattern |
|------|------|-------------|
| Target Selection | `rules/target-selection.md` | Use case mapping, output format constraints |

### React Renderer

Web rendering with the `<Renderer>` component.

| Rule | File | Key Pattern |
|------|------|-------------|
| React Renderer | `rules/react-renderer.md` | `<Renderer>` component, streaming, error boundaries |

### PDF & Email Renderer

Server-side rendering to PDF buffers/files and HTML email strings.

| Rule | File | Key Pattern |
|------|------|-------------|
| PDF & Email | `rules/pdf-email-renderer.md` | renderToBuffer, renderToFile, renderToHtml |

### Video & Image Renderer

Remotion compositions and Satori image generation.

| Rule | File | Key Pattern |
|------|------|-------------|
| Video & Image | `rules/video-image-renderer.md` | JsonRenderComposition, renderToPng, renderToSvg |

### Registry Mapping

Creating platform-specific registries for a shared catalog.

| Rule | File | Key Pattern |
|------|------|-------------|
| Registry Mapping | `rules/registry-mapping.md` | Per-platform registries, type-safe mapping |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| PDF library | Use `@json-render/react-pdf` (react-pdf), not Puppeteer screenshots |
| Email rendering | Use `@json-render/react-email` (react-email), not MJML or custom HTML |
| OG images | Use `@json-render/image` (Satori), not Puppeteer or canvas |
| Video | Use `@json-render/remotion` (Remotion), not FFmpeg scripts |
| Registry per platform | Always separate registries; never one registry for all surfaces |
| Catalog sharing | One catalog definition shared via import across all registries |

## Common Mistakes

1. Building separate component trees for each surface — defeats the purpose; share the catalog and spec
2. Using Puppeteer to screenshot React for PDF generation — slow, fragile; use native react-pdf rendering
3. One giant registry covering all platforms — impossible since PDF uses `<View>`/`<Text>`, web uses `<div>`/`<span>`
4. Forgetting Satori limitations — no CSS grid, limited flexbox; design image registries with these constraints
5. Duplicating catalog definitions per surface — one catalog, many registries; the catalog is the contract

## Related Skills

- `ork:json-render-catalog` — Catalog definition patterns with Zod, shadcn components
- `ork:demo-producer` — Video production pipeline using Remotion
- `ork:presentation-builder` — Slide deck generation
- `ork:mcp-visual-output` — Rendering specs in Claude/Cursor via MCP
