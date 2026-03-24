---
title: Use Remotion compositions and Satori for video and image generation from specs
impact: MEDIUM
impactDescription: "Manually creating Remotion timelines or using canvas for images loses catalog validation and requires duplicating component logic"
tags: [remotion, video, image, satori, og-image, social-card, png, svg]
---

## Video & Image Renderer

`@json-render/remotion` wraps specs into Remotion compositions for MP4/WebM video. `@json-render/image` uses Satori to render specs as SVG, then optionally converts to PNG for OG images and social cards.

**Incorrect — manually creating Remotion timelines:**
```tsx
// WRONG: Manual timeline, no catalog validation, duplicated rendering logic
export const MyVideo = () => (
  <Composition
    id="demo"
    component={() => (
      <div>
        <h1>{data.title}</h1>
        <p>{data.description}</p>
      </div>
    )}
    durationInFrames={150}
    fps={30}
    width={1920}
    height={1080}
  />
)
```

**Correct — JsonRenderComposition from spec:**
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
    width={1920}
    height={1080}
  />
)
```

**Incorrect — using Puppeteer for OG images:**
```typescript
// WRONG: Launches browser, screenshots a page, saves as PNG
const browser = await puppeteer.launch()
const page = await browser.newPage()
await page.setViewport({ width: 1200, height: 630 })
await page.setContent(`<div style="...">${title}</div>`)
const png = await page.screenshot({ type: 'png' })
```

**Correct — Satori-based image rendering:**
```typescript
import { renderToSvg, renderToPng } from '@json-render/image'
import { catalog } from './catalog'
import { imageRegistry } from './registries/image'

// SVG (smaller file size, scalable)
const svg = await renderToSvg(spec, {
  catalog,
  registry: imageRegistry,
  width: 1200,
  height: 630,
})

// PNG (universal compatibility)
const png = await renderToPng(spec, {
  catalog,
  registry: imageRegistry,
  width: 1200,
  height: 630,
})
```

**Key rules:**
- Use `JsonRenderComposition` for Remotion videos — it validates specs against the catalog
- Use `renderToPng` for OG images (1200x630 standard) — Satori is server-side, no browser needed
- Satori has CSS limitations: no CSS grid, limited flexbox, no `position: absolute` nesting — design image registries accordingly
- Image registries must use inline styles only — Satori does not support className or CSS files
- For Remotion, the registry can use Remotion animation primitives (`useCurrentFrame`, `interpolate`, `spring`)

### Satori CSS Constraints

| Supported | Not Supported |
|-----------|---------------|
| Flexbox (basic) | CSS Grid |
| `border`, `borderRadius` | `box-shadow` |
| `padding`, `margin` | `position: absolute` (limited) |
| `fontSize`, `fontWeight` | External CSS, className |
| `color`, `backgroundColor` | CSS animations |
| `width`, `height` | Media queries |

### Common OG Image Dimensions

| Platform | Width | Height | Ratio |
|----------|-------|--------|-------|
| Open Graph (general) | 1200 | 630 | 1.91:1 |
| Twitter card | 1200 | 628 | 1.91:1 |
| LinkedIn share | 1200 | 627 | 1.91:1 |
| Facebook share | 1200 | 630 | 1.91:1 |
