# Renderer API Reference

## @json-render/react

### `<Renderer>` Component

```tsx
import { Renderer } from '@json-render/react'

<Renderer
  spec={spec}                    // JsonRenderSpec — flat-tree JSON/YAML
  catalog={catalog}              // Catalog from defineCatalog()
  registry={registry}            // CatalogComponents<typeof catalog>
  fallback={<Loading />}         // Optional: shown during streaming
  onError={(err) => log(err)}    // Optional: error callback
/>
```

### `useStreamingSpec` Hook

```tsx
import { useStreamingSpec } from '@json-render/react'

const spec = useStreamingSpec(stream) // ReadableStream of JSON Patch ops
```

---

## @json-render/react-pdf

### `renderToBuffer(spec, options): Promise<Buffer>`

Renders spec to an in-memory PDF buffer.

```typescript
import { renderToBuffer } from '@json-render/react-pdf'

const buffer = await renderToBuffer(spec, {
  catalog,
  registry: pdfRegistry,
  pageSize: 'A4',               // Optional: 'A4' | 'LETTER' | { width, height }
  orientation: 'portrait',      // Optional: 'portrait' | 'landscape'
  margins: { top: 40, bottom: 40, left: 40, right: 40 }, // Optional
})
```

### `renderToFile(spec, path, options): Promise<void>`

Renders spec directly to a PDF file on disk.

```typescript
import { renderToFile } from '@json-render/react-pdf'

await renderToFile(spec, './output/report.pdf', {
  catalog,
  registry: pdfRegistry,
  pageSize: 'A4',
})
```

### `renderToStream(spec, options): Promise<ReadableStream>`

Renders spec to a readable stream for piping to HTTP responses.

```typescript
import { renderToStream } from '@json-render/react-pdf'

const stream = await renderToStream(spec, { catalog, registry: pdfRegistry })
res.setHeader('Content-Type', 'application/pdf')
res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"')
stream.pipe(res)
```

---

## @json-render/react-email

### `renderToHtml(spec, options): Promise<string>`

Renders spec to an HTML string optimized for email clients.

```typescript
import { renderToHtml } from '@json-render/react-email'

const html = await renderToHtml(spec, {
  catalog,
  registry: emailRegistry,
  preview: 'Your weekly report is ready', // Optional: email preview text
  theme: 'light',                          // Optional: 'light' | 'dark'
})
```

### `renderToPlainText(spec, options): Promise<string>`

Renders spec to plain text (for text/plain multipart emails).

```typescript
import { renderToPlainText } from '@json-render/react-email'

const text = await renderToPlainText(spec, { catalog, registry: emailRegistry })
```

---

## @json-render/image

### `renderToSvg(spec, options): Promise<string>`

Renders spec to an SVG string using Satori.

```typescript
import { renderToSvg } from '@json-render/image'

const svg = await renderToSvg(spec, {
  catalog,
  registry: imageRegistry,
  width: 1200,              // Required
  height: 630,              // Required
  fonts: [{                 // Optional: custom fonts
    name: 'Inter',
    data: fontBuffer,
    weight: 400,
    style: 'normal',
  }],
})
```

### `renderToPng(spec, options): Promise<Buffer>`

Renders spec to a PNG buffer (SVG -> PNG via Resvg).

```typescript
import { renderToPng } from '@json-render/image'

const png = await renderToPng(spec, {
  catalog,
  registry: imageRegistry,
  width: 1200,
  height: 630,
})
```

---

## @json-render/remotion

### `<JsonRenderComposition>` Component

```tsx
import { JsonRenderComposition } from '@json-render/remotion'

<JsonRenderComposition
  spec={spec}                    // JsonRenderSpec
  catalog={catalog}              // Catalog from defineCatalog()
  registry={remotionRegistry}    // Registry with Remotion animations
  fps={30}                       // Frames per second
  durationInFrames={150}         // Total duration
  width={1920}                   // Video width
  height={1080}                  // Video height
/>
```

### Remotion Registry with Animations

```tsx
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'

const remotionRegistry = {
  Heading: ({ text, level }) => {
    const frame = useCurrentFrame()
    const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })
    return <h1 style={{ opacity, fontSize: level === 'h1' ? 48 : 36 }}>{text}</h1>
  },
}
```

---

## Common Options (all renderers)

| Option | Type | Description |
|--------|------|-------------|
| `catalog` | `Catalog` | Required. Zod-typed component definitions |
| `registry` | `CatalogComponents` | Required. Platform-specific component map |
| `spec` | `JsonRenderSpec` | Required. Flat-tree JSON/YAML spec |
| `onError` | `(err: Error) => void` | Optional. Error handler |
