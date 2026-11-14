---
title: Accessibility Rule Categories
version: 2.1.0
---

# Rule Categories

## 1. WCAG Compliance (wcag, CRITICAL, 3 rules)

WCAG 2.2 AA implementation for inclusive, legally compliant web applications.

- `wcag-color-contrast.md`: 4.5:1 text, 3:1 UI components, focus indicators, non-color status
- `wcag-semantic-html.md`: Landmarks, heading hierarchy, ARIA labels/states, form structure
- `wcag-testing.md`: axe-core automated scanning, Playwright a11y tests, screen reader testing

## 2. POUR Exit Criteria (wcag, CRITICAL, 1 rule)

Falsifiable pass/fail thresholds for each WCAG 2.2 AA criterion.

- `pour-exit-criteria.md`: Concrete exit criteria per POUR principle mapped to WCAG 2.2

## 3. Static Anti-Patterns (wcag, HIGH, 1 rule)

Grep-able anti-patterns detectable via static analysis, no browser needed.

- `a11y-antipatterns-static.md`: Focus removal, missing labels, autoplay, icon-only buttons, div-click handlers

## 4. Focus Management (focus, HIGH, 1 rule)

Keyboard focus management patterns for accessible interactive components.

- `focus-keyboard-nav.md`: Roving tabindex, skip links, arrow key navigation

Focus trap and restoration mechanics were thinned 2026-07-31: use React Aria
FocusScope (upstream), or `../scripts/focus-trap-template.tsx` when React Aria
is unavailable. House rules: `../references/ork-delta.md`.

## 5. React Aria (aria, HIGH, 2 rules)

Adobe React Aria hooks for building WCAG-compliant interactive UI with React 19.

- `aria-components.md`: useButton, useDialog, useMenu, FocusScope, mergeProps
- `aria-forms.md`: useComboBox, useTextField, useListBox, useSelect

Overlay hook APIs (useModalOverlay, useTooltip, usePopover) are documented
upstream at react-spectrum.adobe.com/react-aria/; the house overlay recipe is
in `../references/ork-delta.md`.

## 6. Modern Web Accessibility (modern-web, CRITICAL/HIGH, 2 rules)

2026 best practices for native HTML and user preference honoring.

- `wcag-native-html-first.md`: Prefer `<dialog>`, `<details>`, `<select>` over custom ARIA widgets
- `wcag-user-preferences.md`: prefers-reduced-motion, forced-colors, prefers-contrast, zoom support

Cognitive inclusion guidance lives upstream (W3C COGA, w3.org/TR/coga-usable/);
the house cognitive-load ceilings are in `../references/ork-delta.md`.
