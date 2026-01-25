# CVA Variant System

Type-safe, declarative component variants with Class Variance Authority.

## Core Pattern

```tsx
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  // Base classes (always applied)
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)
```

## Type-Safe Props

```tsx
import { cn } from '@/lib/utils'

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
```

## Compound Variants

Apply classes when multiple variants are combined:

```tsx
const alertVariants = cva(
  'relative w-full rounded-lg border p-4',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive: 'border-destructive/50 text-destructive',
        success: 'border-green-500/50 text-green-700',
      },
      size: {
        default: 'text-sm',
        lg: 'text-base p-6',
      },
    },
    compoundVariants: [
      // When variant=destructive AND size=lg, add extra styles
      {
        variant: 'destructive',
        size: 'lg',
        className: 'border-2 font-semibold',
      },
      // Multiple variants can match
      {
        variant: ['destructive', 'success'],
        size: 'lg',
        className: 'shadow-lg',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)
```

## Boolean Variants

```tsx
const cardVariants = cva(
  'rounded-lg border bg-card text-card-foreground',
  {
    variants: {
      elevated: {
        true: 'shadow-lg',
        false: 'shadow-none',
      },
      interactive: {
        true: 'cursor-pointer hover:bg-accent transition-colors',
        false: '',
      },
    },
    defaultVariants: {
      elevated: false,
      interactive: false,
    },
  }
)

// Usage
<Card elevated interactive>Click me</Card>
```

## Extending Variants

```tsx
// Base badge variants
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

// Extended with status colors
const statusBadgeVariants = cva(
  badgeVariants({ variant: 'outline' }), // Use base as starting point
  {
    variants: {
      status: {
        pending: 'border-yellow-500 text-yellow-700 bg-yellow-50',
        active: 'border-green-500 text-green-700 bg-green-50',
        inactive: 'border-gray-500 text-gray-700 bg-gray-50',
        error: 'border-red-500 text-red-700 bg-red-50',
      },
    },
    defaultVariants: { status: 'pending' },
  }
)
```

## With Responsive Variants

CVA doesn't handle responsive directly, but combine with Tailwind:

```tsx
const layoutVariants = cva('grid gap-4', {
  variants: {
    columns: {
      1: 'grid-cols-1',
      2: 'grid-cols-1 md:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    },
  },
  defaultVariants: { columns: 1 },
})
```

## Best Practices

1. **Keep variants focused**: Each variant should have a single responsibility
2. **Use compound variants sparingly**: Only for complex combinations
3. **Default variants**: Always set sensible defaults
4. **Type exports**: Export `VariantProps` type for consumers
5. **Consistent naming**: `variant` for style, `size` for dimensions

## Anti-Patterns

```tsx
// ❌ Don't mix styling and behavior
const badVariants = cva('...', {
  variants: {
    onClick: { /* This should be a prop, not a variant */ }
  }
})

// ❌ Don't duplicate Tailwind breakpoints in variants
const badVariants = cva('...', {
  variants: {
    mobilePadding: { /* Use responsive Tailwind classes instead */ }
  }
})

// ✅ Keep variants about visual presentation
const goodVariants = cva('...', {
  variants: {
    variant: { /* visual style */ },
    size: { /* dimensions */ },
  }
})
```
