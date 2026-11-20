---
title: "Gesture Interactions with Motion"
impact: "HIGH"
impactDescription: "Without proper gesture handling, drag interactions feel sluggish, hover states flicker, and tap feedback is missing"
tags: [motion, gestures, drag, hover, tap, spring-physics, whileHover, whileTap]
---

## Gesture Interactions with Motion

Motion provides declarative gesture props (`whileHover`, `whileTap`, `whileDrag`) with spring physics for natural-feeling interactions.

**Incorrect:**
```tsx
// Using CSS transitions for interactive states — no spring physics, not interruptible
<button
  className="transition-transform duration-200 hover:scale-105 active:scale-95"
  onMouseDown={() => setPressed(true)}
  onMouseUp={() => setPressed(false)}
>
  Click me
</button>
```

**Correct:**
```tsx
// Motion gesture props — spring physics, interruptible, composable
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
>
  Click me
</motion.button>
```

### Drag Interactions

```tsx
<motion.div
  drag
  dragConstraints={{ left: -100, right: 100, top: -50, bottom: 50 }}
  dragElastic={0.2}
  dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
  whileDrag={{ scale: 1.1, cursor: "grabbing" }}
  onDragEnd={(event, info) => {
    if (Math.abs(info.offset.x) > 100) {
      handleSwipeDismiss(info.offset.x > 0 ? "right" : "left")
    }
  }}
>
  Drag me
</motion.div>
```

### Drag-to-Reorder

```tsx
import { Reorder } from "motion/react"

function ReorderableList({ items, onReorder }: Props) {
  return (
    <Reorder.Group axis="y" values={items} onReorder={onReorder}>
      {items.map((item) => (
        <Reorder.Item
          key={item.id}
          value={item}
          whileDrag={{ scale: 1.03, boxShadow: "0 8px 20px rgba(0,0,0,0.12)" }}
        >
          {item.label}
        </Reorder.Item>
      ))}
    </Reorder.Group>
  )
}
```

### Hover with Staggered Children

```tsx
const cardVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: { staggerChildren: 0.05 } },
}

const childVariants = {
  rest: { opacity: 0.7, y: 0 },
  hover: { opacity: 1, y: -2 },
}

<motion.div variants={cardVariants} initial="rest" whileHover="hover">
  <motion.h3 variants={childVariants}>Title</motion.h3>
  <motion.p variants={childVariants}>Description</motion.p>
</motion.div>
```

**Key rules:**
- Use `whileHover`, `whileTap`, `whileDrag` instead of CSS `:hover`/`:active` for interruptible animations
- Set `dragConstraints` to a ref or bounds object to prevent elements from leaving their container
- Use `dragElastic` (0-1) to control how far past constraints the element can be dragged
- Spring transitions with `stiffness: 300-500` and `damping: 15-25` feel most natural for gestures
- Combine `layout` with drag for list reordering using `Reorder.Group`

Reference: https://motion.dev/docs/gestures
