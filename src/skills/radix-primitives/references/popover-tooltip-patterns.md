# Popover and Tooltip Patterns

Floating content with Radix primitives.

## Tooltip vs Popover vs HoverCard

| Component | Trigger | Content | Use Case |
|-----------|---------|---------|----------|
| **Tooltip** | Hover/Focus | Text only | Icon hints, abbreviations |
| **Popover** | Click | Interactive | Forms, rich content |
| **HoverCard** | Hover | Rich preview | User cards, link previews |

## Basic Tooltip

```tsx
import { Tooltip } from 'radix-ui'

export function IconWithTooltip() {
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Button size="icon" variant="ghost">
            <Settings className="h-4 w-4" />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-gray-900 text-white px-3 py-1.5 rounded text-sm"
            sideOffset={5}
          >
            Settings
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
```

## Tooltip Provider

Wrap your app for shared configuration:

```tsx
// app/layout.tsx
import { Tooltip } from 'radix-ui'

export default function RootLayout({ children }) {
  return (
    <Tooltip.Provider
      delayDuration={400}      // Delay before showing
      skipDelayDuration={300}  // Skip delay when moving between tooltips
    >
      {children}
    </Tooltip.Provider>
  )
}
```

## Basic Popover

```tsx
import { Popover } from 'radix-ui'

export function FilterPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="w-80 bg-white rounded-lg shadow-lg p-4"
          sideOffset={5}
        >
          <div className="space-y-4">
            <h4 className="font-medium">Filter options</h4>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select>
                <option>All</option>
                <option>Active</option>
                <option>Archived</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date range</Label>
              <Input type="date" />
            </div>

            <Button className="w-full">Apply filters</Button>
          </div>

          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

## Controlled Popover

```tsx
export function ControlledPopover() {
  const [open, setOpen] = useState(false)

  const handleSubmit = () => {
    // Process form
    setOpen(false) // Close after submit
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button>Add item</Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content>
          <form onSubmit={handleSubmit}>
            <Input placeholder="Item name" />
            <Button type="submit">Add</Button>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

## HoverCard (Rich Previews)

```tsx
import { HoverCard } from 'radix-ui'

export function UserHoverCard({ username }) {
  return (
    <HoverCard.Root>
      <HoverCard.Trigger asChild>
        <a href={`/user/${username}`} className="text-blue-500 hover:underline">
          @{username}
        </a>
      </HoverCard.Trigger>

      <HoverCard.Portal>
        <HoverCard.Content
          className="w-64 bg-white rounded-lg shadow-lg p-4"
          sideOffset={5}
        >
          <div className="flex gap-4">
            <Avatar src={`/avatars/${username}.jpg`} />
            <div>
              <h4 className="font-medium">{username}</h4>
              <p className="text-sm text-gray-500">Software Engineer</p>
              <p className="text-sm mt-2">Building cool things with React.</p>
            </div>
          </div>
          <HoverCard.Arrow className="fill-white" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
```

## Positioning

Common positioning props:

```tsx
<Content
  side="top"           // top | right | bottom | left
  sideOffset={5}       // Distance from trigger
  align="center"       // start | center | end
  alignOffset={0}      // Offset from alignment
  avoidCollisions={true}  // Flip if clipped
  collisionPadding={8}    // Viewport padding
/>
```

## Styling States

```css
/* Animation on open/close */
[data-state="open"] { animation: fadeIn 200ms ease-out; }
[data-state="closed"] { animation: fadeOut 150ms ease-in; }

/* Side-aware animations */
[data-side="top"] { animation-name: slideFromBottom; }
[data-side="bottom"] { animation-name: slideFromTop; }
[data-side="left"] { animation-name: slideFromRight; }
[data-side="right"] { animation-name: slideFromLeft; }
```
