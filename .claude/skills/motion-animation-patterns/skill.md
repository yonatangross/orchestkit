---
name: motion-animation-patterns
description: Use this skill for implementing Motion (Framer Motion) animations in React applications. Covers animation presets, page transitions, modal animations, list stagger effects, hover interactions, skeleton loaders, and RTL-aware animation patterns.
version: 1.0.0
author: SkillForge Team
tags: [motion, framer-motion, animation, react, ux, transitions, hover, stagger, skeleton]
---

# Motion Animation Patterns

## Overview

This skill provides comprehensive guidance for implementing Motion (Framer Motion) animations in React 19 applications. It ensures consistent, performant, and accessible animations across the UI using centralized animation presets.

**When to use this skill:**
- Adding page transition animations
- Implementing modal/dialog entrance/exit animations
- Creating staggered list animations
- Adding hover and tap micro-interactions
- Implementing skeleton loading states
- Creating collapse/expand animations
- Building toast/notification animations

**Bundled Resources:**
- `references/animation-presets.md` - Complete preset API reference
- `examples/component-patterns.md` - Common animation patterns

---

## Core Architecture

### Animation Presets Library (`frontend/src/lib/animations.ts`)

All animations MUST use the centralized `animations.ts` presets. This ensures:
- Consistent motion language across the app
- RTL-aware animations (Hebrew support)
- Performance optimization
- Easy maintainability

```typescript
// ✅ CORRECT: Import from animations.ts
import { motion, AnimatePresence } from 'motion/react';
import { fadeIn, slideUp, staggerContainer, modalContent } from '@/lib/animations';

// ❌ WRONG: Inline animation values
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
```

---

## Available Presets

### Transition Timing

| Preset | Duration | Ease | Use For |
|--------|----------|------|---------|
| `transitions.fast` | 0.15s | easeOut | Micro-interactions |
| `transitions.normal` | 0.2s | easeOut | Most animations |
| `transitions.slow` | 0.3s | easeInOut | Emphasis effects |
| `transitions.spring` | spring | 300/25 | Playful elements |
| `transitions.gentleSpring` | spring | 200/20 | Modals/overlays |

### Basic Animations

| Preset | Effect | Use For |
|--------|--------|---------|
| `fadeIn` | Opacity fade | Simple reveal |
| `fadeScale` | Fade + slight scale | Subtle emphasis |
| `scaleIn` | Fade + scale from center | Badges, buttons |

### Slide Animations (RTL-Aware)

| Preset | Direction | Use For |
|--------|-----------|---------|
| `slideInRight` | Right to center | RTL Hebrew UI (natural) |
| `slideInLeft` | Left to center | LTR content |
| `slideUp` | Bottom to center | Cards, panels |
| `slideDown` | Top to center | Dropdowns |

### List/Stagger Animations

| Preset | Effect | Use For |
|--------|--------|---------|
| `staggerContainer` | Parent with stagger | List wrappers |
| `staggerContainerFast` | Fast stagger | Quick lists |
| `staggerItem` | Fade + slide child | List items |
| `staggerItemRight` | RTL slide child | Hebrew lists |

### Modal/Dialog Animations

| Preset | Effect | Use For |
|--------|--------|---------|
| `modalBackdrop` | Overlay fade | Modal background |
| `modalContent` | Scale + fade | Modal body |
| `sheetContent` | Slide from bottom | Mobile sheets |
| `dropdownDown` | Scale from top | Dropdown menus |
| `dropdownUp` | Scale from bottom | Context menus |

### Page Transitions

| Preset | Effect | Use For |
|--------|--------|---------|
| `pageFade` | Simple fade | Route changes |
| `pageSlide` | RTL slide | Navigation |

### Micro-Interactions

| Preset | Effect | Use For |
|--------|--------|---------|
| `tapScale` | Scale on tap | Buttons, cards |
| `hoverLift` | Lift + shadow | Cards, list items |
| `buttonPress` | Press effect | Interactive buttons |
| `cardHover` | Hover emphasis | Card components |

### Loading States

| Preset | Effect | Use For |
|--------|--------|---------|
| `pulse` | Opacity pulse | Skeleton loaders |
| `shimmer` | Sliding highlight | Shimmer effect |

