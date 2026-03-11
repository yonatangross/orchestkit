---
name: animation-motion-design
license: MIT
compatibility: "Claude Code 2.1.73+."
description: Animation and motion design patterns using Motion library (formerly Framer Motion) and View Transitions API. Use when implementing component animations, page transitions, micro-interactions, gesture-driven UIs, or ensuring motion accessibility with prefers-reduced-motion.
tags: [animation, motion, framer-motion, view-transitions, micro-interactions, gestures, layout-animation, AnimatePresence, prefers-reduced-motion, spring-physics]
context: fork
agent: frontend-ui-developer
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Animation & Motion Design

Patterns for building performant, accessible animations using **Motion** (formerly Framer Motion, 18M+ weekly npm downloads) and the **View Transitions API** (cross-browser support in 2026). Covers layout animations, gesture interactions, exit transitions, micro-interactions, and motion accessibility.

## Quick Reference

| Rule | File | Impact | When to Use |
|------|------|--------|-------------|
| Layout Animations | `rules/motion-layout.md` | HIGH | Shared layout transitions, FLIP animations, layoutId |
| Gesture Interactions | `rules/motion-gestures.md` | HIGH | Drag, hover, tap with spring physics |
| Exit Animations | `rules/motion-exit.md` | HIGH | AnimatePresence, unmount transitions |
| View Transitions API | `rules/view-transitions-api.md` | HIGH | Page navigation, cross-document transitions |
| Motion Accessibility | `rules/motion-accessibility.md` | CRITICAL | prefers-reduced-motion, cognitive load |
| Motion Performance | `rules/motion-performance.md` | HIGH | 60fps, GPU compositing, layout thrash |

**Total: 6 rules across 3 categories**

## Decision Table — Motion vs View Transitions API

| Scenario | Recommendation | Why |
|----------|---------------|-----|
| Component mount/unmount | Motion | AnimatePresence handles lifecycle |
| Page navigation transitions | View Transitions API | Built-in browser support, works with any router |
| Complex interruptible animations | Motion | Spring physics, gesture interruption |
| Simple crossfade between pages | View Transitions API | Zero JS bundle cost |
| Drag/reorder interactions | Motion | drag prop with layout animations |
| Shared element across routes | View Transitions API | viewTransitionName CSS property |
| Scroll-triggered animations | Motion | useInView, useScroll hooks |
| Multi-step orchestrated sequences | Motion | staggerChildren, variants |

## Quick Start

### Motion — Component Animation

```tsx
import { motion, AnimatePresence } from "motion/react"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { type: "spring", stiffness: 300, damping: 24 },
}

function Card({ item }: { item: Item }) {
  return (
    <motion.div {...fadeInUp} layout layoutId={item.id}>
      {item.content}
    </motion.div>
  )
}

function CardList({ items }: { items: Item[] }) {
  return (
    <AnimatePresence mode="wait">
      {items.map((item) => (
        <Card key={item.id} item={item} />
      ))}
    </AnimatePresence>
  )
}
```

### View Transitions API — Page Navigation

```tsx
// React Router v7+ with View Transitions
import { Link, useNavigate } from "react-router"

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} viewTransition>{children}</Link>
}

// CSS for the transition
// ::view-transition-old(root) { animation: fade-out 200ms ease; }
// ::view-transition-new(root) { animation: fade-in 200ms ease; }
```

### Motion — Accessible by Default

```tsx
import { useReducedMotion } from "motion/react"

function AnimatedComponent() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      animate={{ x: 100 }}
      transition={shouldReduceMotion
        ? { duration: 0 }
        : { type: "spring", stiffness: 300, damping: 24 }
      }
    />
  )
}
```

## Rule Details

### Layout Animations (Motion)

FLIP-based layout animations with the `layout` prop and shared layout transitions via `layoutId`.

> **Load**: `rules/motion-layout.md`

### Gesture Interactions (Motion)

Drag, hover, and tap interactions with spring physics and gesture composition.

> **Load**: `rules/motion-gestures.md`

### Exit Animations (Motion)

AnimatePresence for animating components as they unmount from the React tree.

> **Load**: `rules/motion-exit.md`

### View Transitions API

Browser-native page transitions using `document.startViewTransition()` and framework integrations.

> **Load**: `rules/view-transitions-api.md`

### Motion Accessibility

Respecting user motion preferences and reducing cognitive load with motion sensitivity patterns.

> **Load**: `rules/motion-accessibility.md`

### Motion Performance

GPU compositing, avoiding layout thrash, and keeping animations at 60fps.

> **Load**: `rules/motion-performance.md`

## Key Principles

1. **60fps or nothing** — Only animate `transform` and `opacity` (composite properties). Never animate `width`, `height`, `top`, or `left`.
2. **Centralized presets** — Define animation variants in a shared file, not inline on every component.
3. **AnimatePresence for exits** — React unmounts instantly; wrap with AnimatePresence to animate out.
4. **Spring over duration** — Springs feel natural and are interruptible. Use `stiffness`/`damping`, not `duration`.
5. **Respect user preferences** — Always check `prefers-reduced-motion` and provide instant alternatives.

## Performance Budget

| Metric | Target | Measurement |
|--------|--------|-------------|
| Transition duration | < 400ms | User perception threshold |
| Animation properties | transform, opacity only | DevTools > Rendering > Paint flashing |
| JS bundle (Motion) | ~16KB gzipped | Import only what you use |
| First paint delay | 0ms | Animations must not block render |
| Frame drops | < 5% of frames | Performance API: `PerformanceObserver` |

## Anti-Patterns (FORBIDDEN)

- **Animating layout properties** — Never animate `width`, `height`, `margin`, `padding` directly. Use `transform: scale()` instead.
- **Missing AnimatePresence** — Components unmount instantly without it; exit animations are silently lost.
- **Ignoring prefers-reduced-motion** — Causes vestibular disorders for ~35% of users with motion sensitivity.
- **Inline transition objects** — Creates new objects every render, breaking React memoization.
- **duration-based springs** — Motion springs use `stiffness`/`damping`, not `duration`. Mixing causes unexpected behavior.
- **Synchronous startViewTransition** — Always await or handle the promise from `document.startViewTransition()`.

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [references/motion-vs-view-transitions.md](references/motion-vs-view-transitions.md) | Comparison table, browser support, limitations |
| [references/animation-presets-library.md](references/animation-presets-library.md) | Copy-paste preset variants for common patterns |
| [references/micro-interactions-catalog.md](references/micro-interactions-catalog.md) | Button press, toggle, checkbox, loading, success/error |

## Related Skills

- `ork:ui-components` — shadcn/ui component patterns and CVA variants
- `ork:responsive-patterns` — Responsive layout and container query patterns
- `ork:performance` — Core Web Vitals and runtime performance optimization
- `ork:accessibility` — WCAG compliance, ARIA patterns, screen reader support
