---
title: "Radix: Styling & Focus"
category: radix
impact: HIGH
impactDescription: "Provides state-driven styling patterns and focus management strategies through Radix data attributes"
tags: radix, styling, data-attributes, focus-management, keyboard-navigation
---

# Radix Styling & Focus Management

Data attributes, Tailwind arbitrary variants, keyboard navigation, and focus management.

## Styling with Data Attributes

Radix exposes state via data attributes for CSS styling:

```css
/* Style based on state */
[data-state="open"] { /* open styles */ }
[data-state="closed"] { /* closed styles */ }
[data-disabled] { /* disabled styles */ }
[data-highlighted] { /* keyboard focus */ }
```

```tsx
// Tailwind arbitrary variants
<Dialog.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out">
```

## Dropdown Menu Styling

```tsx
const DropdownMenuContent = React.forwardRef(
  ({ className, sideOffset = 4, ...props }, ref) => (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[8rem] rounded-md border bg-popover p-1 shadow-md',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
          'data-[side=bottom]:slide-in-from-top-2',
          'data-[side=left]:slide-in-from-right-2',
          'data-[side=right]:slide-in-from-left-2',
          'data-[side=top]:slide-in-from-bottom-2',
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
)

const DropdownMenuItem = React.forwardRef(
  ({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
        'focus:bg-accent focus:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    />
  )
)
```

## Popover and Tooltip

```tsx
// Tooltip with Provider for shared configuration
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
```

## Positioning Props

```tsx
<Content
  side="top"              // top | right | bottom | left
  sideOffset={5}          // Distance from trigger
  align="center"          // start | center | end
  alignOffset={0}         // Offset from alignment
  avoidCollisions={true}  // Flip if clipped
  collisionPadding={8}    // Viewport padding
/>
```

## Side-Aware Animations

```css
[data-state="open"] { animation: fadeIn 200ms ease-out; }
[data-state="closed"] { animation: fadeOut 150ms ease-in; }

[data-side="top"] { animation-name: slideFromBottom; }
[data-side="bottom"] { animation-name: slideFromTop; }
[data-side="left"] { animation-name: slideFromRight; }
[data-side="right"] { animation-name: slideFromLeft; }
```

## Built-in Accessibility

Every Radix primitive includes:
- **Keyboard navigation**: Arrow keys, Escape, Enter, Tab
- **Focus management**: Trap, return, visible focus rings
- **ARIA attributes**: Roles, states, properties
- **Screen reader**: Proper announcements

## Focus Management

### Dialog Focus Trap

```tsx
<Dialog.Content
  onOpenAutoFocus={(event) => {
    event.preventDefault()
    document.getElementById('email-input')?.focus()
  }}
  onCloseAutoFocus={(event) => {
    event.preventDefault()
    document.getElementById('other-element')?.focus()
  }}
>
```

### Escape Key Handling

```tsx
<Dialog.Content
  onEscapeKeyDown={(event) => {
    if (hasUnsavedChanges) {
      event.preventDefault()
      showConfirmDialog()
    }
  }}
>
```

## Focus Visible Styling

```css
[data-focus-visible] {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

```tsx
<Button className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
```

**Incorrect — Manual state styling:**
```tsx
// Hard to maintain, breaks when state changes
<div className={isOpen ? "opacity-100" : "opacity-0"}>
```

**Correct — Data attribute styling:**
```tsx
// Uses Radix's built-in state tracking
<Dialog.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out">
```

## Keyboard Shortcuts Reference

| Component | Key | Action |
|-----------|-----|--------|
| Dialog | Escape | Close |
| Menu | Arrow Up/Down | Navigate |
| Menu | Enter/Space | Select |
| Menu | Right Arrow | Open submenu |
| Menu | Left Arrow | Close submenu |
| Tabs | Arrow Left/Right | Switch tab |
| RadioGroup | Arrow Up/Down | Change selection |
| Select | Arrow Up/Down | Navigate options |
| Select | Enter | Select option |
