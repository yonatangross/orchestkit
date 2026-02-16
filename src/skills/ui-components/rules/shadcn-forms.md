---
title: "shadcn/ui: Forms"
category: shadcn
impact: HIGH
impactDescription: "Defines accessible form field patterns with proper label association and validation error handling"
tags: shadcn, forms, validation, accessibility, form-fields
---

# shadcn/ui Form Patterns

Form field wrappers, validation states, and react-hook-form integration.

## Form Field Wrapper

Reusable wrapper that associates Label, Input, and error messages:

```tsx
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FormFieldProps extends React.ComponentPropsWithoutRef<typeof Input> {
  label: string
  error?: string
  description?: string
}

const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, description, className, id, ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className={cn('space-y-2', className)}>
        <Label htmlFor={inputId}>{label}</Label>
        <Input
          ref={ref}
          id={inputId}
          aria-describedby={error ? `${inputId}-error` : undefined}
          aria-invalid={!!error}
          className={cn(error && 'border-destructive')}
          {...props}
        />
        {description && !error && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }
)
```

## Input with States

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
        error && 'border-destructive focus-visible:ring-destructive',
        className
      )}
      {...props}
    />
  )
}
```

## Confirm Dialog (Form Composition)

```tsx
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  variant?: 'default' | 'destructive'
}

export function ConfirmDialog({
  open, onOpenChange, title, description,
  onConfirm, variant = 'default',
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={() => { onConfirm(); onOpenChange(false) }}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

## Dark Mode Toggle

```tsx
'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ModeToggle() {
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

## Hydration Safety

```tsx
'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeAwareComponent() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return <Skeleton />

  return <div>Current theme: {resolvedTheme}</div>
}
```

**Incorrect — Missing label association:**
```tsx
// Not accessible - label not linked to input
<div>
  <label>Email</label>
  <input type="email" />
</div>
```

**Correct — Proper label association:**
```tsx
// Accessible with htmlFor and id
<div>
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    aria-describedby={error ? "email-error" : undefined}
  />
  {error && <p id="email-error">{error}</p>}
</div>
```

## Dependencies

```bash
npm install next-themes              # Theme switching
npm install class-variance-authority # CVA variants
npm install clsx tailwind-merge      # Class merging
npm install react-hook-form          # Form management
npm install lucide-react             # Icons
```
