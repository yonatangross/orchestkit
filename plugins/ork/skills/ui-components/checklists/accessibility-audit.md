# Radix Accessibility Audit Checklist

Verify WCAG compliance for Radix-based components.

## Keyboard Navigation

- [ ] All interactive elements reachable via Tab
- [ ] Tab order follows visual layout
- [ ] Focus visible on all interactive elements
- [ ] Escape closes overlays (dialogs, menus, popovers)
- [ ] Enter/Space activates buttons and triggers
- [ ] Arrow keys navigate menus, tabs, radio groups
- [ ] Home/End jump to first/last items in lists

## Focus Management

- [ ] Focus trapped within dialogs when open
- [ ] Focus returns to trigger on close
- [ ] Initial focus on logical element (first input or primary action)
- [ ] No focus loss when elements are removed
- [ ] Focus visible indicator meets 3:1 contrast

## ARIA Attributes (Auto-provided by Radix)

- [ ] `role` appropriate for component type
- [ ] `aria-expanded` on triggers for expandable content
- [ ] `aria-controls` links trigger to content
- [ ] `aria-haspopup` on menu triggers
- [ ] `aria-selected` on selected tabs/items
- [ ] `aria-checked` on checkboxes/radios
- [ ] `aria-disabled` on disabled elements

## Screen Reader Announcements

- [ ] Dialog title announced on open
- [ ] Dialog description announced on open
- [ ] Menu items announced with role
- [ ] State changes announced (expanded/collapsed)
- [ ] Error messages associated with inputs

## Dialogs (Dialog, AlertDialog)

- [ ] Has accessible name via `Dialog.Title`
- [ ] Has description via `Dialog.Description`
- [ ] AlertDialog requires explicit action (no click-outside close)
- [ ] Focus trapped within dialog
- [ ] Escape closes dialog (or prevented with reason)

## Menus (DropdownMenu, ContextMenu)

- [ ] Trigger has `aria-haspopup="menu"`
- [ ] Items navigable via arrow keys
- [ ] Type-ahead focuses matching items
- [ ] Submenus accessible via arrow keys
- [ ] Disabled items skipped in navigation

## Tooltips

- [ ] Wrapped in `Tooltip.Provider` for delay sharing
- [ ] Appears on hover AND focus
- [ ] Dismissible via Escape
- [ ] Does not block interaction with trigger
- [ ] Content is text-only (use Popover for interactive)

## Forms (Select, Checkbox, RadioGroup, Switch)

- [ ] Associated with label
- [ ] Required state indicated
- [ ] Error messages programmatically associated
- [ ] Disabled state communicated
- [ ] Custom controls have appropriate ARIA roles

## Testing Tools

```bash
# Install axe-core for automated testing
npm install -D @axe-core/react

# Or use browser extensions:
# - axe DevTools
# - WAVE
# - Accessibility Insights
```

## Manual Testing

1. **Keyboard-only**: Unplug mouse, navigate entire flow
2. **Screen reader**: Test with VoiceOver (Mac), NVDA (Windows), or Orca (Linux)
3. **Zoom**: Test at 200% and 400% zoom levels
4. **High contrast**: Test with OS high contrast mode
5. **Reduced motion**: Test with `prefers-reduced-motion: reduce`
