# Image Optimization Checklist

Comprehensive checklist for production-ready image optimization.

## Format Selection

### Photo Content
- [ ] Use AVIF as primary format (30-50% smaller than JPEG)
- [ ] Configure WebP as fallback for older browsers
- [ ] JPEG only for browsers without AVIF/WebP support
- [ ] Configure Next.js: `formats: ['image/avif', 'image/webp']`

### Graphics & Icons
- [ ] SVG for logos, icons, and simple graphics
- [ ] PNG only when transparency is required
- [ ] Consider SVG sprites for icon sets (reduces requests)
- [ ] Inline small SVGs (< 1KB) to avoid network requests

### Format Decision Tree
```
Is it a photo/complex image?
├── Yes → Use AVIF/WebP (Next.js Image handles this)
└── No → Is transparency needed?
    ├── Yes → PNG or SVG
    └── No → Is it an icon/logo?
        ├── Yes → SVG (scalable, tiny file size)
        └── No → AVIF/WebP
```

---

## Dimensions & Sizing

### Always Set Dimensions
- [ ] Every `<Image>` has `width` and `height` OR uses `fill`
- [ ] Fill mode images have sized container (relative + dimensions)
- [ ] Dimensions match actual display size (not larger)
- [ ] No CLS from images (Layout Shift score = 0)

```tsx
// ✅ GOOD: Explicit dimensions
<Image src="/photo.jpg" width={800} height={600} />

// ✅ GOOD: Fill with sized container
<div className="relative h-[400px]">
  <Image src="/photo.jpg" fill />
</div>

// ❌ BAD: Missing dimensions
<Image src="/photo.jpg" />
```

### Responsive Images
- [ ] `sizes` prop set for all responsive images
- [ ] Sizes match actual layout breakpoints
- [ ] Don't serve images larger than needed
- [ ] Test with DevTools Network tab (check actual sizes served)

```tsx
// ✅ GOOD: Accurate sizes prop
<Image
  src="/photo.jpg"
  fill
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
/>

// Common sizes patterns:
// Full width hero: sizes="100vw"
// Half width on desktop: sizes="(max-width: 768px) 100vw, 50vw"
// Grid of 4: sizes="(max-width: 640px) 50vw, 25vw"
```

---

## Loading Strategy

### LCP Images (Above the Fold)
- [ ] Hero/banner image has `priority` prop
- [ ] ONLY one image per page has `priority` (usually LCP element)
- [ ] LCP image preloaded in `<head>` if not using Next.js Image
- [ ] No lazy loading on LCP images

```tsx
// ✅ GOOD: Priority on LCP image
<Image src="/hero.jpg" priority fill sizes="100vw" />

// ❌ BAD: Priority on all images
{images.map(img => <Image src={img} priority />)} // Wrong!
```

### Below-the-Fold Images
- [ ] Default lazy loading (Next.js Image default)
- [ ] No `priority` prop on non-LCP images
- [ ] Consider `loading="lazy"` for native `<img>` elements
- [ ] Use Intersection Observer for custom lazy loading

### Preloading
- [ ] Critical hero image preloaded
- [ ] Don't preload below-fold images
- [ ] Use `fetchpriority="high"` for critical images

```html
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />
```

---

## Placeholders

### Blur Placeholders
- [ ] Static imports use `placeholder="blur"` (automatic)
- [ ] Remote images have `blurDataURL` generated
- [ ] Placeholder improves perceived performance
- [ ] Consider plaiceholder library for build-time generation

```tsx
// ✅ Static import with automatic blur
import heroImage from '@/public/hero.jpg';
<Image src={heroImage} placeholder="blur" />

// ✅ Remote image with blur
<Image
  src="https://cdn.example.com/photo.jpg"
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

### Color Placeholders
- [ ] Consider dominant color placeholder for cards
- [ ] Skeleton placeholders for loading states
- [ ] Smooth transition from placeholder to image

---

## Quality Settings

### Compression
- [ ] Quality set to 75-85 (not 100)
- [ ] Test quality visually - often 75 is indistinguishable
- [ ] Higher quality (85-90) only for hero/product images
- [ ] Lower quality (60-70) acceptable for thumbnails

```tsx
// ✅ GOOD: Appropriate quality
<Image src="/hero.jpg" quality={85} /> // Important hero
<Image src="/thumbnail.jpg" quality={70} /> // Small thumbnail

