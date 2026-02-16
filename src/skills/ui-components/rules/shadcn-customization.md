---
title: "shadcn/ui: Customization"
category: shadcn
impact: HIGH
impactDescription: "Establishes type-safe component variants and OKLCH theming patterns through CVA and tailwind-merge"
tags: shadcn, cva, theming, oklch, variants
---

# shadcn/ui Customization

CVA variant system, cn() class merging, OKLCH theming, and component extension patterns.

## CVA (Class Variance Authority)

Declarative, type-safe variant definitions:

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
    compoundVariants: [
      { variant: 'outline', size: 'lg', className: 'border-2' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

// Type-safe props
interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}
```

### Boolean Variants

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
    defaultVariants: { elevated: false, interactive: false },
  }
)
```

## cn() Utility

Combines `clsx` + `tailwind-merge` for conflict resolution:

```tsx
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Usage - later classes win
cn('px-4 py-2', 'px-6')  // => 'py-2 px-6'
cn('text-red-500', condition && 'text-blue-500')

// With CVA variants
cn(buttonVariants({ variant, size }), className)
```

## OKLCH Theming (2026 Standard)

Modern perceptually uniform color space:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.141 25.723);
}
```

**Why OKLCH?** Perceptually uniform (equal steps look equal), better dark mode contrast, wide gamut support. Format: `oklch(lightness chroma hue)`.

## Component Extension Strategy

**Wrap, don't modify source:**

```tsx
import { Button as ShadcnButton } from '@/components/ui/button'

interface ExtendedButtonProps
  extends React.ComponentPropsWithoutRef<typeof ShadcnButton> {
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ExtendedButtonProps>(
  ({ loading, disabled, children, ...props }, ref) => (
    <ShadcnButton ref={ref} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </ShadcnButton>
  )
)
Button.displayName = 'Button'
```

## CLI Quick Reference

```bash
npx shadcn@latest init        # Initialize in project
npx shadcn@latest add button  # Add components
npx shadcn@latest add dialog card input label
```

**Incorrect — Modifying shadcn source files:**
```tsx
// Editing components/ui/button.tsx directly
const buttonVariants = cva('...', {
  variants: {
    myCustomVariant: '...'  // Modified source!
  }
})
```

**Correct — Wrap, don't modify:**
```tsx
// Create wrapper component
import { Button as ShadcnButton } from '@/components/ui/button'

interface ExtendedButtonProps extends React.ComponentPropsWithoutRef<typeof ShadcnButton> {
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ExtendedButtonProps>(
  ({ loading, ...props }, ref) => (
    <ShadcnButton ref={ref} {...props}>
      {loading && <Loader />}
      {props.children}
    </ShadcnButton>
  )
)
```

## Best Practices

1. **Keep variants focused**: Each variant should have a single responsibility
2. **Always forward refs**: Components may need ref access
3. **Use compound variants sparingly**: Only for complex combinations
4. **Type exports**: Export `VariantProps` type for consumers
5. **Preserve displayName**: Helps with debugging
