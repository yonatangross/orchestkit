---
title: Responsive Images
impact: HIGH
impactDescription: "Responsive images serve appropriately sized files per viewport, avoiding multi-megabyte images on mobile devices"
tags: srcset, sizes, responsive, art-direction, picture, cdn, retina
---

# Responsive Images

Serve the right image size for every viewport and device pixel ratio.

## Srcset with Sizes

```html
<img
  src="/photo-800.jpg"
  srcset="
    /photo-400.jpg   400w,
    /photo-800.jpg   800w,
    /photo-1200.jpg 1200w,
    /photo-1600.jpg 1600w
  "
  sizes="(max-width: 640px) 100vw,
         (max-width: 1024px) 50vw,
         33vw"
  alt="Product photo"
  loading="lazy"
  width="800"
  height="600"
/>
```

## Art Direction with Picture

```html
<!-- Different crops for different viewports -->
<picture>
  <source
    media="(max-width: 640px)"
    srcset="/hero-mobile.avif 640w, /hero-mobile-2x.avif 1280w"
    sizes="100vw"
    type="image/avif"
  />
  <source
    media="(min-width: 641px)"
    srcset="/hero-desktop.avif 1200w, /hero-desktop-2x.avif 2400w"
    sizes="66vw"
    type="image/avif"
  />
  <img src="/hero-desktop.jpg" alt="Hero" width="1200" height="630" />
</picture>
```

## CDN Image Transformation URLs

```tsx
// Cloudflare Image Resizing
function cfImage(src: string, width: number, quality = 80) {
  return `https://cdn.example.com/cdn-cgi/image/w=${width},q=${quality},f=auto/${src}`;
}

// Imgix
function imgixUrl(src: string, width: number, quality = 80) {
  return `${src}?w=${width}&q=${quality}&auto=format,compress`;
}

// Usage in React
<img
  src={cfImage('/photos/product.jpg', 800)}
  srcset={`
    ${cfImage('/photos/product.jpg', 400)} 400w,
    ${cfImage('/photos/product.jpg', 800)} 800w,
    ${cfImage('/photos/product.jpg', 1200)} 1200w
  `}
  sizes="(max-width: 768px) 100vw, 50vw"
  alt="Product"
  loading="lazy"
/>
```

**Incorrect — srcset without sizes lets browser guess:**
```html
<img
  srcset="/photo-400.jpg 400w, /photo-800.jpg 800w"
  src="/photo-800.jpg"
  alt="Photo"
/>
```

**Correct — sizes guides browser to optimal choice:**
```html
<img
  srcset="/photo-400.jpg 400w, /photo-800.jpg 800w"
  sizes="(max-width: 640px) 100vw, 50vw"
  src="/photo-800.jpg"
  alt="Photo"
  width="800"
  height="600"
/>
```

**Key rules:**
- **Always** provide `sizes` alongside `srcset` for width descriptors
- **Use** 3-4 srcset breakpoints (400, 800, 1200, 1600) for most images
- **Use** `<picture>` with `media` for art direction (different crops)
- **Delegate** resizing to a CDN rather than shipping multiple static files
- **Set** explicit `width` and `height` to prevent CLS
