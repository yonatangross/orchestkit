---
title: Select renderer target based on output format and platform constraints
impact: HIGH
impactDescription: "Wrong target selection leads to building custom renderers when packages exist, or using web renderers for non-web surfaces"
tags: [target, renderer, selection, pdf, email, video, image, react]
---

## Target Selection

Choose the renderer target based on what the output is, not what framework you use. Each target maps to a specific `@json-render/*` package with its own rendering pipeline.

**Incorrect — building separate templates for each surface:**
```typescript
// WRONG: Separate template systems, no shared catalog
const webDashboard = buildReactComponents(data)
const pdfReport = buildPdfWithPuppeteer(data)     // puppeteer screenshot
const emailDigest = buildMjmlEmail(data)           // separate MJML templates
const ogImage = buildCanvasImage(data)             // manual canvas drawing
```

**Correct — one catalog, one spec, multiple registries:**
```typescript
import { catalog } from './catalog'

// Same spec, different renderers
import { Renderer } from '@json-render/react'           // web
import { renderToBuffer } from '@json-render/react-pdf' // pdf
import { renderToHtml } from '@json-render/react-email' // email
import { renderToPng } from '@json-render/image'        // og image

// Each renderer uses the same catalog + spec, different registry
const webUi = <Renderer spec={spec} catalog={catalog} registry={webRegistry} />
const pdf = await renderToBuffer(spec, { catalog, registry: pdfRegistry })
const html = await renderToHtml(spec, { catalog, registry: emailRegistry })
const png = await renderToPng(spec, { catalog, registry: imageRegistry, width: 1200, height: 630 })
```

**Key rules:**
- Match target to output format: PDF document = `react-pdf`, HTML email = `react-email`, image = `image`
- Never use Puppeteer/Playwright to screenshot a React page for PDF — use native `@json-render/react-pdf`
- Never build custom MJML/HTML templates when `@json-render/react-email` exists
- If output is a file (PDF, PNG, MP4), use the server-side renderer — not the React `<Renderer>` component
- Multiple targets in one project is the normal case — that is the entire point of json-render

### Selection Checklist

| Need | Target | Package |
|------|--------|---------|
| Interactive web UI | React | `@json-render/react` |
| Downloadable document | PDF | `@json-render/react-pdf` |
| Transactional email | Email | `@json-render/react-email` |
| Social preview card | Image | `@json-render/image` |
| Marketing video | Video | `@json-render/remotion` |
| Mobile app screen | React Native | `@json-render/react-native` |
| AI conversation output | MCP | `@json-render/mcp` |
| Source code generation | Codegen | `@json-render/codegen` |
