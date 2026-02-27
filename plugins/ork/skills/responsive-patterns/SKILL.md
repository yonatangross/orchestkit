---
name: responsive-patterns
license: MIT
compatibility: "Claude Code 2.1.59+."
description: Responsive design with Container Queries, fluid typography, cqi/cqb units, and mobile-first patterns for React applications. Use when building responsive layouts or container queries.
tags: [responsive, container-queries, fluid-typography, mobile-first, css-grid, clamp, cqi, breakpoints, pwa, service-worker, workbox, offline-first, animation, motion, framer-motion, scroll-driven, view-transitions]
context: fork
agent: frontend-ui-developer
version: 1.0.0
author: OrchestKit
user-invocable: false
complexity: medium
metadata:
  category: document-asset-creation
---

# Responsive Patterns

Modern responsive design patterns using Container Queries, fluid typography, and mobile-first strategies for React applications (2026 best practices).

## Overview

- Building reusable components that adapt to their container
- Implementing fluid typography that scales smoothly
- Creating responsive layouts without media query overload
- Building design system components for multiple contexts
- Optimizing for variable container sizes (sidebars, modals, grids)

## Core Concepts

### Container Queries vs Media Queries

| Feature | Media Queries | Container Queries |
|---------|---------------|-------------------|
| Responds to | Viewport size | Container size |
| Component reuse | Context-dependent | Truly portable |
| Browser support | Universal | Baseline 2023+ |
| Use case | Page layouts | Component layouts |

## CSS Patterns

> See [rules/css-patterns.md](rules/css-patterns.md) for complete CSS examples: container queries, cqi/cqb units, fluid typography with clamp(), mobile-first breakpoints, CSS Grid patterns, and scroll-queries.

**Key patterns covered:** Container Query basics, Container Query Units (cqi/cqb), Fluid Typography with clamp(), Container-Based Fluid Typography, Mobile-First Breakpoints, CSS Grid Responsive Patterns, Container Scroll-Queries (Chrome 126+).

## React Patterns

> See [rules/react-patterns.md](rules/react-patterns.md) for complete React examples: ResponsiveCard component, Tailwind container queries, useContainerQuery hook, and responsive images.

**Key patterns covered:** Responsive Component with Container Queries, Tailwind CSS Container Queries, useContainerQuery Hook, Responsive Images Pattern.

## Accessibility Considerations

```css
/* IMPORTANT: Always include rem in fluid typography */
/* This ensures user font preferences are respected */

/* ❌ WRONG: Viewport-only ignores user preferences */
font-size: 5vw;

/* ✅ CORRECT: Include rem to respect user settings */
font-size: clamp(1rem, 0.5rem + 2vw, 2rem);

/* User zooming must still work */
@media (min-width: 768px) {
  /* Use em/rem, not px, for breakpoints in ideal world */
  /* (browsers still use px, but consider user zoom) */
}
```

## Anti-Patterns (FORBIDDEN)

```css
/* ❌ NEVER: Use only viewport units for text */
.title {
  font-size: 5vw; /* Ignores user font preferences! */
}

/* ❌ NEVER: Use cqw/cqh (use cqi/cqb instead) */
.card {
  padding: 5cqw; /* cqw = container width, not logical */
}
/* ✅ CORRECT: Use logical units */
.card {
  padding: 5cqi; /* Container inline = logical direction */
}

/* ❌ NEVER: Container queries without container-type */
@container (min-width: 400px) {
  /* Won't work without container-type on parent! */
}

/* ❌ NEVER: Desktop-first media queries */
.element {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}
@media (max-width: 768px) {
  .element {
    grid-template-columns: 1fr; /* Overriding = more CSS */
  }
}

/* ❌ NEVER: Fixed pixel breakpoints for text */
@media (min-width: 768px) {
  body { font-size: 18px; } /* Use rem! */
}

/* ❌ NEVER: Over-nesting container queries */
@container a {
  @container b {
    @container c {
      /* Too complex, reconsider architecture */
    }
  }
}
```

## Browser Support

| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| Container Size Queries | 105+ | 16+ | 110+ | 105+ |
| Container Style Queries | 111+ | ❌ | ❌ | 111+ |
| Container Scroll-State | 126+ | ❌ | ❌ | 126+ |
| cqi/cqb units | 105+ | 16+ | 110+ | 105+ |
| clamp() | 79+ | 13.1+ | 75+ | 79+ |
| Subgrid | 117+ | 16+ | 71+ | 117+ |

## Rules

Each category has individual rule files in `rules/` loaded on-demand:

| Category | Rule | Impact | Key Pattern |
|----------|------|--------|-------------|
| CSS | `rules/css-patterns.md` | HIGH | Container queries, cqi/cqb, fluid typography, grid, scroll-queries |
| React | `rules/react-patterns.md` | HIGH | Container query components, Tailwind, useContainerQuery, responsive images |
| PWA | `rules/pwa-service-worker.md` | HIGH | Workbox caching strategies, VitePWA, update management |
| PWA | `rules/pwa-offline.md` | HIGH | Offline hooks, background sync, install prompts |
| Animation | `rules/animation-motion.md` | HIGH | Motion presets, AnimatePresence, View Transitions |
| Animation | `rules/animation-scroll.md` | MEDIUM | CSS scroll-driven animations, parallax, progressive enhancement |

**Total: 6 rules across 4 categories**

## Key Decisions

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Query type | Media queries | Container queries | **Container** for components, **Media** for layout |
| Container units | cqw/cqh | cqi/cqb | **cqi/cqb** (logical, i18n-ready) |
| Fluid type base | vw only | rem + vw | **rem + vw** (accessibility) |
| Mobile-first | Yes | Desktop-first | **Mobile-first** (less CSS, progressive) |
| Grid pattern | auto-fit | auto-fill | **auto-fit** for cards, **auto-fill** for icons |

## Related Skills

- `design-system-starter` - Building responsive design systems
- `ork:performance` - CLS, responsive images, and image optimization
- `ork:i18n-date-patterns` - RTL/LTR responsive considerations

## Capability Details

### container-queries
**Keywords**: @container, container-type, inline-size, container-name
**Solves**: Component-level responsive design

### fluid-typography
**Keywords**: clamp(), fluid, vw, rem, scale, typography
**Solves**: Smooth font scaling without breakpoints

### responsive-images
**Keywords**: srcset, sizes, picture, art direction
**Solves**: Responsive images for different viewports

### mobile-first-strategy
**Keywords**: min-width, mobile, progressive, breakpoints
**Solves**: Efficient responsive CSS architecture

### grid-flexbox-patterns
**Keywords**: auto-fit, auto-fill, subgrid, minmax
**Solves**: Responsive grid and flexbox layouts

### container-units
**Keywords**: cqi, cqb, container width, container height
**Solves**: Sizing relative to container dimensions

## References

- `references/container-queries.md` - Container query patterns
- `references/fluid-typography.md` - Accessible fluid type scales
- `scripts/responsive-card.tsx` - Responsive card component
