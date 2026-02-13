# asChild Composition Pattern

Polymorphic rendering without wrapper divs.

## What is asChild?

The `asChild` prop renders children as the component itself, merging props and refs. This avoids extra DOM elements while preserving functionality.

## Basic Usage

```tsx
import { Button } from '@/components/ui/button'
import Link from 'next/link'

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

## How It Works

Under the hood, `asChild` uses Radix's `Slot` component:

1. **Props merging**: Parent props spread to child
2. **Ref forwarding**: Refs correctly forwarded
3. **Event combining**: Both onClick handlers fire
4. **Class merging**: ClassNames combined

```tsx
// Internal implementation concept
function Slot({ children, ...props }) {
  return React.cloneElement(children, {
    ...props,
    ...children.props,
    ref: mergeRefs(props.ref, children.ref),
    className: cn(props.className, children.props.className),
    onClick: chain(props.onClick, children.props.onClick),
  })
}
```

## Nested Composition

Combine multiple Radix triggers:

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

## When to Use

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
// ✅ Correct - forwards ref and spreads props
const MyButton = React.forwardRef<HTMLButtonElement, Props>(
  (props, ref) => <button ref={ref} {...props} />
)

// ❌ Incorrect - no ref forwarding
const MyButton = (props) => <button {...props} />
```
