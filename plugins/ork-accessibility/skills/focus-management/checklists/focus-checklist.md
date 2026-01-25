# Focus Management Checklist

Comprehensive checklist for implementing and verifying focus management in React applications.

## Implementation Checklist

### Modal/Dialog Focus Trapping

- [ ] Modal contains all focusable elements within a container
- [ ] First focusable element receives focus when modal opens
- [ ] Tab key moves focus forward within the modal
- [ ] Shift+Tab moves focus backward within the modal
- [ ] Focus wraps from last to first element and vice versa
- [ ] Focus cannot escape the modal via Tab/Shift+Tab
- [ ] Escape key closes the modal
- [ ] Focus returns to trigger element when modal closes
- [ ] Modal has `role="dialog"` and `aria-modal="true"`
- [ ] Modal is wrapped with `AnimatePresence` for exit animations

### Roving Tabindex (Toolbars/Menus)

- [ ] Only one item in the group has `tabindex="0"` (the active item)
- [ ] All other items have `tabindex="-1"`
- [ ] Arrow keys move focus between items
- [ ] Arrow key direction matches orientation (horizontal/vertical)
- [ ] Home key focuses the first item
- [ ] End key focuses the last item
- [ ] Tab key moves out of the group
- [ ] Active item updates when focused with mouse
- [ ] Visual focus indicator is visible on active item

### Skip Links

- [ ] Skip link is the first focusable element on the page
- [ ] Skip link is visually hidden by default
- [ ] Skip link becomes visible when focused
- [ ] Skip link text clearly describes the destination ("Skip to main content")
- [ ] Target element has `id` matching skip link `href`
- [ ] Target element has `tabIndex={-1}` for programmatic focus
- [ ] Skip links are styled with sufficient contrast and size
- [ ] Skip links are tested with keyboard navigation

### Form Focus Management

- [ ] First invalid field receives focus after validation
- [ ] Success message receives focus after form submission
- [ ] Error messages are announced to screen readers
- [ ] Multi-step forms maintain focus context between steps
- [ ] Autofocus is used sparingly and intentionally
- [ ] Focus is not lost when dynamically adding/removing fields

### Focus Indicators

- [ ] All interactive elements have a visible focus indicator
- [ ] Focus indicator has sufficient contrast (3:1 minimum)
- [ ] Focus indicator is not removed globally with CSS
- [ ] Use `:focus-visible` to show indicator only for keyboard users
- [ ] Focus indicator is animated smoothly (optional)
- [ ] Custom focus styles match the design system

## Testing Checklist

### Manual Keyboard Testing

- [ ] Navigate entire UI using only keyboard (no mouse)
- [ ] Verify all interactive elements are reachable
- [ ] Check that focus order follows visual/logical order
- [ ] Test Tab, Shift+Tab, Arrow keys, Enter, Escape, Space
- [ ] Verify focus doesn't get stuck in any component
- [ ] Check that focus wraps correctly in modal/roving tabindex
- [ ] Verify focus returns to trigger after closing modal/menu
- [ ] Test with screen reader (NVDA, JAWS, VoiceOver)

### Automated Testing (Playwright/Vitest)

- [ ] Test focus trap in modal (`toBeFocused()`)
- [ ] Test roving tabindex with arrow keys
- [ ] Test skip link navigation
- [ ] Test focus restoration after modal close
- [ ] Test Escape key closes modal and restores focus
- [ ] Test focus moves to first error after form validation
- [ ] Test focus moves to confirmation message after success
- [ ] Test focus order matches DOM order

### Screen Reader Testing

#### NVDA (Windows)

- [ ] Focus announces element role and label
- [ ] Modal announces "dialog" role and title
- [ ] Error messages are announced immediately
- [ ] Form fields announce label, role, and validation state
- [ ] Skip links are announced and functional

#### VoiceOver (macOS)

- [ ] Focus announces element role and label
- [ ] Modal announces "dialog" role and title
- [ ] Error messages are announced immediately
- [ ] Form fields announce label, role, and validation state
- [ ] Skip links are announced and functional

#### JAWS (Windows)

- [ ] Focus announces element role and label
- [ ] Modal announces "dialog" role and title
- [ ] Error messages are announced immediately
- [ ] Form fields announce label, role, and validation state
- [ ] Skip links are announced and functional

### Visual Focus Indicator Testing

- [ ] Focus indicator is visible on all interactive elements
- [ ] Focus indicator has sufficient contrast (3:1 minimum)
- [ ] Focus indicator is not hidden by other elements
- [ ] Focus indicator respects color scheme (light/dark mode)
- [ ] Focus indicator works with design system tokens

### Cross-Browser Testing

- [ ] Chrome: Focus indicator visible, keyboard navigation works
- [ ] Firefox: Focus indicator visible, keyboard navigation works
- [ ] Safari: Focus indicator visible, keyboard navigation works
- [ ] Edge: Focus indicator visible, keyboard navigation works

## Debugging Checklist

### Focus Lost or Not Visible

- [ ] Check if element has `tabindex="-1"` (not keyboard focusable)
- [ ] Check if element is hidden (`display: none`, `visibility: hidden`)
- [ ] Check if element is outside viewport
- [ ] Check if CSS removes outline/focus indicator
- [ ] Use browser DevTools to track `document.activeElement`

### Focus Trap Not Working

- [ ] Verify focusable selector includes all interactive elements
- [ ] Check if event listener is attached to correct container
- [ ] Verify `event.preventDefault()` is called on Tab key
- [ ] Check if first/last element references are correct
- [ ] Use `console.log` to debug focus trap logic

### Roving Tabindex Not Working

- [ ] Verify only one item has `tabindex="0"` at a time
- [ ] Check if arrow key event listener is attached
- [ ] Verify `setActiveIndex` updates correctly
- [ ] Check if orientation matches key bindings
- [ ] Use React DevTools to inspect state updates

### Focus Restoration Not Working

- [ ] Verify trigger element is stored in ref
- [ ] Check if ref is cleared after modal closes
- [ ] Verify element still exists in DOM when refocused
- [ ] Check if element is focusable (not disabled/hidden)
- [ ] Use `console.log` to track trigger ref lifecycle

## Code Review Checklist

- [ ] All modals/dialogs implement focus trap
- [ ] Toolbars/menus use roving tabindex pattern
- [ ] Skip links are present on all pages
- [ ] Form validation focuses first error
- [ ] Success/error messages receive focus
- [ ] No global `outline: none` in CSS
- [ ] `:focus-visible` is used instead of `:focus` where appropriate
- [ ] Focus management hooks are reusable and tested
- [ ] ARIA attributes are correct (`role`, `aria-modal`, `aria-label`)
- [ ] Focus restoration is implemented for all dismissible UI

## Accessibility Compliance

- [ ] WCAG 2.1 Level AA: Focus Visible (2.4.7)
- [ ] WCAG 2.1 Level AA: Focus Order (2.4.3)
- [ ] WCAG 2.1 Level AA: Keyboard (2.1.1)
- [ ] WCAG 2.1 Level AA: No Keyboard Trap (2.1.2)
- [ ] WCAG 2.1 Level AAA: Focus Appearance (2.4.13) (optional)

---

**Last Updated:** 2026-01-16
