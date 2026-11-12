---
title: "Motion Accessibility"
impact: "CRITICAL"
impactDescription: "Ignoring prefers-reduced-motion causes vestibular disorders, seizures, and nausea for users with motion sensitivity (~35% of adults)"
tags: [accessibility, prefers-reduced-motion, reduced-motion, vestibular, cognitive-load, a11y]
---

## Motion Accessibility

Approximately 35% of adults experience motion sensitivity. All animations must respect `prefers-reduced-motion` and provide meaningful alternatives that preserve information without causing harm.

**Incorrect:**
```tsx
// No reduced motion check — harmful to motion-sensitive users
<motion.div
  animate={{ x: [0, 100, 0], rotate: [0, 360] }}
  transition={{ duration: 2, repeat: Infinity }}
>
  Loading...
</motion.div>
```

**Correct:**
```tsx
import { useReducedMotion } from "motion/react"

function LoadingIndicator() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      animate={shouldReduceMotion
        ? { opacity: [0.5, 1] }  // Gentle opacity pulse instead
        : { x: [0, 100, 0], rotate: [0, 360] }
      }
      transition={shouldReduceMotion
        ? { duration: 1.5, repeat: Infinity }
        : { duration: 2, repeat: Infinity }
      }
    >
      Loading...
    </motion.div>
  )
}
```

### Global Reduced Motion CSS

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Accessible Motion Preset Factory

```tsx
import { useReducedMotion, type Variants } from "motion/react"

function useAccessibleVariants(
  full: Variants,
  reduced: Variants
): Variants {
  const shouldReduceMotion = useReducedMotion()
  return shouldReduceMotion ? reduced : full
}

// Usage
const variants = useAccessibleVariants(
  { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } },
  { initial: { opacity: 0 }, animate: { opacity: 1 } }
)
```

### Cognitive Load Guidelines

| Motion Type | Duration | Reduced Motion Alternative |
|-------------|----------|---------------------------|
| Micro-interaction (button, toggle) | 100-200ms | Instant or opacity-only |
| Component enter/exit | 200-350ms | Instant opacity fade |
| Page transition | 200-400ms | Instant crossfade |
| Loading/progress | Continuous | Gentle opacity pulse |
| Parallax scrolling | Continuous | Static positioning |
| Auto-playing carousel | Continuous | **Remove entirely** |

**Key rules:**
- Always call `useReducedMotion()` and provide a meaningful reduced alternative
- Never remove animations entirely — replace motion with opacity changes to preserve feedback
- Auto-playing animations (carousels, marquees) must be completely disabled for reduced motion
- Test with `prefers-reduced-motion: reduce` enabled in browser DevTools
- Forced-colors mode breaks color-dependent animations — add border or outline alternatives

Reference: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
