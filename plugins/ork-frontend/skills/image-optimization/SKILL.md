---
name: image-optimization
description: Image optimization with Next.js 15 Image, AVIF/WebP formats, blur placeholders, responsive sizes, and CDN loaders. Use when improving image performance, responsive sizing, or Next.js image pipelines.
tags: [images, next-image, avif, webp, responsive, lazy-loading, blur-placeholder, lcp]
context: fork
agent: frontend-ui-developer
version: 1.0.0
allowed-tools: [Read, Write, Grep, Glob]
author: OrchestKit
user-invocable: false
---

# Image Optimization

Production image optimization patterns for modern web applications.

## Overview

- Optimizing Largest Contentful Paint (LCP)
- Reducing page weight and bandwidth
- Implementing responsive images
- Adding blur placeholders for perceived performance
- Converting to modern formats (AVIF, WebP)

## Core Patterns

### 1. Next.js Image Component

```tsx
import Image from 'next/image';

// Static import (recommended for static assets)
import heroImage from '@/public/hero.jpg';

function Hero() {
  return (
    <Image
      src={heroImage}
      alt="Hero banner"
      priority // Preload for LCP
      placeholder="blur" // Automatic blur placeholder
      quality={85}
      sizes="100vw"
    />
  );
}

// Remote images
<Image
  src="https://cdn.example.com/photo.jpg"
  alt="Remote photo"
  width={800}
  height={600}
  sizes="(max-width: 768px) 100vw, 800px"
/>
```

### 2. Responsive Images with Sizes

```tsx
// Full-width hero
<Image
  src="/hero.jpg"
  alt="Hero"
  fill
  sizes="100vw"
  style={{ objectFit: 'cover' }}
/>

// Sidebar image (smaller on large screens)
<Image
  src="/sidebar.jpg"
  alt="Sidebar"
  width={400}
  height={300}
  sizes="(max-width: 768px) 100vw, 33vw"
/>

// Grid of cards
<Image
  src={`/products/${id}.jpg`}
  alt={product.name}
  width={300}
  height={300}
  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
/>
```

### 3. Blur Placeholders

```tsx
// Static imports get automatic blur
import photo from '@/public/photo.jpg';
<Image src={photo} alt="Photo" placeholder="blur" />

// Remote images need blurDataURL
<Image
  src="https://cdn.example.com/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
/>

// Generate blurDataURL at build time
import { getPlaiceholder } from 'plaiceholder';

export async function getStaticProps() {
  const { base64 } = await getPlaiceholder('/public/photo.jpg');
  return { props: { blurDataURL: base64 } };
}
```

### 4. Format Selection (AVIF/WebP)

```tsx
// next.config.js - Enable AVIF
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

// HTML picture element for non-Next.js
<picture>
  <source srcSet="/hero.avif" type="image/avif" />
  <source srcSet="/hero.webp" type="image/webp" />
  <img src="/hero.jpg" alt="Hero" width="1200" height="600" />
</picture>
```

### 5. Lazy Loading Patterns

```tsx
// Default: lazy loading (below the fold)
<Image src="/photo.jpg" alt="Photo" width={400} height={300} />

// Above the fold: eager loading
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority // Preloads, no lazy loading
/>

// Native lazy loading (non-Next.js)
<img
  src="/photo.jpg"
  alt="Photo"
  loading="lazy"
  decoding="async"
  width="400"
  height="300"
/>
```

### 6. Image CDN Configuration

```tsx
// next.config.js - External image domains
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: '*.cloudinary.com',
      },
    ],
  },
};

// Cloudinary loader
const cloudinaryLoader = ({ src, width, quality }) => {
  return `https://res.cloudinary.com/demo/image/upload/w_${width},q_${quality || 75}/${src}`;
};

<Image
  loader={cloudinaryLoader}
  src="sample.jpg"
  alt="Cloudinary image"
  width={500}
  height={300}
/>
```

### 7. Art Direction (Different Images per Breakpoint)

```tsx
'use client';
import Image from 'next/image';
import { useMediaQuery } from '@/hooks/useMediaQuery';

