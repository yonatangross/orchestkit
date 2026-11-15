---
title: Animation & Motion Design Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Motion Library (motion) — HIGH — 3 rules

Component-level animations using Motion (formerly Framer Motion).

- `motion-layout.md` — FLIP layout animations, shared layout, layoutId
- `motion-gestures.md` — Drag, hover, tap with spring physics, whileHover/whileTap
- `motion-exit.md` — AnimatePresence, exit animations, mode="wait"|"sync"|"popLayout"

## 2. View Transitions API (view-transitions) — HIGH — 1 rule

Browser-native page transitions for navigation and cross-document animations.

- `view-transitions-api.md` — document.startViewTransition, React Router integration, viewTransitionName

## 3. Motion Quality (quality) — CRITICAL/HIGH — 2 rules

Accessibility and performance guardrails for all animation work.

| Rule | Impact | File |
|------|--------|------|
| Motion Accessibility | CRITICAL | `motion-accessibility.md` |
| Motion Performance | HIGH | `motion-performance.md` |