// ❌ BAD: Unnecessary quality
<Image src="/photo.jpg" quality={100} /> // Huge file, no benefit
```

### AVIF-Specific
- [ ] AVIF quality can be 10-15 points lower than JPEG
- [ ] Test AVIF vs WebP on your content type
- [ ] Some images compress better with WebP

---

## CDN & Infrastructure

### Next.js Configuration
- [ ] `remotePatterns` configured for all external domains
- [ ] `deviceSizes` matches your breakpoints
- [ ] `formats` includes AVIF and WebP
- [ ] `minimumCacheTTL` set appropriately (30+ days for static)

```typescript
// next.config.js
images: {
  formats: ['image/avif', 'image/webp'],
  remotePatterns: [
    { hostname: 'cdn.example.com' },
    { hostname: '*.cloudinary.com' },
  ],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
}
```

### CDN Setup
- [ ] Images served from CDN (not origin server)
- [ ] Edge caching enabled
- [ ] Cache headers set correctly (1 year for hashed assets)
- [ ] `Vary: Accept` header for format negotiation

### Self-Hosted
- [ ] Sharp installed: `npm install sharp`
- [ ] Docker image includes Sharp dependencies
- [ ] Adequate disk space for image cache
- [ ] Memory limits account for Sharp processing

---

## Accessibility

### Alt Text
- [ ] ALL images have `alt` attribute
- [ ] Meaningful alt for informative images
- [ ] Empty `alt=""` for decorative images
- [ ] Alt text describes content, not appearance
- [ ] No "image of" or "picture of" prefix

```tsx
// ✅ GOOD: Meaningful alt
<Image src="/product.jpg" alt="Red Nike Air Max 90 running shoe, side view" />

// ✅ GOOD: Decorative image
<Image src="/decorative-pattern.svg" alt="" />

// ❌ BAD: Generic alt
<Image src="/product.jpg" alt="Image" />

// ❌ BAD: Missing alt
<Image src="/product.jpg" />
```

### Additional A11y
- [ ] No text in images (use real text)
- [ ] Sufficient color contrast for overlaid text
- [ ] Images don't convey information unavailable in text
- [ ] Decorative images marked with `role="presentation"`

---

## Performance Monitoring

### Metrics to Track
- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] CLS (Cumulative Layout Shift) = 0 for images
- [ ] Image load times in RUM data
- [ ] Total image bytes transferred

### Debugging
- [ ] Check DevTools Network tab for actual sizes
- [ ] Verify format negotiation (AVIF/WebP served)
- [ ] Test on slow connections (DevTools throttling)
- [ ] Run Lighthouse for image recommendations

---

## Error Handling

### Fallbacks
- [ ] Fallback image configured for load errors
- [ ] Graceful degradation for broken images
- [ ] Error boundaries for image-heavy components

```tsx
const [error, setError] = useState(false);

<Image
  src={error ? '/fallback.jpg' : product.image}
  onError={() => setError(true)}
/>
```

### Monitoring
- [ ] Image errors logged to monitoring service
- [ ] Alerts for high error rates
- [ ] 404s for images tracked

---

## Build Pipeline

### Optimization
- [ ] Images optimized at build time (where possible)
- [ ] Source images stored at high resolution
- [ ] Build includes image processing (Sharp, Squoosh)
- [ ] CI validates image configurations

### Version Control
- [ ] Large images in Git LFS (not regular Git)
- [ ] Or: Images stored externally (CMS, CDN)
- [ ] Build pulls images from source

---

## Security

### Content Security
- [ ] Only allow trusted image domains
- [ ] SVG sanitization if user-uploaded
- [ ] `dangerouslyAllowSVG: false` in production
- [ ] Rate limiting on image optimization endpoints

### Privacy
- [ ] Strip EXIF metadata from user uploads
- [ ] No personally identifiable information in image URLs
- [ ] Consider image hashing for user content
