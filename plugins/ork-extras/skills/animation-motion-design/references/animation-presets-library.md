---
title: "Animation Presets Library"
version: 1.0.0
---

# Animation Presets Library

Copy-paste Motion variants for common UI patterns. All presets include reduced-motion alternatives.

## Transition Defaults

```tsx
export const springDefault = { type: "spring" as const, stiffness: 300, damping: 24 }
export const springBouncy = { type: "spring" as const, stiffness: 400, damping: 17 }
export const springStiff = { type: "spring" as const, stiffness: 500, damping: 30 }
export const easeOut = { duration: 0.2, ease: [0, 0, 0.2, 1] as const }
```

## Fade Presets

```tsx
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
}

export const fadeInUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: springDefault,
}

export const fadeInDown = {
  initial: { opacity: 0, y: -16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 16 },
  transition: springDefault,
}
```

## Slide Presets

```tsx
export const slideInLeft = {
  initial: { opacity: 0, x: -24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: springDefault,
}

export const slideInRight = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 24 },
  transition: springDefault,
}
```

## Scale Presets

```tsx
export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: springBouncy,
}

export const popIn = {
  initial: { opacity: 0, scale: 0.5 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
  transition: springBouncy,
}
```

## Stagger Container

```tsx
export const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
  exit: {
    transition: { staggerChildren: 0.03, staggerDirection: -1 },
  },
}

export const staggerChild = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}
```

## Component Presets

### Modal / Dialog

```tsx
export const modalOverlay = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
}

export const modalContent = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 5 },
  transition: springStiff,
}
```

### Drawer / Sheet

```tsx
export const drawerRight = {
  initial: { x: "100%" },
  animate: { x: 0 },
  exit: { x: "100%" },
  transition: springDefault,
}

export const drawerBottom = {
  initial: { y: "100%" },
  animate: { y: 0 },
  exit: { y: "100%" },
  transition: springDefault,
}
```

### Toast / Notification

```tsx
export const toastSlideIn = {
  initial: { opacity: 0, y: -20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.95 },
  transition: springDefault,
}
```

### Skeleton Pulse

```tsx
export const skeletonPulse = {
  animate: { opacity: [0.4, 1, 0.4] },
  transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
}
```

### Collapse / Accordion

```tsx
export const collapse = {
  initial: { height: 0, opacity: 0, overflow: "hidden" as const },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.25, ease: "easeInOut" },
}
```

## Reduced Motion Variants

```tsx
import { useReducedMotion } from "motion/react"

export function usePreset(full: object, reduced?: object) {
  const shouldReduce = useReducedMotion()
  const fallback = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.1 } }
  return shouldReduce ? (reduced ?? fallback) : full
}

// Usage
const preset = usePreset(fadeInUp)
<motion.div {...preset}>Content</motion.div>
```
