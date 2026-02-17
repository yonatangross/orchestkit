---
title: "Radix: Composition"
category: radix
impact: HIGH
impactDescription: "Enables polymorphic component rendering and nested trigger composition through Radix's asChild pattern"
tags: radix, composition, asChild, slot, polymorphic
---

# Radix Composition Patterns

Polymorphic rendering with asChild, Slot, nested triggers, and ref forwarding.

## asChild Pattern

The `asChild` prop renders children as the component itself, merging props and refs:

```tsx
// Without asChild - nested elements
<Button>
  <Link href="/about">About</Link>
</Button>
// Renders: <button><a href="/about">About</a></button>

// With asChild - single element
<Button asChild>
  <Link href="/about">About</Link>
</Button>
// Renders: <a href="/about" class="button-styles">About</a>
```

**How it works** (via Radix `Slot`):
1. **Props merging**: Parent props spread to child
2. **Ref forwarding**: Refs correctly forwarded
3. **Event combining**: Both onClick handlers fire
4. **Class merging**: ClassNames combined

## Nested Composition

Combine multiple Radix triggers on a single element:

```tsx
import { Dialog, Tooltip } from 'radix-ui'

const MyButton = React.forwardRef((props, ref) => (
  <button {...props} ref={ref} />
))

export function DialogWithTooltip() {
  return (
    <Dialog.Root>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Dialog.Trigger asChild>
            <MyButton>Open dialog</MyButton>
          </Dialog.Trigger>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content>Click to open dialog</Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>Dialog content</Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

## Common Patterns

### Link as Button

```tsx
<Button asChild variant="outline">
  <Link href="/settings">Settings</Link>
</Button>
```

### Icon Button

```tsx
<Button asChild size="icon">
  <a href="https://github.com" target="_blank">
    <GitHubIcon />
  </a>
</Button>
```

### Menu Item as Link

```tsx
<DropdownMenu.Item asChild>
  <Link href="/profile">Profile</Link>
</DropdownMenu.Item>
```

### Polymorphic Extension with Slot

```tsx
import { Slot } from '@radix-ui/react-slot'

interface IconButtonProps
  extends React.ComponentPropsWithoutRef<typeof Button> {
  icon: React.ReactNode
  label: string
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, asChild, ...props }, ref) => (
    <Button ref={ref} size="icon" aria-label={label} asChild={asChild} {...props}>
      {asChild ? <Slot>{icon}</Slot> : icon}
    </Button>
  )
)
```

## When to Use asChild

| Use Case | Use asChild? |
|----------|--------------|
| Link styled as button | Yes |
| Combining triggers | Yes |
| Custom element with Radix behavior | Yes |
| Default element is fine | No |
| Adds complexity without benefit | No |

## Requirements for Child Components

The child component MUST:

1. **Forward refs** with `React.forwardRef`
2. **Spread props** to underlying element
3. Be a **single element** (not fragment)

```tsx
// CORRECT - forwards ref and spreads props
const MyButton = React.forwardRef<HTMLButtonElement, Props>(
  (props, ref) => <button ref={ref} {...props} />
)

// INCORRECT - no ref forwarding
const MyButton = (props) => <button {...props} />
```

## Primitives Catalog

### Overlay Components
| Primitive | Use Case |
|-----------|----------|
| **Dialog** | Modal dialogs, forms, confirmations |
| **AlertDialog** | Destructive action confirmations |
| **Sheet** | Side panels, mobile drawers |

### Popover Components
| Primitive | Use Case |
|-----------|----------|
| **Popover** | Rich content on trigger |
| **Tooltip** | Simple text hints |
| **HoverCard** | Preview cards on hover |
| **ContextMenu** | Right-click menus |

### Menu Components
| Primitive | Use Case |
|-----------|----------|
| **DropdownMenu** | Action menus |
| **Menubar** | Application menubars |
| **NavigationMenu** | Site navigation |

### Form Components
| Primitive | Use Case |
|-----------|----------|
| **Select** | Custom select dropdowns |
| **RadioGroup** | Single selection groups |
| **Checkbox** | Boolean toggles |
| **Switch** | On/off toggles |
| **Slider** | Range selection |

**Incorrect — No ref forwarding:**
```tsx
// asChild won't work - no ref support
const MyButton = (props) => <button {...props} />

<Button asChild>
  <MyButton>Click</MyButton>
</Button>
```

**Correct — Ref forwarding required:**
```tsx
// Forwards ref and spreads props
const MyButton = React.forwardRef<HTMLButtonElement, Props>(
  (props, ref) => <button ref={ref} {...props} />
)

<Button asChild>
  <MyButton>Click</MyButton>
</Button>
```

### Disclosure Components
| Primitive | Use Case |
|-----------|----------|
| **Accordion** | Expandable sections |
| **Collapsible** | Single toggle content |
| **Tabs** | Tabbed interfaces |
