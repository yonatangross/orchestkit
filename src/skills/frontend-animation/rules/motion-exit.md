---
title: "Motion: Exit Animations"
category: motion
impact: HIGH
---

# Exit Animations with AnimatePresence

MANDATORY: Use `AnimatePresence` for any conditional render that needs exit animations.

## AnimatePresence Rules

```tsx
// CORRECT: Wrap conditional renders
<AnimatePresence>
  {isVisible && (
    <motion.div {...fadeIn}>Content</motion.div>
  )}
</AnimatePresence>

// WRONG: No exit animation possible
{isVisible && (
  <motion.div {...fadeIn}>Content</motion.div>
)}
```

**Mode options:**
- `mode="wait"` -- Wait for exit before enter (page transitions)
- `mode="popLayout"` -- Layout animations for removing items
- Default -- Simultaneous enter/exit

## Collapse/Expand Animations

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

**IMPORTANT**: Always use `overflow-hidden` on the collapse animated element.

| State | Height | Opacity | Duration |
|-------|--------|---------|----------|
| initial | 0 | 0 | - |
| animate | auto | 1 | 200ms |
| exit | 0 | 0 | 150ms |

## Toast/Notification Animations

```tsx
import { motion, AnimatePresence } from 'motion/react';
import { toastSlideIn } from '@/lib/animations';

function ToastContainer({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div key={toast.id} {...toastSlideIn}>
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

## Skeleton Loaders with Motion

Use Motion pulse for consistent loading animation:

```tsx
import { motion } from 'motion/react';
import { pulse } from '@/lib/animations';

function Skeleton({ className }) {
  return (
    <motion.div
      variants={pulse}
      initial="initial"
      animate="animate"
      className={"bg-gray-200 rounded " + className}
      aria-hidden="true"
    />
  );
}
```

## Loading State Presets

| Preset | Effect | Use For |
|--------|--------|---------|
| `pulse` | Opacity cycles 0.6-1 (1.5s, infinite) | Skeleton loaders |
| `shimmer` | Sliding highlight -100% to 100% (1.5s, infinite) | Shimmer effect |
| `toastSlideIn` | Slide from right + spring + scale | Notifications |
| `collapse` | Height 0 to auto | Accordions |

## Dropdown Animations

```tsx
import { motion, AnimatePresence } from 'motion/react';
import { dropdownDown } from '@/lib/animations';

function DropdownMenu({ isOpen, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div {...dropdownDown} className="absolute top-full mt-1">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

| Preset | Effect | Use For |
|--------|--------|---------|
| `dropdownDown` | Scale from top | Dropdown menus |
| `dropdownUp` | Scale from bottom | Context menus |

## Anti-Patterns

```tsx
// NEVER forget AnimatePresence for conditional exit animations
{isOpen && <motion.div exit={{ opacity: 0 }}>}

// NEVER animate height directly -- use collapse preset
<motion.div animate={{ height: isOpen ? 'auto' : 0 }}>

// NEVER forget overflow-hidden on collapse
<motion.div {...collapse}>  {/* Missing overflow-hidden! */}
```
