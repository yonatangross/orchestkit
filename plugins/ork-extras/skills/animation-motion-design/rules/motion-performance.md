---
title: "Motion Performance"
impact: "HIGH"
impactDescription: "Animating non-composite properties causes layout thrash, dropping below 60fps and creating visible jank on mid-range devices"
tags: [performance, GPU, compositing, will-change, layout-thrash, 60fps, transform, opacity]
---

## Motion Performance

Smooth 60fps animations require animating only composite properties (`transform`, `opacity`) that the GPU can handle without triggering layout or paint. Every other property causes the browser to recalculate layout for the entire subtree.

**Incorrect:**
```tsx
// Animating layout-triggering properties — causes reflow on every frame
<motion.div
  animate={{
    width: isOpen ? 300 : 0,
    height: isOpen ? 200 : 0,
    marginTop: isOpen ? 20 : 0,
    borderRadius: isOpen ? 12 : 0,
  }}
  transition={{ duration: 0.3 }}
/>
```

**Correct:**
```tsx
// Only composite properties — GPU accelerated, no layout recalculation
<motion.div
  animate={{
    scale: isOpen ? 1 : 0,
    opacity: isOpen ? 1 : 0,
  }}
  transition={{ type: "spring", stiffness: 300, damping: 25 }}
  style={{ transformOrigin: "top left" }}
/>
```

### Composite vs Non-Composite Properties

| Safe (GPU) | Unsafe (CPU layout) |
|------------|---------------------|
| `transform` (translate, scale, rotate) | `width`, `height` |
| `opacity` | `margin`, `padding` |
| `filter` (with caution) | `top`, `left`, `right`, `bottom` |
| `clip-path` | `border-radius` |
| | `font-size`, `line-height` |

### will-change Usage

```tsx
// Motion handles will-change automatically — don't add it manually
// WRONG: style={{ willChange: "transform" }} on motion.div
// RIGHT: Let Motion manage GPU promotion internally
<motion.div animate={{ x: 100 }} />
```

### Measuring Animation Performance

```tsx
// Use PerformanceObserver to detect long animation frames
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) {
      console.warn(`Long animation frame: ${entry.duration}ms`, entry)
    }
  }
})

observer.observe({ type: "long-animation-frame", buffered: true })
```

### Stagger Performance

```tsx
// Stagger large lists — animate only visible items
const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.03,  // Keep stagger tight for large lists
      delayChildren: 0.1,
    },
  },
}

// For lists > 20 items, only animate items in viewport
function useAnimateOnlyVisible(ref: RefObject<HTMLElement>) {
  const isInView = useInView(ref, { once: true, margin: "-10%" })
  return isInView ? "animate" : "initial"
}
```

### Bundle Size Optimization

```tsx
// Import only what you need from motion/react
import { motion, AnimatePresence } from "motion/react"  // Tree-shakeable

// For minimal bundle, use motion/mini (no layout animations)
import { motion } from "motion/mini"  // ~5KB vs ~16KB
```

**Key rules:**
- Animate only `transform` and `opacity` — everything else triggers layout/paint
- Do not manually set `will-change` on `motion` components — Motion manages GPU promotion
- Use `motion/mini` for simple animations where layout animations are not needed
- Stagger large lists with `staggerChildren: 0.03` max — longer staggers feel sluggish
- Measure with Performance API and DevTools Rendering panel, not visual inspection
- Use `useInView` to skip animations for off-screen elements in long lists

Reference: https://web.dev/articles/animations-guide