function ResponsiveHero() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <Image
      src={isMobile ? '/hero-mobile.jpg' : '/hero-desktop.jpg'}
      alt="Hero"
      fill
      priority
      sizes="100vw"
    />
  );
}

// Or use CSS to swap
<div className="relative h-[400px]">
  <Image
    src="/hero-desktop.jpg"
    alt="Hero"
    fill
    className="hidden md:block object-cover"
  />
  <Image
    src="/hero-mobile.jpg"
    alt="Hero"
    fill
    className="md:hidden object-cover"
  />
</div>
```

### 8. SVG and Icon Optimization

```tsx
// Inline SVG for small icons (avoid network requests)
import { IconCheck } from '@/components/icons';
<IconCheck className="w-4 h-4" />

// SVG sprites for many icons
<svg className="hidden">
  <symbol id="icon-check" viewBox="0 0 24 24">...</symbol>
  <symbol id="icon-close" viewBox="0 0 24 24">...</symbol>
</svg>

<svg className="w-4 h-4">
  <use href="#icon-check" />
</svg>

// Large decorative SVGs: use Image component
<Image src="/illustration.svg" alt="" width={400} height={300} />
```

## Performance Metrics Impact

| Optimization | LCP Impact | CLS Impact | Bandwidth |
|--------------|------------|------------|-----------|
| AVIF format | -20-30% load | None | -50% size |
| Responsive sizes | -30-50% load | None | -40% size |
| Blur placeholder | Perceived faster | Prevents shift | +1kb |
| Priority loading | -500ms+ | None | None |
| Lazy loading | None (below fold) | None | Deferred |

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| No width/height | CLS from layout shift | Always set dimensions |
| Eager load all | Slow initial load | Use lazy loading |
| No priority on LCP | Slow LCP | Add priority prop |
| PNG for photos | Large file size | Use AVIF/WebP |
| Single image size | Wasted bandwidth | Use responsive sizes |

## Build-Time Optimization

```bash
# Sharp for Next.js (auto-installed)
npm install sharp

# Squoosh CLI for batch optimization
npx @squoosh/cli --webp '{"quality":80}' --avif '{"quality":65}' ./images/*
```

## Quick Reference

```typescript
// ✅ LCP Hero Image (static import for blur)
import heroImage from '@/public/hero.jpg';
<Image
  src={heroImage}
  alt="Hero"
  priority
  placeholder="blur"
  sizes="100vw"
  fill
/>

// ✅ Remote image with explicit dimensions
<Image
  src="https://cdn.example.com/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  sizes="(max-width: 768px) 100vw, 800px"
/>

// ✅ Responsive product card
<Image
  src={product.image}
  alt={product.name}
  fill
  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
/>

// ✅ next.config.js for AVIF/WebP
images: {
  formats: ['image/avif', 'image/webp'],
  remotePatterns: [{ hostname: 'cdn.example.com' }],
}

// ❌ NEVER: Missing dimensions (causes CLS)
<Image src="/photo.jpg" alt="Photo" /> // Missing width/height!

// ❌ NEVER: Priority on non-LCP images
<Image src="/footer-logo.png" priority /> // Wastes bandwidth

// ❌ NEVER: Using PNG for photos
<Image src="/photo.png" /> // Use AVIF/WebP instead
```

## Key Decisions

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Image format | JPEG/PNG | AVIF/WebP | **AVIF** (30-50% smaller), WebP fallback |
| Next.js Image | Static import | Remote URL | **Static import** for automatic blur placeholder |
| Lazy loading | Always lazy | Priority for LCP | **Priority for LCP**, lazy for rest |
| Quality setting | 100 | 75-85 | **75-85** - imperceptible difference, much smaller |
| Placeholder | None | Blur | **Blur** - better perceived performance |
| Dimensions | Fill mode | Explicit w/h | **Fill** with aspect-ratio container for flexibility |

## Anti-Patterns (FORBIDDEN)

```typescript
// ❌ FORBIDDEN: Missing width/height (causes CLS)
<Image src="/photo.jpg" alt="Photo" />
// ✅ CORRECT: Always set dimensions
<Image src="/photo.jpg" alt="Photo" width={800} height={600} />

// ❌ FORBIDDEN: Using fill without container sizing
<div>
  <Image src="/photo.jpg" alt="Photo" fill /> {/* No container size! */}
