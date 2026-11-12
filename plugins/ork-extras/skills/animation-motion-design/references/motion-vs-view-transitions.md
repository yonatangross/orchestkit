---
title: "Motion vs View Transitions API Comparison"
version: 1.0.0
---

# Motion vs View Transitions API

## Feature Comparison

| Feature | Motion | View Transitions API |
|---------|--------|---------------------|
| **Bundle size** | ~16KB gzipped | 0KB (browser-native) |
| **Browser support** | All modern browsers | Chrome 111+, Safari 18+, Firefox 2026 |
| **Component animations** | Full support | Not designed for this |
| **Page transitions** | Manual with AnimatePresence | Built-in, optimized |
| **Shared elements** | layoutId | viewTransitionName |
| **Interruptible** | Yes (springs) | No (runs to completion) |
| **Gesture support** | drag, hover, tap, pan | None |
| **Exit animations** | AnimatePresence | Automatic snapshots |
| **Spring physics** | Built-in | CSS only (no springs) |
| **Layout animations** | FLIP with layout prop | Automatic FLIP |
| **SSR compatible** | Yes | Client-only |
| **React integration** | First-class (motion/react) | React Router viewTransition prop |
| **Cross-document** | No | Yes (@view-transition at-rule) |
| **Scroll animations** | useScroll, useInView | CSS scroll-timeline |

## When to Choose Motion

- Component mount/unmount animations
- Gesture-driven interactions (drag, swipe, reorder)
- Complex orchestrated sequences (staggerChildren, variants)
- Interruptible animations (user can interrupt mid-animation)
- Scroll-linked animations with fine control
- React Native cross-platform needs

## When to Choose View Transitions API

- Page navigation transitions (SPA or MPA)
- Shared element transitions across routes
- Cross-document transitions (MPA with @view-transition)
- Zero-bundle-cost transitions
- Simple crossfade effects
- Progressive enhancement (works without JS)

## Limitations

### View Transitions API
- Cannot be interrupted once started
- Only one transition can run at a time
- `viewTransitionName` must be unique on the page
- No spring physics — CSS easing only
- Cross-document transitions require same-origin
- No gesture support
- Snapshot-based — cannot animate mid-state

### Motion
- Adds ~16KB to bundle (or ~5KB with motion/mini)
- Layout animations can cause flash of unstyled content on slow devices
- No cross-document transition support
- Requires React (or Vanilla JS via motion/dom)

## Using Both Together

Motion and View Transitions API complement each other:

```tsx
// View Transitions for page navigation
<Link to="/product/123" viewTransition>View Product</Link>

// Motion for component-level animations on the page
<motion.div layout whileHover={{ scale: 1.02 }}>
  <ProductCard />
</motion.div>
```

## Browser Support (as of 2026)

| Browser | View Transitions (same-doc) | View Transitions (cross-doc) |
|---------|---------------------------|------------------------------|
| Chrome | 111+ | 126+ |
| Edge | 111+ | 126+ |
| Safari | 18+ | 18+ |
| Firefox | 2026+ | 2026+ |

## Performance Comparison

| Metric | Motion | View Transitions API |
|--------|--------|---------------------|
| First transition | ~2ms JS overhead | ~0ms (browser-native) |
| Memory | React component tree | Browser snapshots (bitmaps) |
| GPU usage | Composited layers | Pseudo-element layers |
| Concurrent transitions | Unlimited | One at a time |
