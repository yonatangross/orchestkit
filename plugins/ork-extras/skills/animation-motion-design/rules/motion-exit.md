---
title: "Exit Animations with AnimatePresence"
impact: "HIGH"
impactDescription: "Without AnimatePresence, components unmount instantly from the DOM with no exit animation, creating jarring UI transitions"
tags: [motion, AnimatePresence, exit, unmount, mode-wait, mode-sync]
---

## Exit Animations with AnimatePresence

React removes components from the DOM immediately on unmount. `AnimatePresence` delays unmounting until exit animations complete.

**Incorrect:**
```tsx
// No AnimatePresence — exit prop is ignored, component vanishes instantly
function Notification({ show, message }: Props) {
  return show ? (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}  // This never runs!
    >
      {message}
    </motion.div>
  ) : null
}
```

**Correct:**
```tsx
// AnimatePresence wraps conditional rendering to enable exit animations
function Notification({ show, message }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="notification"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

### AnimatePresence Modes

```tsx
// mode="wait" — Wait for exiting component to finish before entering new one
<AnimatePresence mode="wait">
  <motion.div key={currentPage} {...pageTransition}>
    <CurrentPage />
  </motion.div>
</AnimatePresence>

// mode="sync" (default) — Enter and exit animations play simultaneously
<AnimatePresence mode="sync">
  {items.map((item) => (
    <motion.div key={item.id} exit={{ opacity: 0, scale: 0.8 }}>
      {item.content}
    </motion.div>
  ))}
</AnimatePresence>

// mode="popLayout" — Exiting elements are popped from layout flow immediately
<AnimatePresence mode="popLayout">
  {items.map((item) => (
    <motion.div key={item.id} layout exit={{ opacity: 0, x: -100 }}>
      {item.content}
    </motion.div>
  ))}
</AnimatePresence>
```

**Key rules:**
- Always wrap conditionally rendered `motion` components with `AnimatePresence`
- Every direct child of `AnimatePresence` must have a unique `key` prop
- Use `mode="wait"` for page transitions where old content should fully exit before new enters
- Use `mode="popLayout"` for lists where exiting items should not push remaining items around
- Keep exit animations short (150-250ms) — users should not wait for animations to complete

Reference: https://motion.dev/docs/animate-presence
