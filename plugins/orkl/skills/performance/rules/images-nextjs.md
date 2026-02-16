---
title: Next.js Image Component
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
      quality={85}
    />
  );
}
```

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
