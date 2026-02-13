# Dropdown Menu Patterns

Accessible dropdown menus with Radix primitives.

## Basic Dropdown Menu

```tsx
import { DropdownMenu } from 'radix-ui'
import { ChevronDown } from 'lucide-react'

export function UserMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline">
          Options <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[200px] bg-white rounded-md shadow-lg p-1"
          sideOffset={5}
        >
          <DropdownMenu.Item className="px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer">
            Profile
          </DropdownMenu.Item>
          <DropdownMenu.Item className="px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer">
            Settings
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="h-px bg-gray-200 my-1" />
          <DropdownMenu.Item className="px-2 py-1.5 rounded hover:bg-red-100 text-red-600 cursor-pointer">
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
```

## With Checkbox Items

```tsx
export function ViewOptionsMenu() {
  const [showGrid, setShowGrid] = useState(true)
  const [showDetails, setShowDetails] = useState(false)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button>View</Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          <DropdownMenu.CheckboxItem
            checked={showGrid}
            onCheckedChange={setShowGrid}
          >
            <DropdownMenu.ItemIndicator>
              <Check className="h-4 w-4" />
            </DropdownMenu.ItemIndicator>
            Show Grid
          </DropdownMenu.CheckboxItem>

          <DropdownMenu.CheckboxItem
            checked={showDetails}
            onCheckedChange={setShowDetails}
          >
            <DropdownMenu.ItemIndicator>
              <Check className="h-4 w-4" />
            </DropdownMenu.ItemIndicator>
            Show Details
          </DropdownMenu.CheckboxItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
```

## With Radio Group

```tsx
export function SortMenu() {
  const [sort, setSort] = useState('date')

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button>Sort by</Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          <DropdownMenu.RadioGroup value={sort} onValueChange={setSort}>
            <DropdownMenu.RadioItem value="date">
              <DropdownMenu.ItemIndicator>
                <Circle className="h-2 w-2 fill-current" />
              </DropdownMenu.ItemIndicator>
              Date
            </DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="name">
              <DropdownMenu.ItemIndicator>
                <Circle className="h-2 w-2 fill-current" />
              </DropdownMenu.ItemIndicator>
              Name
            </DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="size">
              <DropdownMenu.ItemIndicator>
                <Circle className="h-2 w-2 fill-current" />
              </DropdownMenu.ItemIndicator>
              Size
            </DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
```

## With Submenus

```tsx
export function FileMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button>File</Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          <DropdownMenu.Item>New File</DropdownMenu.Item>
          <DropdownMenu.Item>Open</DropdownMenu.Item>

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>
              Export
              <ChevronRight className="ml-auto h-4 w-4" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent>
                <DropdownMenu.Item>PDF</DropdownMenu.Item>
                <DropdownMenu.Item>PNG</DropdownMenu.Item>
                <DropdownMenu.Item>SVG</DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Separator />
          <DropdownMenu.Item>Quit</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
```

## Custom Abstraction

```tsx
// components/ui/dropdown-menu.tsx
export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

export const DropdownMenuContent = React.forwardRef(
  ({ className, sideOffset = 4, ...props }, ref) => (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[8rem] rounded-md border bg-popover p-1 shadow-md',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
)

export const DropdownMenuItem = React.forwardRef(
  ({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
        'focus:bg-accent focus:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    />
  )
)
```

## Keyboard Navigation

Built-in keyboard support:
- **Arrow keys**: Navigate items
- **Enter/Space**: Select item
- **Escape**: Close menu
- **Right arrow**: Open submenu
- **Left arrow**: Close submenu
- **Type ahead**: Focus matching item