</div>
// ✅ CORRECT: Fill needs sized container
<div className="relative h-[400px]">
  <Image src="/photo.jpg" alt="Photo" fill />
</div>

// ❌ FORBIDDEN: priority on all images
{images.map(img => (
  <Image src={img.url} alt={img.alt} priority /> // All priority!
))}
// ✅ CORRECT: Only LCP image gets priority
<Image src={heroImage} priority /> {/* LCP only */}
{belowFoldImages.map(img => (
  <Image src={img.url} alt={img.alt} /> /* Default lazy */
))}

// ❌ FORBIDDEN: No sizes prop on responsive images
<Image src="/photo.jpg" fill /> // No sizes = 100vw assumed always
// ✅ CORRECT: Always specify sizes
<Image src="/photo.jpg" fill sizes="(max-width: 768px) 100vw, 50vw" />

// ❌ FORBIDDEN: Using remote images without allowlist
<Image src="https://untrusted.com/image.jpg" /> // Not in remotePatterns!
// ✅ CORRECT: Configure remotePatterns in next.config.js

// ❌ FORBIDDEN: PNG for photographs
<img src="/photo.png" /> // PNG is for transparency, not photos
// ✅ CORRECT: Use AVIF/WebP for photos
<Image src="/photo.jpg" /> // Next.js converts to AVIF/WebP

// ❌ FORBIDDEN: Quality 100
<Image quality={100} /> // Huge file, no visual benefit
// ✅ CORRECT: Quality 75-85
<Image quality={85} />

// ❌ FORBIDDEN: Loading LCP content via client-side fetch
useEffect(() => {
  fetchHeroImage().then(setHero); // LCP waits for JS + fetch!
}, []);
// ✅ CORRECT: Server-render LCP images
export default async function Page() {
  const hero = await getHero();
  return <Image src={hero.image} priority />;
}

// ❌ FORBIDDEN: Empty alt on non-decorative images
<Image src="/product.jpg" alt="" /> // Inaccessible!
// ✅ CORRECT: Meaningful alt text
<Image src="/product.jpg" alt="Red sneakers, side view" />
```

## Related Skills

- `core-web-vitals` - LCP optimization, performance monitoring
- `accessibility-specialist` - Image alt text, WCAG compliance
- `react-server-components-framework` - Server-rendering for LCP images
- `frontend-ui-developer` - Modern frontend patterns

## Capability Details

### next-image
**Keywords**: next/image, Image component, fill, priority, sizes, quality
**Solves**: Automatic optimization, format conversion, responsive images

### avif-webp
**Keywords**: AVIF, WebP, format, compression, modern-formats
**Solves**: Reducing image file size by 30-50% with same quality

### blur-placeholder
**Keywords**: blur, placeholder, blurDataURL, plaiceholder, perceived-performance
**Solves**: Better perceived performance, visual stability during load

### responsive-sizes
**Keywords**: sizes, srcset, responsive, breakpoint, viewport
**Solves**: Serving appropriately-sized images for each device

### image-cdn
**Keywords**: CDN, Cloudinary, imgix, Cloudflare, loader, remote
**Solves**: Global distribution, on-demand transformation, caching

### lazy-loading
**Keywords**: lazy, loading, priority, eager, preload, LCP
**Solves**: Reducing initial page load by deferring off-screen images

## References

- `references/cdn-setup.md` - Image CDN configuration
- `scripts/image-component.tsx` - Reusable image wrapper
- `checklists/image-checklist.md` - Optimization checklist
- `examples/image-examples.md` - Real-world image patterns
