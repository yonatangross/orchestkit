---
title: Accessibility Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. WCAG Compliance (wcag) — CRITICAL — 3 rules

WCAG 2.2 AA implementation for inclusive, legally compliant web applications.

- `wcag-color-contrast.md` — 4.5:1 text, 3:1 UI components, focus indicators, non-color status
- `wcag-semantic-html.md` — Landmarks, heading hierarchy, ARIA labels/states, form structure
- `wcag-testing.md` — axe-core automated scanning, Playwright a11y tests, screen reader testing

## 2. Focus Management (focus) — HIGH — 3 rules

Keyboard focus management patterns for accessible interactive components.

- `focus-trap.md` — Modal focus trapping, FocusTrap/FocusScope, Escape key handling
- `focus-restoration.md` — Return focus to trigger, focus first error, focus confirmation
- `focus-keyboard-nav.md` — Roving tabindex, skip links, arrow key navigation

## 3. React Aria (aria) — HIGH — 3 rules

Adobe React Aria hooks for building WCAG-compliant interactive UI with React 19.

- `aria-components.md` — useButton, useDialog, useMenu, FocusScope, mergeProps
- `aria-forms.md` — useComboBox, useTextField, useListBox, useSelect
- `aria-overlays.md` — useModalOverlay, useTooltip, usePopover, overlay state management
