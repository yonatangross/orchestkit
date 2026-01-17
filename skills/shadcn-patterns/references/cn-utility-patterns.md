# cn() Utility Patterns

Class merging with tailwind-merge and clsx.

## Setup

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

## What It Solves

### Problem: Tailwind Class Conflicts

```tsx
// Without cn() - px-4 and px-6 both apply (unpredictable)
<div className={`px-4 ${props.className}`}>
// If props.className = "px-6", result is "px-4 px-6" (conflict!)

// With cn() - px-6 wins (later class wins)
<div className={cn('px-4', props.className)}>
// Result: "px-6" (clean, predictable)
```

## Common Patterns

### Conditional Classes

```tsx
cn(
  'base-class',
  isActive && 'active-class',
  isDisabled && 'disabled-class'
)
// Falsy values are filtered out
```

### Object Syntax

```tsx
cn({
  'bg-blue-500': variant === 'primary',
  'bg-gray-500': variant === 'secondary',
  'opacity-50 cursor-not-allowed': disabled,
})
```

### With CVA Variants

```tsx
cn(buttonVariants({ variant, size }), className)
```

### Array of Classes

```tsx
cn([
  'flex items-center',
  'gap-2',
  'p-4',
])
```

## Real-World Component Examples

### Button with Override Support

```tsx
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(
        // Base styles
        'inline-flex items-center justify-center rounded-md font-medium',
        // Variant styles from CVA
        buttonVariants({ variant, size }),
        // Consumer overrides (wins over variants)
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
```

### Card with Conditional Styling

```tsx
function Card({ className, elevated, interactive, ...props }) {
  return (
    <div
      className={cn(
        // Base
        'rounded-lg border bg-card text-card-foreground',
        // Conditional
        elevated && 'shadow-lg',
        interactive && 'cursor-pointer hover:bg-accent transition-colors',
        // Overrides
        className
      )}
      {...props}
    />
  )
}
```

### Input with States

```tsx
function Input({ className, error, ...props }) {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // Error state
        error && 'border-destructive focus-visible:ring-destructive',
        className
      )}
      {...props}
    />
  )
}
```

## Order Matters

```tsx
// Classes are processed left to right
// Later classes override earlier ones for the same property

cn('text-red-500', 'text-blue-500')
// Result: "text-blue-500"

cn('p-4', 'p-2', 'p-8')
// Result: "p-8"

cn('text-sm md:text-base', 'text-lg')
// Result: "text-lg md:text-base"
// (base overridden, responsive preserved)
```

## With Responsive Classes

```tsx
cn(
  'grid grid-cols-1',
  'md:grid-cols-2',
  'lg:grid-cols-3',
  fullWidth && 'lg:grid-cols-4'
)
```

## Performance Notes

- `twMerge` is optimized and fast for typical use
- Avoid calling cn() in loops with dynamic classes
- For static classes, regular string concatenation is fine

```tsx
// ✅ Good - cn() handles conflicts
cn(baseClasses, props.className)

// ✅ Good - no conflicts possible
`${staticClass} ${anotherStatic}`

// ⚠️ Avoid - cn() in hot loop
items.map(item => cn(classes, item.className)) // Consider memoization
```
