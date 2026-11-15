// CVA Component Template
// Copy and customize for your project

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// 1. Define variants with CVA
const componentVariants = cva(
  // Base classes (always applied)
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      // Visual style variant
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      // Size variant
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-sm',
        lg: 'h-11 rounded-md px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    // Compound variants for special combinations
    compoundVariants: [
      {
        variant: 'outline',
        size: 'lg',
        className: 'border-2',
      },
    ],
    // Defaults when props not provided
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

// 2. Define props interface
export interface ComponentProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof componentVariants> {
  asChild?: boolean
}

// 3. Create component with forwardRef
const Component = React.forwardRef<HTMLButtonElement, ComponentProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // Support polymorphism via Slot
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        className={cn(componentVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Component.displayName = 'Component'

// 4. Export component and variants
export { Component, componentVariants }

// Usage Examples:
/*
// Basic usage
<Component>Default Button</Component>

// With variants
<Component variant="destructive" size="lg">
  Delete
</Component>

// With custom classes (overrides)
<Component className="w-full">
  Full Width
</Component>

// As a link (polymorphic)
<Component asChild variant="link">
  <a href="/about">About Us</a>
</Component>

// Access variant classes directly (for composition)
import { componentVariants } from './component'
const classes = componentVariants({ variant: 'outline', size: 'sm' })
*/
