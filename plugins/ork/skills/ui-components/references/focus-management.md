# Focus Management

Keyboard navigation and focus handling with Radix.

## Built-in Focus Features

All Radix primitives include:

| Feature | Description |
|---------|-------------|
| **Focus trap** | Focus stays within component |
| **Focus return** | Focus returns to trigger on close |
| **Visible focus** | Clear focus indicators |
| **Roving tabindex** | Arrow key navigation in groups |

## Dialog Focus Trap

Focus is automatically trapped within dialogs:

```tsx
<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Content>
      {/* Focus trapped here */}
      <input autoFocus />  {/* Receives initial focus */}
      <button>Action 1</button>
      <button>Action 2</button>
      <Dialog.Close>Close</Dialog.Close>
      {/* Tab cycles through these elements */}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

## Custom Initial Focus

```tsx
<Dialog.Content
  onOpenAutoFocus={(event) => {
    event.preventDefault()
    // Focus specific element
    document.getElementById('email-input')?.focus()
  }}
>
  <input id="name-input" />
  <input id="email-input" />  {/* Gets focus */}
</Dialog.Content>
```

## Preventing Focus Return

```tsx
<Dialog.Content
  onCloseAutoFocus={(event) => {
    event.preventDefault()
    // Focus something else instead of trigger
    document.getElementById('other-element')?.focus()
  }}
>
  {/* Content */}
</Dialog.Content>
```

## Roving Tabindex (Menu Navigation)

Arrow keys navigate within menus:

```tsx
<DropdownMenu.Content>
  {/* Tab: exits menu */}
  {/* Arrow Up/Down: navigates items */}
  <DropdownMenu.Item>Profile</DropdownMenu.Item>
  <DropdownMenu.Item>Settings</DropdownMenu.Item>
  <DropdownMenu.Item>Sign out</DropdownMenu.Item>
</DropdownMenu.Content>
```

## RadioGroup Focus

```tsx
<RadioGroup.Root>
  {/* Tab: enters group at selected item */}
  {/* Arrow keys: move between items */}
  <RadioGroup.Item value="a">Option A</RadioGroup.Item>
  <RadioGroup.Item value="b">Option B</RadioGroup.Item>
  <RadioGroup.Item value="c">Option C</RadioGroup.Item>
</RadioGroup.Root>
```

## Tabs Focus

```tsx
<Tabs.Root>
  <Tabs.List>
    {/* Arrow keys navigate tabs */}
    <Tabs.Trigger value="account">Account</Tabs.Trigger>
    <Tabs.Trigger value="password">Password</Tabs.Trigger>
  </Tabs.List>
  {/* Tab moves to content */}
  <Tabs.Content value="account">...</Tabs.Content>
  <Tabs.Content value="password">...</Tabs.Content>
</Tabs.Root>
```

## Focus Visible Styling

Style focus indicators for keyboard users:

```css
/* Only show focus ring for keyboard navigation */
[data-focus-visible] {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* Hide for mouse users */
:focus:not([data-focus-visible]) {
  outline: none;
}
```

```tsx
// Tailwind
<Button className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
```

## Escape Key Handling

All overlays close on Escape:

```tsx
<Dialog.Content
  onEscapeKeyDown={(event) => {
    // Prevent close if form has changes
    if (hasUnsavedChanges) {
      event.preventDefault()
      showConfirmDialog()
    }
  }}
>
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

## Focus Scope (Advanced)

For custom focus trapping:

```tsx
import { FocusScope } from '@radix-ui/react-focus-scope'

<FocusScope
  trapped={true}
  onMountAutoFocus={(event) => {
    event.preventDefault()
    firstInput.current?.focus()
  }}
  onUnmountAutoFocus={(event) => {
    event.preventDefault()
    triggerRef.current?.focus()
  }}
>
  {/* Focusable content */}
</FocusScope>
```
