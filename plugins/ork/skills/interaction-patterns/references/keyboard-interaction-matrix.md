---
title: "Keyboard Interaction Matrix"
version: 1.0.0
---

# Keyboard Interaction Matrix

Keyboard shortcuts and interaction patterns for all interactive components, aligned with WAI-ARIA Authoring Practices Guide (APG).

## Tab & Focus Management

| Component | Tab | Shift+Tab |
|-----------|-----|-----------|
| Dialog (modal) | Cycles within dialog (focus trap) | Reverse cycle within dialog |
| Drawer (non-modal) | Can leave drawer to page | Can return to drawer |
| Tabs | Moves focus to tab panel | Returns to active tab |
| Menu | Enters menu from trigger | Returns to trigger |
| Toast | Skipped unless focusable action present | Skipped |

## Tabs (`role="tablist"`)

| Key | Action |
|-----|--------|
| Arrow Right | Move to next tab |
| Arrow Left | Move to previous tab |
| Home | Move to first tab |
| End | Move to last tab |
| Tab | Move focus into tab panel |
| Enter / Space | Activate focused tab (manual activation mode) |

## Dialog (`<dialog>`)

| Key | Action |
|-----|--------|
| Escape | Close dialog |
| Tab | Cycle focus within dialog (trapped) |
| Enter | Activate focused button |
| Shift+Tab | Reverse cycle within dialog |

## Accordion (`<details>`)

| Key | Action |
|-----|--------|
| Enter / Space | Toggle open/close |
| Tab | Move to next focusable element |
| Arrow Down | Next accordion header (if grouped) |
| Arrow Up | Previous accordion header (if grouped) |

## Drag & Drop (`@dnd-kit`)

| Key | Action |
|-----|--------|
| Tab | Focus drag handle |
| Enter / Space | Pick up / drop item |
| Arrow Up | Move item up one position |
| Arrow Down | Move item down one position |
| Arrow Left | Move item left (grid layout) |
| Arrow Right | Move item right (grid layout) |
| Escape | Cancel drag, return to original position |

## Menu / Dropdown

| Key | Action |
|-----|--------|
| Enter / Space | Open menu from trigger |
| Arrow Down | Next menu item / open menu |
| Arrow Up | Previous menu item |
| Home | First menu item |
| End | Last menu item |
| Escape | Close menu, return focus to trigger |
| Character key | Jump to item starting with character |

## Toast Notifications

| Key | Action |
|-----|--------|
| Tab (if action present) | Focus toast action button |
| Escape | Dismiss focused toast |
| Enter | Activate toast action (e.g., Undo) |

## Infinite Scroll (`role="feed"`)

| Key | Action |
|-----|--------|
| Page Down | Next article in feed |
| Page Up | Previous article in feed |
| Tab | Move through focusable items within article |
| End | (Optionally) trigger load more |

## Command Palette

| Key | Action |
|-----|--------|
| Cmd/Ctrl + K | Open palette |
| Arrow Down | Next item |
| Arrow Up | Previous item |
| Enter | Execute selected command |
| Escape | Close palette |
| Backspace (empty) | Go back to parent scope |

## General Principles

1. **Roving tabindex** — In composite widgets (tabs, menus), only one item has `tabIndex={0}`. Arrow keys move focus. Tab leaves the widget.
2. **Focus visible** — All focusable elements must have a visible focus indicator (`:focus-visible` outline).
3. **Focus restoration** — When closing overlays, return focus to the element that triggered the overlay.
4. **No keyboard traps** — Users must always be able to navigate away from any component using Tab or Escape.
5. **Skip links** — Provide "Skip to main content" links for keyboard users navigating past repeated headers/nav.

## Testing Checklist

- [ ] All interactive elements reachable via Tab key
- [ ] Arrow keys work within composite widgets (tabs, menus, drag handles)
- [ ] Escape closes overlays and cancels drag operations
- [ ] Focus returns to trigger element after overlay closes
- [ ] No keyboard traps — Tab always moves focus forward
- [ ] Focus indicator visible on all focused elements
- [ ] Screen reader announces state changes via `aria-live`

Reference: https://www.w3.org/WAI/ARIA/apg/
