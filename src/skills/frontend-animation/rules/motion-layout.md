---
title: "Motion: Layout Animations"
category: motion
impact: HIGH
---

# Layout Animations with Motion (Framer Motion)

All animations MUST use centralized presets from `@/lib/animations`. Never use inline animation values.

```typescript
// CORRECT: Import from animations.ts
import { motion, AnimatePresence } from 'motion/react';
import { fadeIn, slideUp, staggerContainer, modalContent } from '@/lib/animations';

// WRONG: Inline animation values
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
```

## Page Transitions

Wrap routes with `AnimatePresence` for smooth page changes:

```tsx
import { Routes, Route, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { pageFade } from '@/lib/animations';

export function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} {...pageFade} className="min-h-screen">
        <Routes location={location}>
          {/* routes */}
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}
```

## Modal Animations

Use `AnimatePresence` for enter/exit animations:

```tsx
import { motion, AnimatePresence } from 'motion/react';
import { modalBackdrop, modalContent } from '@/lib/animations';

function Modal({ isOpen, onClose, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            {...modalBackdrop}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            {...modalContent}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white rounded-2xl p-6 pointer-events-auto">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

## Staggered List Animations

Use parent container with child variants:

```tsx
import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/lib/animations';

function ItemList({ items }) {
  return (
    <motion.ul
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-2"
    >
      {items.map((item) => (
        <motion.li key={item.id} variants={staggerItem}>
          <ItemCard item={item} />
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

## Available Layout Presets

| Preset | Effect | Use For |
|--------|--------|---------|
| `fadeIn` | Opacity fade | Simple reveal |
| `fadeScale` | Fade + slight scale | Subtle emphasis |
| `slideUp` | Bottom to center | Cards, panels |
| `slideDown` | Top to center | Dropdowns |
| `slideInRight` | Right to center (RTL) | Hebrew UI |
| `slideInLeft` | Left to center | LTR content |
| `pageFade` | Simple fade | Route changes |
| `pageSlide` | RTL slide | Navigation |
| `modalBackdrop` | Overlay fade | Modal background |
| `modalContent` | Scale + fade | Modal body |
| `sheetContent` | Slide from bottom | Mobile sheets |
| `staggerContainer` | Parent with stagger | List wrappers |
| `staggerItem` | Fade + slide child | List items |

## Transition Timings

| Preset | Duration | Ease | Use For |
|--------|----------|------|---------|
| `transitions.fast` | 0.15s | easeOut | Micro-interactions |
| `transitions.normal` | 0.2s | easeOut | Most animations |
| `transitions.slow` | 0.3s | easeInOut | Emphasis effects |
| `transitions.spring` | spring | 300/25 | Playful elements |
| `transitions.gentleSpring` | spring | 200/20 | Modals/overlays |

## RTL/Hebrew Considerations

The animation presets are RTL-aware:
- `slideInRight` -- Natural entry direction for Hebrew
- `staggerItemRight` -- RTL list animations
- `pageSlide` -- Pages slide from left (correct for RTL)

## Anti-Patterns

```tsx
// NEVER use inline animation values
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

// NEVER animate without AnimatePresence for conditionals
{isOpen && <motion.div exit={{ opacity: 0 }}>}

// NEVER animate layout-heavy properties
<motion.div animate={{ width: newWidth, height: newHeight }}>

// NEVER use CSS transitions alongside Motion
<motion.div {...fadeIn} className="transition-all duration-300">
```
