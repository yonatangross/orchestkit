---
title: Motion Library & View Transitions
impact: HIGH
impactDescription: "Inconsistent animation implementations create janky UX and accessibility issues — Motion library with centralized presets ensures 60fps and reduced-motion compliance"
tags: motion, framer-motion, view-transitions, AnimatePresence, page-transitions
---

## Motion Library & View Transitions

Use Motion (Framer Motion) for React component animations and View Transitions API for page navigation with consistent presets.

**Incorrect — inline animation values without presets:**
```tsx
// WRONG: Inconsistent animation values, no reduced-motion support
<motion.div
  initial={{ opacity: 0, y: 50, scale: 0.8 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={{ duration: 0.7, ease: "easeInOut" }}
>
  {/* Different values everywhere, no consistency */}
</motion.div>
```

**Correct — centralized presets with AnimatePresence:**
```tsx
// lib/animations.ts — Single source of truth
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { type: 'spring', stiffness: 300, damping: 30 },
};

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// Usage with AnimatePresence for exit animations
import { motion, AnimatePresence } from 'motion/react';
import { staggerContainer, staggerItem, fadeInUp } from '@/lib/animations';

function AnimatedList({ items }: { items: Item[] }) {
  return (
    <AnimatePresence mode="wait">
      <motion.ul variants={staggerContainer} initial="initial" animate="animate">
        {items.map((item) => (
          <motion.li key={item.id} variants={staggerItem} layout>
            {item.name}
          </motion.li>
        ))}
      </motion.ul>
    </AnimatePresence>
  );
}
```

**View Transitions API for page navigation:**
```tsx
// React Router with View Transitions
import { Link, useViewTransitionState } from 'react-router';

function ProductCard({ product }: { product: Product }) {
  const isTransitioning = useViewTransitionState(`/products/${product.id}`);
  return (
    <Link to={`/products/${product.id}`} viewTransition>
      <img
        src={product.image}
        alt={product.name}
        style={{
          viewTransitionName: isTransitioning ? 'product-image' : undefined,
        }}
      />
    </Link>
  );
}
```

**Key rules:**
- Animate only `transform` and `opacity` for 60fps (hardware accelerated)
- Use centralized preset files, never inline animation values
- Always wrap conditional renders in `AnimatePresence` for exit animations
- Respect `prefers-reduced-motion: reduce` — disable or shorten animations
- Keep transitions under 400ms to avoid blocking user interaction
- Use View Transitions API for page navigation, Motion for component animations
