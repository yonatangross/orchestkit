---
title: Modern Image Formats
impact: HIGH
impactDescription: "AVIF and WebP deliver 30-50% smaller files than JPEG at equivalent quality, directly reducing page weight and load time"
tags: avif, webp, jpeg, format, quality, picture, fallback, compression
---

# Modern Image Formats

Choose the right image format and quality settings for optimal compression.

## Format Decision Matrix

| Format | Best For | Browser Support | Quality Setting |
|--------|----------|----------------|-----------------|
| AVIF | Photos, gradients | 93%+ (2026) | 60-75 |
| WebP | Universal fallback | 97%+ | 75-82 |
| JPEG | Legacy fallback | 100% | 80-85 |
| PNG | Transparency, icons | 100% | N/A |
| SVG | Icons, logos | 100% | N/A |

## Picture Element with Fallback

```html
<picture>
  <source srcset="/photo.avif" type="image/avif" />
  <source srcset="/photo.webp" type="image/webp" />
  <img src="/photo.jpg" alt="Photo" width="800" height="600" loading="lazy" />
</picture>
```

## Build-Time Conversion

```typescript
// vite.config.ts with vite-plugin-image-optimizer
import { imageOptimizer } from 'vite-plugin-image-optimizer';

export default defineConfig({
  plugins: [
    imageOptimizer({
      avif: { quality: 72, effort: 4 },
      webp: { quality: 78 },
      jpeg: { quality: 82, progressive: true },
    }),
  ],
});
```

## Quality Guidelines

```
AVIF  60-75  — Best compression, slight encoding time cost
WebP  75-82  — Good balance, fastest encoding
JPEG  80-85  — Legacy only, use progressive encoding

Rule of thumb: lower quality for large hero images (more compression gain),
higher quality for small thumbnails (already small files).
```

**Incorrect — Single JPEG format misses 30-50% compression savings:**
```html
<img src="/photo.jpg" alt="Photo" width="800" height="600" />
```

**Correct — Modern formats with fallback:**
```html
<picture>
  <source srcset="/photo.avif" type="image/avif" />
  <source srcset="/photo.webp" type="image/webp" />
  <img src="/photo.jpg" alt="Photo" width="800" height="600" />
</picture>
```

**Key rules:**
- **Prefer** AVIF as primary format with WebP fallback
- **Use** quality 72-78 for AVIF and WebP (visually lossless for most photos)
- **Always** include a JPEG/PNG fallback in `<picture>`
- **Use** progressive JPEG for any remaining JPEG images
- **Automate** format conversion in the build pipeline, not manually
