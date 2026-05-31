---
title: Use Next.js Image component for automatic lazy loading, responsive sizing, and format negotiation
impact: HIGH
impactDescription: "Next.js Image handles lazy loading, responsive sizing, format negotiation, and blur placeholders automatically"
tags: nextjs, image, priority, blur, sizes, loader, cdn, optimization
---

# Next.js Image Component

Use the Next.js `Image` component for automatic optimization, format negotiation, and responsive sizing.

## Priority Hero Image

```tsx
import Image from 'next/image';

export default function Hero() {
  return (
    <Image
      src="/hero.webp"
      alt="Product hero"
      width={1200}
      height={630}
      priority           // Disables lazy loading, adds preload hint
      sizes="100vw"
      quality={85}       // v16: must also be allow-listed in images.qualities
    />
  );
}
```

## Next.js 16 `next/image` Breaking Defaults

Next.js 16 tightened the `next/image` defaults. Audit the config before
shipping or images silently fall back / fail to optimize:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  images: {
    // quality values must be allow-listed; any `quality` prop not in this
    // list is coerced to the default 75 (no longer a free-form 1–100 prop)
    qualities: [75, 85],

    // default minimumCacheTTL is now 14400s (4 hours), up from 60s
    minimumCacheTTL: 14400,

    // `images.domains` was REMOVED — use remotePatterns instead
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.example.com', pathname: '/assets/**' },
    ],

    // local query-string images now require explicit localPatterns.search
    localPatterns: [{ pathname: '/images/**', search: '' }],
  },
}

export default config
```

**Migration checklist (v15 → v16):**
- Replace `images.domains: ['cdn.example.com']` with `images.remotePatterns`.
- Add every `quality` value you pass to `<Image>` into `images.qualities`
  (otherwise it's coerced to `75`).
- Expect a longer default cache (`minimumCacheTTL` 60s → 14400s); set it
  explicitly if you relied on the old short TTL.
- Add `images.localPatterns` with a `search` entry for local images that use
  query strings.

## Blur Placeholder

```tsx
// Static imports generate blurDataURL automatically
import heroImg from '@/public/hero.jpg';

<Image
  src={heroImg}
  alt="Hero"
  placeholder="blur"      // Uses auto-generated blurDataURL
  priority
/>

// For remote images, provide blurDataURL manually
<Image
  src="https://cdn.example.com/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQ..."
/>
```

## Custom Loader for CDN

```tsx
// next.config.js
module.exports = {
  images: {
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
  },
};

// lib/image-loader.ts
export default function cloudflareLoader({
  src, width, quality,
}: { src: string; width: number; quality?: number }) {
  const params = [`width=${width}`, `quality=${quality || 80}`, 'format=auto'];
  return `https://cdn.example.com/cdn-cgi/image/${params.join(',')}/${src}`;
}
```

## Responsive Fill Layout

```tsx
<div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
  <Image
    src="/banner.jpg"
    alt="Banner"
    fill
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    style={{ objectFit: 'cover' }}
  />
</div>
```

**Incorrect — Missing sizes causes incorrect srcset selection:**
```tsx
<Image src="/banner.jpg" alt="Banner" fill />
```

**Correct — Sizes hint ensures optimal image size:**
```tsx
<Image
  src="/banner.jpg"
  alt="Banner"
  fill
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

**Key rules:**
- **Set** `priority` on the LCP image (only one per page)
- **Always** provide `sizes` for responsive images
- **Use** `placeholder="blur"` for visible images to prevent CLS
- **Use** a custom loader for external CDN image transformation
- **Use** `fill` with `sizes` for responsive containers instead of fixed dimensions
