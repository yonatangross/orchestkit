# React Aria Component Checklist

Comprehensive checklist for building accessible components with React Aria.

## Pre-Implementation

Before building a new component:

- [ ] Identify the correct ARIA pattern from [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [ ] Determine if a React Aria hook exists for this pattern
- [ ] Install dependencies: `npm install react-aria react-stately`
- [ ] Review existing examples in React Aria documentation

---

## ARIA Roles and Attributes

Ensure proper semantic structure:

- [ ] Component uses appropriate ARIA role (button, dialog, listbox, menu, etc.)
- [ ] All interactive elements have accessible names (`aria-label` or associated `<label>`)
- [ ] Related elements are linked with `aria-labelledby`, `aria-describedby`, `aria-controls`
- [ ] Dynamic content uses `aria-live` regions (polite, assertive, off)
- [ ] Hidden elements use `aria-hidden="true"` (NOT display: none for SR-only content)
- [ ] States are announced: `aria-expanded`, `aria-selected`, `aria-checked`, `aria-pressed`
- [ ] Invalid inputs have `aria-invalid="true"` and `aria-errormessage`

---

## Keyboard Navigation

All interactions must be keyboard accessible:

### Focus Management

- [ ] All interactive elements are focusable (no `tabindex="-1"` on buttons/links)
- [ ] Focus order follows visual order (logical tab sequence)
- [ ] Custom components have appropriate `tabIndex` (0 for focusable, -1 for managed)
- [ ] Focus indicators are visible (use `useFocusRing` for keyboard-only indicators)
- [ ] No keyboard traps (user can always escape with Tab or Escape)

### Modal/Overlay Focus

- [ ] Focus is trapped within modal using `<FocusScope contain>`
- [ ] Focus auto-moves to first focusable element on open (`autoFocus`)
- [ ] Focus restores to trigger element on close (`restoreFocus`)
- [ ] Escape key closes modal/overlay
- [ ] Clicking outside dismisses (if `isDismissable` is true)

### Keyboard Shortcuts

- [ ] **Enter/Space** - Activates buttons and toggles
- [ ] **Arrow keys** - Navigate lists, menus, tabs, radio groups
- [ ] **Home/End** - Jump to first/last item in lists/menus
- [ ] **Escape** - Closes overlays, cancels actions
- [ ] **Tab/Shift+Tab** - Moves focus between interactive elements
- [ ] **Type-ahead** - Single-character search in listboxes/menus (if applicable)

---

## Screen Reader Testing

Test with actual screen readers:

### NVDA (Windows) + Chrome/Firefox

- [ ] Navigate component with Tab/Shift+Tab
- [ ] Verify all elements are announced correctly
- [ ] Test forms mode (Enter on input fields)
- [ ] Verify `aria-live` announcements work

### VoiceOver (macOS) + Safari

- [ ] Navigate with VO+Right Arrow (browse mode)
- [ ] Test form controls with VO+Space
- [ ] Verify rotor navigation (VO+U)
- [ ] Check landmarks and headings structure

### JAWS (Windows) + Chrome/Edge

- [ ] Test virtual cursor navigation
- [ ] Verify forms mode activation
- [ ] Test table navigation (if applicable)

### Mobile Screen Readers

- [ ] TalkBack (Android) - Swipe navigation
- [ ] VoiceOver (iOS) - Swipe navigation
- [ ] Test touch gestures (double-tap to activate)

---

## Common Patterns Checklist

### Button Component

- [ ] Uses `useButton` hook, not div+onClick
- [ ] Supports `onPress` for click/tap/Enter/Space
- [ ] Has `isPressed` state for visual feedback
- [ ] Uses `useFocusRing` for keyboard focus indicator
- [ ] Works with `isDisabled` prop (no pointer events, aria-disabled)

### Dialog/Modal Component

- [ ] Uses `useDialog` + `useModalOverlay` hooks
- [ ] Wrapped in `<FocusScope contain restoreFocus autoFocus>`
- [ ] Has accessible name (`aria-label` or `aria-labelledby`)
- [ ] Escape key closes modal
- [ ] Clicking overlay dismisses (if `isDismissable`)
- [ ] Uses `useOverlayTriggerState` for open/close state

### Combobox/Autocomplete

- [ ] Uses `useComboBox` + `useComboBoxState`
- [ ] Label associated with input
- [ ] Dropdown opens on input focus or button click
- [ ] Arrow keys navigate options
- [ ] Enter selects option
- [ ] Escape closes dropdown
- [ ] Type-ahead filtering works
- [ ] Selected value shown in input
- [ ] `aria-expanded` indicates dropdown state

### Menu Component

- [ ] Uses `useMenu` + `useMenuItem` hooks
- [ ] Trigger button has `aria-haspopup="menu"`
- [ ] Arrow keys navigate items (roving tabindex)
- [ ] Enter/Space activates menu item
- [ ] Escape closes menu
- [ ] Focus returns to trigger button on close
- [ ] Submenus open with Arrow Right, close with Arrow Left

### ListBox Component

- [ ] Uses `useListBox` + `useOption` hooks
- [ ] Supports single/multiple selection modes
- [ ] Arrow keys navigate options
- [ ] Enter/Space toggles selection
- [ ] Home/End jump to first/last item
- [ ] Selected items have `aria-selected="true"`
- [ ] Type-ahead search works

### Form Field Component

- [ ] Uses `useTextField`, `useCheckbox`, `useRadioGroup`, etc.
- [ ] Label visually and programmatically associated
- [ ] Required fields have `aria-required="true"`
- [ ] Error messages linked with `aria-describedby`
- [ ] Invalid inputs have `aria-invalid="true"`
- [ ] Helper text announced to screen readers

---

## Testing Strategy

### Automated Testing

- [ ] Add `jest-axe` tests for automatic WCAG violations
- [ ] Use `@testing-library/react` for interaction testing
- [ ] Test keyboard navigation programmatically
- [ ] Verify ARIA attributes with queries

```tsx
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

test('MyComponent has no accessibility violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Manual Testing

- [ ] Tab through entire component (forward and backward)
- [ ] Test with keyboard only (no mouse)
- [ ] Use screen reader to verify announcements
- [ ] Test with browser zoom at 200%
- [ ] Verify color contrast with devtools
- [ ] Test in high contrast mode (Windows)

---

## Performance Considerations

- [ ] Large lists use virtualization (`@tanstack/react-virtual`)
- [ ] Focus management doesn't cause layout thrashing
- [ ] `mergeProps` used instead of manual object spreading
- [ ] State updates debounced/throttled where appropriate (search inputs)

---

## Documentation

- [ ] Component usage examples in Storybook/docs
- [ ] Keyboard shortcuts documented
- [ ] ARIA attributes explained
- [ ] Common gotchas and troubleshooting

---

## Code Review Checklist

Before merging:

- [ ] No div+onClick buttons (use `useButton` instead)
- [ ] No manual focus management for modals (use `FocusScope`)
- [ ] All interactive elements keyboard accessible
- [ ] Proper ARIA roles and attributes
- [ ] Focus indicators visible
- [ ] Screen reader tested
- [ ] jest-axe tests pass
- [ ] TypeScript types correct (from `react-aria` types)

---

## Resources

- [React Aria Documentation](https://react-spectrum.adobe.com/react-aria/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
