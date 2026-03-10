---
name: accessibility
license: MIT
compatibility: "Claude Code 2.1.72+."
description: Accessibility patterns for WCAG 2.2 compliance, keyboard focus management, React Aria component patterns, cognitive inclusion, native HTML-first philosophy, and user preference honoring. Use when implementing screen reader support, keyboard navigation, ARIA patterns, focus traps, accessible component libraries, reduced motion, or cognitive accessibility.
tags: [accessibility, a11y, wcag, focus-management, react-aria, keyboard-navigation, screen-reader, aria]
context: fork
agent: accessibility-specialist
version: 2.1.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Accessibility

Comprehensive patterns for building accessible web applications: WCAG 2.2 AA compliance, keyboard focus management, React Aria component patterns, native HTML-first philosophy, cognitive inclusion, and user preference honoring. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [WCAG Compliance](#wcag-compliance) | 3 | CRITICAL | Color contrast, semantic HTML, automated testing |
| [POUR Exit Criteria](#pour-exit-criteria) | 1 | CRITICAL | Falsifiable pass/fail thresholds for each WCAG 2.2 AA criterion |
| [Static Anti-Patterns](#static-anti-patterns) | 1 | HIGH | Grep-able patterns detectable without a browser |
| [Focus Management](#focus-management) | 3 | HIGH | Focus traps, focus restoration, keyboard navigation |
| [React Aria](#react-aria) | 3 | HIGH | Accessible components, form hooks, overlay patterns |
| [Modern Web Accessibility](#modern-web-accessibility) | 3 | CRITICAL/HIGH | Native HTML first, cognitive inclusion, user preferences |

**Total: 14 rules across 6 categories**

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
| Color Contrast | `${CLAUDE_SKILL_DIR}/rules/wcag-color-contrast.md` | 4.5:1 text, 3:1 UI components, focus indicators |
| Semantic HTML | `${CLAUDE_SKILL_DIR}/rules/wcag-semantic-html.md` | Landmarks, headings, ARIA labels, form structure |
| Testing | `${CLAUDE_SKILL_DIR}/rules/wcag-testing.md` | axe-core, Playwright a11y, screen reader testing |

## POUR Exit Criteria

Concrete pass/fail thresholds for each WCAG 2.2 AA criterion — replaces vague "meets requirements" checks.

| Rule | File | Key Pattern |
|------|------|-------------|
| POUR Exit Criteria | `${CLAUDE_SKILL_DIR}/rules/pour-exit-criteria.md` | Falsifiable checklist: image alt, contrast ratios, focus indicators, touch targets, ARIA states |

## Static Anti-Patterns

Grep-able anti-patterns detectable via static analysis or code review — no browser needed.

| Rule | File | Key Pattern |
|------|------|-------------|
| A11y Anti-Patterns (Static) | `${CLAUDE_SKILL_DIR}/rules/a11y-antipatterns-static.md` | Focus removal, missing labels, autoplay, icon-only buttons, div-click handlers |

## Focus Management

Keyboard focus management patterns for accessible interactive widgets.

| Rule | File | Key Pattern |
|------|------|-------------|
| Focus Trap | `${CLAUDE_SKILL_DIR}/rules/focus-trap.md` | Modal focus trapping, FocusScope, Escape key |
| Focus Restoration | `${CLAUDE_SKILL_DIR}/rules/focus-restoration.md` | Return focus to trigger, focus first error |
| Keyboard Navigation | `${CLAUDE_SKILL_DIR}/rules/focus-keyboard-nav.md` | Roving tabindex, skip links, arrow keys |

## React Aria

Adobe React Aria hooks for building WCAG-compliant interactive UI.

| Rule | File | Key Pattern |
|------|------|-------------|
| Components | `${CLAUDE_SKILL_DIR}/rules/aria-components.md` | useButton, useDialog, useMenu, FocusScope |
| Forms | `${CLAUDE_SKILL_DIR}/rules/aria-forms.md` | useComboBox, useTextField, useListBox |
| Overlays | `${CLAUDE_SKILL_DIR}/rules/aria-overlays.md` | useModalOverlay, useTooltip, usePopover |

## Modern Web Accessibility

2026 best practices: native HTML first, cognitive inclusion, and honoring user preferences.

| Rule | File | Key Pattern |
|------|------|-------------|
| Native HTML First | `${CLAUDE_SKILL_DIR}/rules/wcag-native-html-first.md` | `<dialog>`, `<details>`, native over custom ARIA |
| Cognitive Inclusion | `${CLAUDE_SKILL_DIR}/rules/wcag-cognitive-inclusion.md` | ADHD/autism/dyslexia support, chunked content, notification management |
| User Preferences | `${CLAUDE_SKILL_DIR}/rules/wcag-user-preferences.md` | prefers-reduced-motion, forced-colors, prefers-contrast, zoom |

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
| `${CLAUDE_SKILL_DIR}/scripts/` | Templates: accessible form, focus trap, React Aria components |
| `${CLAUDE_SKILL_DIR}/checklists/` | WCAG audit, focus management, React Aria component checklists |
| `${CLAUDE_SKILL_DIR}/references/` | WCAG criteria reference, focus patterns, React Aria hooks API |
| `${CLAUDE_SKILL_DIR}/references/ux-thresholds-quick.md` | UI/UX thresholds quick reference: contrast, touch targets, cognitive load, typography, forms |
| `${CLAUDE_SKILL_DIR}/examples/` | Complete accessible component examples |

## Related Skills

- `ork:testing-e2e` - E2E testing patterns including accessibility testing
- `design-system-starter` - Accessible component library patterns
- `ork:i18n-date-patterns` - RTL layout and locale-aware formatting
- `motion-animation-patterns` - Reduced motion and animation accessibility
