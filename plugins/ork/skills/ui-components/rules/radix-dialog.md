---
title: "Radix: Dialog Patterns"
category: radix
impact: HIGH
impactDescription: "Implements accessible modal dialogs with built-in focus management and keyboard navigation using Radix primitives"
tags: radix, dialog, modal, accessibility, focus-trap
---

# Radix Dialog Patterns

Accessible modal dialogs with Radix primitives, including Dialog and AlertDialog.

## Dialog vs AlertDialog

| Feature | Dialog | AlertDialog |
|---------|--------|-------------|
| Close on overlay click | Yes | No |
| Close on Escape | Yes | Requires explicit action |
| Use case | Forms, content | Destructive confirmations |

## Basic Dialog

```tsx
import { Dialog } from 'radix-ui'

export function BasicDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button>Edit Profile</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6">
          <Dialog.Title>Edit Profile</Dialog.Title>
          <Dialog.Description>
            Make changes to your profile here.
          </Dialog.Description>
          {/* Form content */}
          <Dialog.Close asChild>
            <Button>Save changes</Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

## Controlled Dialog

```tsx
export function ControlledDialog() {
  const [open, setOpen] = useState(false)

  const handleSubmit = async () => {
    await saveData()
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button>Open</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <form onSubmit={handleSubmit}>
            {/* Form fields */}
            <Button type="submit">Save</Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

## AlertDialog (Destructive Actions)

```tsx
import { AlertDialog } from 'radix-ui'

export function DeleteConfirmation({ onDelete }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button variant="destructive">Delete</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6">
          <AlertDialog.Title>Are you sure?</AlertDialog.Title>
          <AlertDialog.Description>
            This action cannot be undone.
          </AlertDialog.Description>
          <div className="flex gap-4 justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="destructive" onClick={onDelete}>
                Delete
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
```

## Abstracting Dialog Components

Create reusable wrappers for consistent styling:

```tsx
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ children, className, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out"
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        'bg-background rounded-lg shadow-lg p-6 w-full max-w-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
```

## Animation with data-state

```css
[data-state="open"] .overlay {
  animation: fadeIn 150ms ease-out;
}
[data-state="closed"] .overlay {
  animation: fadeOut 150ms ease-in;
}

[data-state="open"] .content {
  animation: scaleIn 150ms ease-out;
}
[data-state="closed"] .content {
  animation: scaleOut 150ms ease-in;
}

@keyframes fadeIn { from { opacity: 0; } }
@keyframes fadeOut { to { opacity: 0; } }
@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } }
@keyframes scaleOut { to { transform: scale(0.95); opacity: 0; } }
```

**Incorrect — Using Dialog for destructive actions:**
```tsx
// Dialog closes on overlay click - unsafe for deletion
<Dialog.Root>
  <Dialog.Trigger>Delete Account</Dialog.Trigger>
  <Dialog.Content>
    <p>Delete your account?</p>
    <Button onClick={deleteAccount}>Yes, delete</Button>
  </Dialog.Content>
</Dialog.Root>
```

**Correct — AlertDialog for destructive actions:**
```tsx
// AlertDialog requires explicit action - safe
<AlertDialog.Root>
  <AlertDialog.Trigger>Delete Account</AlertDialog.Trigger>
  <AlertDialog.Content>
    <AlertDialog.Title>Are you sure?</AlertDialog.Title>
    <AlertDialog.Action onClick={deleteAccount}>Delete</AlertDialog.Action>
  </AlertDialog.Content>
</AlertDialog.Root>
```

## Accessibility Built-in

- Focus trapped within dialog
- Focus returns to trigger on close
- Escape closes dialog
- Click outside closes (Dialog only)
- Proper ARIA attributes
- Screen reader announcements
