---
title: "Motion: Gesture Interactions"
category: motion
impact: HIGH
---

# Gesture Interactions with Motion

Micro-interactions for hover, tap, and press feedback using centralized presets.

## Card Hover Interactions

Apply micro-interactions to cards:

```tsx
import { motion } from 'motion/react';
import { cardHover, tapScale } from '@/lib/animations';

function Card({ onClick, children }) {
  return (
    <motion.div
      {...cardHover}
      {...tapScale}
      onClick={onClick}
      className="p-4 rounded-lg bg-white cursor-pointer"
    >
      {children}
    </motion.div>
  );
}
```

## Button Press Feedback

```tsx
import { motion } from 'motion/react';
import { buttonPress } from '@/lib/animations';

function ActionButton({ onClick, children }) {
  return (
    <motion.button
      {...buttonPress}
      onClick={onClick}
      className="px-4 py-2 rounded-lg bg-primary text-white"
    >
      {children}
    </motion.button>
  );
}
```

## Available Gesture Presets

| Preset | Effect | Use For |
|--------|--------|---------|
| `tapScale` | Scale to 0.97 on tap | Buttons, cards |
| `hoverLift` | Y -2px + shadow on hover | Cards, list items |
| `buttonPress` | Scale 1.02 hover, 0.98 tap | Interactive buttons |
| `cardHover` | Y -4px + enhanced shadow | Card components |

## Combining Presets

You can spread multiple presets for combined effects:

```tsx
<motion.div {...cardHover} {...tapScale}>
  Interactive card with hover lift and tap scale
</motion.div>
```

## Custom Variants Extension

Extend presets for custom needs:

```typescript
const customHover = {
  ...cardHover,
  whileHover: {
    ...cardHover.whileHover,
    scale: 1.05, // Override scale
  },
};
```

## Performance Best Practices

1. **Use preset transitions** -- already optimized for 60fps
2. **Prefer opacity/transform** -- hardware accelerated
3. **Avoid layout animations on large lists** -- can cause jank
4. **Use `layout` prop sparingly** -- only when needed for layout shifts

```tsx
// CORRECT: Transform-based gesture
<motion.div {...hoverLift}>

// AVOID: Layout-heavy gesture
<motion.div whileHover={{ width: '100%', marginLeft: '20px' }}>
```

## Anti-Patterns

```tsx
// NEVER define inline hover/tap values
<motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>

// NEVER mix CSS :hover with Motion gestures
<motion.div {...cardHover} className="hover:scale-105">

// NEVER animate layout properties on gestures
<motion.div whileHover={{ width: '110%', padding: '2rem' }}>
```
