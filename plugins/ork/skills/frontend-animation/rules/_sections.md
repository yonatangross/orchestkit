---
title: Frontend Animation Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Motion Library (motion) -- HIGH -- 3 rules

React component animations using Motion (Framer Motion) with centralized presets, spring physics, and AnimatePresence.

- `motion-layout.md` -- AnimatePresence, page transitions, modal enter/exit, staggered lists
- `motion-gestures.md` -- Hover lift, tap scale, card hover, button press micro-interactions
- `motion-exit.md` -- AnimatePresence modes, collapse/expand, toast notifications, skeleton loaders

## 2. Scroll-Driven Animations (scroll) -- MEDIUM -- 3 rules

CSS Scroll-Driven Animations API for performant, declarative scroll-linked effects without JavaScript.

- `scroll-timeline.md` -- scroll() function, named scroll timelines, ScrollTimeline JS API
- `scroll-progress.md` -- view() function, animation-range, ViewTimeline JS API, reveal on scroll
- `scroll-snap.md` -- Parallax sections, sticky header animations, progressive enhancement fallbacks

## 3. View Transitions (transitions) -- MEDIUM -- 3 rules

View Transitions API for smooth page navigation, shared element morphing, and cross-document transitions.

- `transitions-view-api.md` -- startViewTransition, React Router viewTransition prop, flushSync pattern
- `transitions-morph.md` -- view-transition-name, shared elements, pseudo-element tree customization
- `transitions-cross-document.md` -- @view-transition rule, pageswap/pagereveal events, transition types
