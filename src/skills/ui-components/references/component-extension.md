# Component Extension Patterns

Extending shadcn/ui components without modifying source.

## Principle: Wrap, Don't Modify

shadcn/ui components are meant to be copied and owned. However, when extending:

1. **Wrap** the original component
2. **Forward refs** correctly
3. **Preserve** the variant system
4. **Add** new functionality as props

## Basic Extension: Adding Props

```tsx
import { Button as ShadcnButton } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface ExtendedButtonProps
  extends React.ComponentPropsWithoutRef<typeof ShadcnButton> {
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ExtendedButtonProps>(
  ({ loading, disabled, children, ...props }, ref) => (
    <ShadcnButton
      ref={ref}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </ShadcnButton>
  )
)
Button.displayName = 'Button'

export { Button }
```

## Adding New Variants

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { Button as ShadcnButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Extended variant system
const extendedButtonVariants = cva('', {
  variants: {
    glow: {
      true: 'shadow-lg shadow-primary/25 hover:shadow-primary/40',
      false: '',
    },
    pulse: {
      true: 'animate-pulse',
      false: '',
    },
  },
  defaultVariants: {
    glow: false,
    pulse: false,
  },
})

interface ExtendedButtonProps
  extends React.ComponentPropsWithoutRef<typeof ShadcnButton>,
    VariantProps<typeof extendedButtonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ExtendedButtonProps>(
  ({ className, glow, pulse, ...props }, ref) => (
    <ShadcnButton
      ref={ref}
      className={cn(extendedButtonVariants({ glow, pulse }), className)}
      {...props}
    />
  )
)
```

## Composition: Combining Components

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  onCancel?: () => void
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

## Polymorphic Extension with asChild

```tsx
import { Button } from '@/components/ui/button'
import { Slot } from '@radix-ui/react-slot'

interface IconButtonProps
  extends React.ComponentPropsWithoutRef<typeof Button> {
  icon: React.ReactNode
  label: string // For accessibility
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, asChild, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size="icon"
        aria-label={label}
        asChild={asChild}
        {...props}
      >
        {asChild ? (
          <Slot>{icon}</Slot>
        ) : (
          icon
        )}
      </Button>
    )
  }
)
```

## Form Field Wrapper

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

## Best Practices

1. **Always forward refs** - Components may need ref access
2. **Preserve displayName** - Helps with debugging
3. **Type props explicitly** - Use ComponentPropsWithoutRef
4. **Keep variants compatible** - Don't break existing API
5. **Document extensions** - Make custom props discoverable
