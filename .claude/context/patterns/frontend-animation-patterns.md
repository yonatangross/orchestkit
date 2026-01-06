# Frontend Animation Patterns

**Purpose**: Motion (Framer Motion) animation standards for consistent UI animations
**Last Updated**: 2026-01-06
**Source**: Issue #81 Motion animations integration

---

## Decision Summary

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Animation Library** | Motion (Framer Motion) | React 19 compatible, performant, declarative |
| **Preset Location** | `frontend/src/lib/animations.ts` | Centralized, reusable, maintainable |
| **Import Source** | `motion/react` | Official React 19 package |
| **RTL Support** | Built-in | `slideInRight` for Hebrew content |

---

## Quick Reference

### Imports

```tsx
import { motion, AnimatePresence } from 'motion/react';
import { fadeIn, modalContent, staggerContainer, staggerItem, cardHover, tapScale, collapse, pulse } from '@/lib/animations';
```

### Common Patterns

| Use Case | Presets |
|----------|---------|
| Page transitions | `pageFade` with `AnimatePresence mode="wait"` |
| Modal dialogs | `modalBackdrop` + `modalContent` |
| List animations | `staggerContainer` + `staggerItem` |
| Card interactions | `cardHover` + `tapScale` |
| Expandables | `collapse` with `AnimatePresence` |
| Skeletons | `pulse` variant |

---

## Critical Rules

1. **ALWAYS use presets** - Never inline animation values
2. **ALWAYS wrap conditionals** - Use `AnimatePresence` for exit animations
3. **NEVER mix CSS transitions** - Remove `transition-all` from Motion components
4. **NEVER use animate-pulse** - Use Motion `pulse` variant instead

---

## File Locations

| File | Purpose |
|------|---------|
| `frontend/src/lib/animations.ts` | All animation presets |
| `frontend/src/components/AnimatedRoutes.tsx` | Page transition wrapper |
| `frontend/src/components/ui/AnimatedDialog.tsx` | Animated dialog primitive |

---

*Migrated from: Issue #81 implementation (condensed reference)*
