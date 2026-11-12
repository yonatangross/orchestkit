---
title: Concrete pass/fail exit criteria for each POUR principle mapped to WCAG 2.2 criteria
category: wcag
impact: CRITICAL
impactDescription: "Replaces vague 'meets requirements' checks with specific, falsifiable thresholds for each WCAG 2.2 AA criterion"
tags: wcag, pour, exit-criteria, checklist, perceivable, operable, understandable, robust
---

# POUR Exit Criteria (WCAG 2.2 AA)

Pass/fail thresholds for each principle. Every item must pass before marking a feature accessible.

## Perceivable

- [ ] Every `<img>` has `alt`. Decorative images use `alt=""`. Complex images use `aria-describedby` pointing to adjacent descriptive text. (1.1.1, Level A)
- [ ] Normal text contrast >= 4.5:1 against its background. Large text (>= 18pt or >= 14pt bold) contrast >= 3:1. (1.4.3, AA)
- [ ] UI component boundaries (input borders, icon strokes, button outlines) contrast >= 3:1 against adjacent color. (1.4.11, AA)
- [ ] No information is conveyed by color alone — every color-coded element also has an icon, pattern, or visible text label. (1.4.1, A)
- [ ] Page content reflows without horizontal scrolling at 320px viewport width (equivalent to 400% zoom on 1280px display). No fixed-width containers wider than 320px. (1.4.10, AA)
- [ ] Text spacing overrides do not break layout: `line-height: 1.5`, `letter-spacing: 0.12em`, `word-spacing: 0.16em`, `paragraph spacing: 2em` all applied simultaneously produce no clipped or overlapping content. (1.4.12, AA)

## Operable

- [ ] Every interactive element (links, buttons, inputs, custom widgets) is reachable and activatable via keyboard alone. Tab order follows visual reading order (left-to-right, top-to-bottom for LTR). (2.1.1, A)
- [ ] No keyboard trap exists — pressing Escape or a documented key sequence always exits any component that receives focus. (2.1.2, A)
- [ ] A skip link to `<main id="main-content">` is the first focusable element on every page. It becomes visible on focus. (2.4.1, A)
- [ ] All focus indicators: minimum 2px perimeter outline, >= 3:1 contrast between focused and unfocused states. Default browser outlines are acceptable only if they pass the contrast check. (2.4.11, AA — WCAG 2.2)
- [ ] Touch targets are >= 24x24 CSS pixels. No adjacent interactive target falls within a 24px radius of another target's boundary. Primary CTAs should be >= 44x44px. (2.5.8, AA — WCAG 2.2)
- [ ] No content moves, blinks, scrolls, or auto-updates for more than 3 seconds without a mechanism to pause, stop, or hide it. (2.2.2, A)
- [ ] Page titles describe topic or purpose uniquely within the site (e.g., "Login — AppName", not just "Login"). (2.4.2, A)

## Understandable

- [ ] `<html lang="xx">` is set and matches the primary language of the page. Language changes within content use `lang` on the containing element. (3.1.1, A)
- [ ] Every form input has an associated `<label for="id">`, or `aria-label`, or `aria-labelledby`. Placeholder text alone does not count as a label. (3.3.2, A)
- [ ] Error messages: identify the affected field by name, describe the cause of the error, and suggest a specific fix. Errors are announced to assistive technology via `aria-live="polite"` or `role="alert"`. (3.3.1 + 3.3.3, A/AA)
- [ ] No link text is "click here", "read more", "here", "more", or "link" when read out of context. Each link's accessible name uniquely identifies its destination or action. (2.4.4, A)
- [ ] Links that open in a new tab include a visible icon (e.g., external-link icon) with `aria-label` supplement (e.g., `aria-label="Opens in new tab"`). (2.4.4 advisory)
- [ ] Navigation menus appear in the same relative order on every page where they repeat. (3.2.3, AA)
- [ ] Components with the same function have the same accessible name across all pages. (3.2.4, AA)

## Example: Focus Indicator (2.4.11)

**Incorrect:**
```css
/* Removes all focus indicators — keyboard users are blind */
*:focus { outline: none; }
```

**Correct:**
```css
/* 2px outline with sufficient contrast for focus visibility */
*:focus-visible {
  outline: 2px solid var(--focus-ring, #005fcc);
  outline-offset: 2px;
}
```

## Robust

- [ ] No duplicate `id` attributes on interactive elements in the same document. No unclosed or improperly nested landmark elements (`<main>`, `<nav>`, `<header>`, `<footer>`). (4.1.1, A)
- [ ] Custom interactive widgets expose correct ARIA state attributes:
  - Toggle buttons: `aria-pressed="true|false"`
  - Disclosure widgets: `aria-expanded="true|false"`
  - Tabs: `aria-selected="true|false"` on tab elements, `role="tablist"` on container
  - Custom checkboxes: `aria-checked="true|false|mixed"`
  - Comboboxes: `aria-autocomplete`, `aria-activedescendant` (4.1.2, A)
- [ ] Status messages (toasts, loading indicators, success confirmations, live regions) use `role="status"` or `aria-live="polite"`. Urgent alerts use `role="alert"` or `aria-live="assertive"`. (4.1.3, AA)
- [ ] All `aria-*` attributes reference existing IDs. No orphaned `aria-labelledby` or `aria-describedby` values. (4.1.2, A)
