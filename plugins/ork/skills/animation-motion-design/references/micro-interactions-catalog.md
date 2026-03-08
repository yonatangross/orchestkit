---
title: "Micro-Interactions Catalog"
version: 1.0.0
---

# Micro-Interactions Catalog

Practical Motion patterns for common UI micro-interactions. Each example is production-ready and accessibility-aware.

## Button Press

```tsx
function AnimatedButton({ children, onClick }: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
      onClick={onClick}
    >
      {children}
    </motion.button>
  )
}
```

## Toggle Switch

```tsx
function Toggle({ isOn, onToggle }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={isOn}
      onClick={onToggle}
      className={`w-14 h-8 rounded-full p-1 ${isOn ? "bg-primary" : "bg-muted"}`}
    >
      <motion.div
        className="w-6 h-6 rounded-full bg-white"
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  )
}
```

## Checkbox with Checkmark Draw

```tsx
function AnimatedCheckbox({ checked, onChange }: CheckboxProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <motion.div
        className="w-5 h-5 rounded border-2 flex items-center justify-center"
        animate={{ borderColor: checked ? "var(--primary)" : "var(--border)" }}
      >
        <AnimatePresence>
          {checked && (
            <motion.svg
              key="check"
              viewBox="0 0 24 24"
              className="w-4 h-4 text-primary"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.path
                d="M5 12l5 5L20 7"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.div>
      <span>Label</span>
    </label>
  )
}
```

## Loading Spinner

```tsx
function Spinner({ size = 24 }: { size?: number }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      className="rounded-full border-2 border-muted border-t-primary"
      style={{ width: size, height: size }}
      animate={shouldReduceMotion
        ? { opacity: [0.5, 1, 0.5] }
        : { rotate: 360 }
      }
      transition={shouldReduceMotion
        ? { duration: 1.5, repeat: Infinity }
        : { duration: 0.8, repeat: Infinity, ease: "linear" }
      }
    />
  )
}
```

## Success Feedback

```tsx
function SuccessAnimation({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="success"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center"
        >
          <motion.svg
            viewBox="0 0 24 24"
            className="w-6 h-6 text-green-600"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          >
            <motion.path
              d="M5 12l5 5L20 7"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </motion.svg>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

## Error Shake

```tsx
function ShakeOnError({ hasError, children }: { hasError: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      animate={hasError ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  )
}
```

## Hover Reveal

```tsx
function HoverReveal({ children, revealContent }: HoverRevealProps) {
  return (
    <motion.div className="relative overflow-hidden" whileHover="hover" initial="rest">
      {children}
      <motion.div
        className="absolute inset-0 bg-black/60 flex items-center justify-center"
        variants={{
          rest: { opacity: 0 },
          hover: { opacity: 1 },
        }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          variants={{
            rest: { y: 10, opacity: 0 },
            hover: { y: 0, opacity: 1 },
          }}
          transition={{ delay: 0.05 }}
        >
          {revealContent}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
```

## Notification Badge Count

```tsx
function BadgeCount({ count }: { count: number }) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={count}
        initial={{ scale: 0.5, opacity: 0, y: -4 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.5, opacity: 0, y: 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        className="inline-flex items-center justify-center min-w-5 h-5 rounded-full bg-red-500 text-white text-xs px-1"
      >
        {count}
      </motion.span>
    </AnimatePresence>
  )
}
```
