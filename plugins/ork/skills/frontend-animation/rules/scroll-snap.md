---
title: "Scroll: Parallax & Progressive Enhancement"
category: scroll
impact: MEDIUM
---

# Parallax, Sticky Headers & Progressive Enhancement

Scroll-driven parallax effects and progressive enhancement fallbacks for unsupported browsers.

## Parallax Sections

```css
.parallax-section {
  position: relative;
  overflow: hidden;
}

.parallax-bg {
  position: absolute;
  inset: -20% 0;

  animation: parallax-scroll linear both;
  animation-timeline: view();
  animation-range: cover 0% cover 100%;
}

@keyframes parallax-scroll {
  from { transform: translateY(0); }
  to { transform: translateY(40%); }
}
```

## Full Visibility Parallax

```css
.hero-image {
  animation: parallax linear both;
  animation-timeline: view();
  animation-range: cover 0% cover 100%;
}

@keyframes parallax {
  from { transform: translateY(-20%); }
  to { transform: translateY(20%); }
}
```

## CSS Progressive Enhancement

```css
/* Fallback for unsupported browsers */
.reveal-on-scroll {
  opacity: 1; /* Default visible */
  transform: translateY(0);
}

/* Apply animation only when supported */
@supports (animation-timeline: view()) {
  .reveal-on-scroll {
    animation: fade-slide-up linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 100%;
  }
}
```

## React Feature Detection Fallback

```tsx
const supportsScrollTimeline =
  typeof ScrollTimeline !== 'undefined';

function AnimatedSection({ children }: { children: React.ReactNode }) {
  if (!supportsScrollTimeline) {
    return <IntersectionObserverFallback>{children}</IntersectionObserverFallback>;
  }

  return <ScrollAnimatedSection>{children}</ScrollAnimatedSection>;
}
```

## Performance Best Practices

```css
/* CORRECT: Animate transform/opacity only */
@keyframes good-animation {
  from { transform: translateY(100px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* WRONG: Animate layout properties */
@keyframes bad-animation {
  from { margin-top: 100px; height: 0; }
  to { margin-top: 0; height: auto; }
}

/* Use will-change sparingly */
.scroll-animated {
  will-change: transform, opacity;
}
```

## Chrome DevTools Debugging

1. Open DevTools > Elements tab
2. Find "Scroll-Driven Animations" tab (may be in overflow)
3. Select element with scroll animation
4. Scrub timeline to preview animation
5. Inspect `animation-timeline` and `animation-range` values

## Browser Support

| Browser | scroll() | view() | ScrollTimeline API |
|---------|----------|--------|-------------------|
| Chrome 115+ | Yes | Yes | Yes |
| Edge 115+ | Yes | Yes | Yes |
| Safari 18.4+ | Yes | Yes | Yes |
| Firefox | No | No | In development |

## Key Decisions

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Timeline type | scroll() | view() | **view()** for reveals, **scroll()** for progress |
| Fallback | IntersectionObserver | No animation | **IntersectionObserver** fallback |
| Properties | All CSS | transform/opacity | **transform/opacity** only |
| Range units | Percentages | Named ranges | **Named ranges** (entry, cover) for clarity |
