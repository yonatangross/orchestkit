---
name: accessibility
license: MIT
compatibility: "Claude Code 2.1.34+."
description: Accessibility patterns for WCAG 2.2 compliance, keyboard focus management, and React Aria component patterns. Use when implementing screen reader support, keyboard navigation, ARIA patterns, focus traps, or accessible component libraries.
tags: [accessibility, a11y, wcag, focus-management, react-aria, keyboard-navigation, screen-reader, aria]
context: fork
agent: accessibility-specialist
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: medium
metadata:
  category: document-asset-creation
---

# Accessibility

Comprehensive patterns for building accessible web applications: WCAG 2.2 AA compliance, keyboard focus management, and React Aria component patterns. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [WCAG Compliance](#wcag-compliance) | 3 | CRITICAL | Color contrast, semantic HTML, automated testing |
| [Focus Management](#focus-management) | 3 | HIGH | Focus traps, focus restoration, keyboard navigation |
| [React Aria](#react-aria) | 3 | HIGH | Accessible components, form hooks, overlay patterns |

**Total: 9 rules across 3 categories**

## Quick Start

```tsx
// Semantic HTML with ARIA
<main>
  <article>
    <header><h1>Page Title</h1></header>
    <section aria-labelledby="features-heading">
      <h2 id="features-heading">Features</h2>
    </section>
  </article>
</main>
```

```tsx
// Focus trap with React Aria
import { FocusScope } from 'react-aria';

<FocusScope contain restoreFocus autoFocus>
  <div role="dialog" aria-modal="true">
    {children}
  </div>
</FocusScope>
```

## WCAG Compliance

WCAG 2.2 AA implementation for inclusive, legally compliant web applications.

| Rule | File | Key Pattern |
|------|------|-------------|
| Color Contrast | `rules/wcag-color-contrast.md` | 4.5:1 text, 3:1 UI components, focus indicators |
| Semantic HTML | `rules/wcag-semantic-html.md` | Landmarks, headings, ARIA labels, form structure |
| Testing | `rules/wcag-testing.md` | axe-core, Playwright a11y, screen reader testing |

## Focus Management

Keyboard focus management patterns for accessible interactive widgets.

| Rule | File | Key Pattern |
|------|------|-------------|
| Focus Trap | `rules/focus-trap.md` | Modal focus trapping, FocusScope, Escape key |
| Focus Restoration | `rules/focus-restoration.md` | Return focus to trigger, focus first error |
| Keyboard Navigation | `rules/focus-keyboard-nav.md` | Roving tabindex, skip links, arrow keys |

## React Aria

Adobe React Aria hooks for building WCAG-compliant interactive UI.

| Rule | File | Key Pattern |
|------|------|-------------|
| Components | `rules/aria-components.md` | useButton, useDialog, useMenu, FocusScope |
| Forms | `rules/aria-forms.md` | useComboBox, useTextField, useListBox |
| Overlays | `rules/aria-overlays.md` | useModalOverlay, useTooltip, usePopover |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Conformance level | WCAG 2.2 AA (legal standard: ADA, Section 508) |
| Contrast ratio | 4.5:1 normal text, 3:1 large text and UI components |
| Target size | 24px min (WCAG 2.5.8), 44px for touch |
| Focus indicator | 3px solid outline, 3:1 contrast |
| Component library | React Aria hooks for control, react-aria-components for speed |
| State management | react-stately hooks (designed for a11y) |
| Focus management | FocusScope for modals, roving tabindex for widgets |
| Testing | jest-axe (unit) + Playwright axe-core (E2E) |

## Anti-Patterns (FORBIDDEN)

- **Div soup**: Using `<div>` instead of semantic elements (`<nav>`, `<main>`, `<article>`)
- **Color-only information**: Status indicated only by color without icon/text
- **Missing labels**: Form inputs without associated `<label>` or `aria-label`
- **Keyboard traps**: Focus that cannot escape without Escape key
- **Removing focus outline**: `outline: none` without replacement indicator
- **Positive tabindex**: Using `tabindex > 0` (disrupts natural order)
- **Div with onClick**: Using `<div onClick>` instead of `<button>` or `useButton`
- **Manual focus in modals**: Using `useEffect` + `ref.focus()` instead of `FocusScope`
- **Auto-playing media**: Audio/video that plays without user action
- **ARIA overuse**: Using ARIA when semantic HTML suffices

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [scripts/](scripts/) | Templates: accessible form, focus trap, React Aria components |
| [checklists/](checklists/) | WCAG audit, focus management, React Aria component checklists |
| [references/](references/) | WCAG criteria reference, focus patterns, React Aria hooks API |
| [examples/](examples/) | Complete accessible component examples |

## Related Skills

- `testing-patterns` - Comprehensive testing patterns including accessibility testing
- `design-system-starter` - Accessible component library patterns
- `i18n-date-patterns` - RTL layout and locale-aware formatting
- `motion-animation-patterns` - Reduced motion and animation accessibility