### Utility Animations

| Preset | Effect | Use For |
|--------|--------|---------|
| `toastSlideIn` | Slide + scale | Notifications |
| `collapse` | Height animation | Accordions |

---

## Implementation Patterns

### 1. Page Transitions

Wrap routes with `AnimatePresence` for smooth page changes:

```tsx
// frontend/src/components/AnimatedRoutes.tsx
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

### 2. Modal Animations

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

### 3. Staggered List Animations

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

### 4. Card Hover Interactions

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

### 5. Skeleton Loaders with Motion

Use Motion pulse for consistent animation:

```tsx
import { motion } from 'motion/react';
import { pulse } from '@/lib/animations';

function Skeleton({ className }) {
  return (
    <motion.div
      variants={pulse}
      initial="initial"
      animate="animate"
      className={`bg-gray-200 rounded ${className}`}
      aria-hidden="true"
    />
  );
}
```

### 6. Collapse/Expand Animations

For accordions and expandable sections:

```tsx
import { motion, AnimatePresence } from 'motion/react';
import { collapse } from '@/lib/animations';

function Accordion({ isExpanded, children }) {
  return (
    <AnimatePresence>
      {isExpanded && (
        <motion.div {...collapse} className="overflow-hidden">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

## AnimatePresence Rules

**MANDATORY**: Use `AnimatePresence` for exit animations:

```tsx
// ✅ CORRECT: Wrap conditional renders
<AnimatePresence>
  {isVisible && (
    <motion.div {...fadeIn}>Content</motion.div>
  )}
</AnimatePresence>

// ❌ WRONG: No exit animation
{isVisible && (
  <motion.div {...fadeIn}>Content</motion.div>
)}
```

**Mode options:**
- `mode="wait"` - Wait for exit before enter (page transitions)
- `mode="popLayout"` - Layout animations for removing items
- Default - Simultaneous enter/exit

---

## RTL/Hebrew Considerations

The animation presets are RTL-aware:
- `slideInRight` - Natural entry direction for Hebrew
- `staggerItemRight` - RTL list animations
- `pageSlide` - Pages slide from left (correct for RTL)

---

## Performance Best Practices

1. **Use preset transitions**: Already optimized
2. **Avoid layout animations on large lists**: Can cause jank
3. **Use `layout` prop sparingly**: Only when needed
4. **Prefer opacity/transform**: Hardware accelerated
5. **Don't animate width/height directly**: Use `collapse` preset

```tsx
// ✅ CORRECT: Transform-based
<motion.div {...slideUp}>

// ❌ AVOID: Layout-heavy
<motion.div animate={{ width: '100%', marginLeft: '20px' }}>
```

---

## Testing Animations

Verify 60fps performance:
1. Open Chrome DevTools > Performance tab
2. Record while triggering animations
3. Check for frame drops below 60fps

---

## Checklist for New Components

When adding animations:

- [ ] Import from `@/lib/animations`, not inline values
- [ ] Use `AnimatePresence` for conditional renders
- [ ] Apply appropriate preset for the interaction type
- [ ] Test with RTL locale (Hebrew)
- [ ] Verify 60fps performance
- [ ] Ensure animations don't block user interaction

---

## Anti-Patterns (FORBIDDEN)

```tsx
// ❌ NEVER use inline animation values
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

// ❌ NEVER animate without AnimatePresence for conditionals
{isOpen && <motion.div exit={{ opacity: 0 }}>}

// ❌ NEVER animate layout-heavy properties
<motion.div animate={{ width: newWidth, height: newHeight }}>

// ❌ NEVER use CSS transitions alongside Motion
<motion.div {...fadeIn} className="transition-all duration-300">
```

---

## Integration with Agents

### Frontend UI Developer
- Uses animation presets for all motion effects
- References this skill for implementation patterns
- Ensures consistent animation language

### Rapid UI Designer
- Specifies animation types in design specs
- References available presets for motion design

### Code Quality Reviewer
- Checks for inline animation anti-patterns
- Validates AnimatePresence usage
- Ensures performance best practices

---

**Skill Version**: 1.0.0
**Last Updated**: 2026-01-06
**Maintained by**: SkillForge Team
