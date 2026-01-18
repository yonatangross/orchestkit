# WCAG 2.2 AA Compliance Checklist

Use this checklist to audit components and pages for accessibility compliance.

---

## Quick Pre-Flight Checklist

Before submitting any component for review:

- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible (3px solid outline)
- [ ] Color contrast meets 4.5:1 for text, 3:1 for UI components
- [ ] All images have alt text (or alt="" if decorative)
- [ ] Form inputs have associated labels
- [ ] Error messages use `role="alert"` and `aria-describedby`
- [ ] Interactive elements are at least 24x24px
- [ ] No positive `tabIndex` values (e.g., tabIndex={5})
- [ ] Semantic HTML used (button, nav, main, article)
- [ ] Tested with keyboard navigation (Tab, Enter, Esc)

---

## Detailed Audit Checklist

### Perceivable (Can users perceive the content?)

#### 1.1 Text Alternatives

- [ ] All `<img>` elements have `alt` attribute
- [ ] Decorative images use `alt=""` or `role="presentation"`
- [ ] Icon buttons have `aria-label`
- [ ] Complex images (charts, diagrams) have detailed descriptions
- [ ] SVG icons inside buttons have `aria-hidden="true"`

#### 1.3 Adaptable

- [ ] Semantic HTML used (`<header>`, `<nav>`, `<main>`, `<article>`, `<footer>`)
- [ ] Heading hierarchy is correct (h1 → h2 → h3, no skipping levels)
- [ ] Form fields use `<label>` elements with `htmlFor` attribute
- [ ] Related form fields grouped with `<fieldset>` and `<legend>`
- [ ] Lists use `<ul>`, `<ol>`, or `<dl>` (not div + CSS)
- [ ] Tables use `<th>` with `scope` attribute
- [ ] Form inputs have `autoComplete` attributes

#### 1.4 Distinguishable

- [ ] Text contrast ratio ≥ 4.5:1 (normal text) or ≥ 3:1 (large text)
- [ ] UI component contrast ≥ 3:1 (borders, icons, focus indicators)
- [ ] Information not conveyed by color alone (use icons + text)
- [ ] Focus indicators have ≥ 3:1 contrast against background
- [ ] No horizontal scrolling at 400% zoom (320px width)
- [ ] Content reflows at 320px width without loss of information
- [ ] No loss of content when text spacing increased (line-height: 1.5)

**Tools:**
- WebAIM Contrast Checker: [https://webaim.org/resources/contrastchecker/](https://webaim.org/resources/contrastchecker/)
- Chrome DevTools: Inspect > Color picker > Contrast ratio

---

### Operable (Can users operate the interface?)

#### 2.1 Keyboard Accessible

- [ ] All interactive elements reachable via keyboard
- [ ] All actions available via keyboard (no mouse-only interactions)
- [ ] No keyboard traps (can exit all components with Esc or Tab)
- [ ] Keyboard shortcuts require modifier key (Ctrl/Cmd/Alt)
- [ ] Custom widgets handle Enter and Space keys

**Test:** Tab through entire page, press Enter/Space on all interactive elements

#### 2.4 Navigable

- [ ] Skip link provided to bypass repeated navigation
- [ ] Page has unique `<title>` element
- [ ] Link text is descriptive (not "click here")
- [ ] Focus order follows visual reading order (left-to-right, top-to-bottom)
- [ ] Focus visible on all interactive elements
- [ ] Headings describe topic or purpose
- [ ] Multiple ways to find pages (menu, search, sitemap)
- [ ] Current page indicated in navigation
- [ ] Focus not obscured by sticky headers/footers (use `scroll-margin-top`)

**Test:** Tab through page, verify logical sequence

#### 2.5 Input Modalities

- [ ] All multipoint gestures have single-pointer alternatives (buttons)
- [ ] All dragging functionality has keyboard alternative
- [ ] Interactive elements ≥ 24x24px (or 44x44px for touch devices)
- [ ] Adequate spacing between interactive elements (8px minimum)
- [ ] Click actions complete on mouse up (not mouse down)
- [ ] Accessible name includes visible label text

**Test:** Resize browser to 320px, verify tap target sizes

---

### Understandable (Can users understand the content and interface?)

#### 3.1 Readable

- [ ] Page language specified (`<html lang="en">`)
- [ ] Language changes marked with `lang` attribute

#### 3.2 Predictable

- [ ] Focus does not trigger automatic navigation or form submission
- [ ] Input does not cause unexpected context changes
- [ ] Navigation consistent across pages
- [ ] Repeated components identified consistently

#### 3.3 Input Assistance

- [ ] Form fields have visible labels
- [ ] Required fields indicated (with `aria-required="true"`)
- [ ] Error messages clearly identify which field has error
- [ ] Error messages provide correction suggestions
- [ ] Errors use `role="alert"` for screen reader announcement
- [ ] Form fields use `aria-invalid="true"` when errors present
- [ ] Form fields use `aria-describedby` to link to error messages
- [ ] Critical actions require confirmation (delete, purchase, submit)

**Test:** Submit form with errors, verify error messages are announced

---

### Robust (Can assistive technologies interpret the content?)

#### 4.1 Compatible

- [ ] HTML validates (no duplicate IDs, proper nesting)
- [ ] ARIA roles used correctly (match semantic HTML when possible)
- [ ] All custom widgets have proper `role` attribute
- [ ] All interactive elements have accessible names
- [ ] State changes programmatically determinable (`aria-expanded`, `aria-checked`)
- [ ] Status messages use `role="status"` or `role="alert"`
- [ ] Live regions used for dynamic content updates

**Test:** Run axe DevTools, validate with W3C validator

---

## Screen Reader Testing Checklist

Test with at least one screen reader:

### Windows
- [ ] NVDA (free) - [nvaccess.org](https://www.nvaccess.org/)
- [ ] JAWS (commercial) - [freedomscientific.com](https://www.freedomscientific.com/)

### macOS/iOS
- [ ] VoiceOver (built-in) - Cmd+F5 to enable

### Android
- [ ] TalkBack (built-in)

### Verification Steps

- [ ] Navigate with Tab key, verify focus indicators
- [ ] Navigate with arrow keys (for custom widgets)
- [ ] Verify all images/icons are announced correctly
- [ ] Verify form labels are announced
- [ ] Verify error messages are announced
- [ ] Verify dynamic content updates are announced
- [ ] Verify headings provide proper page structure
- [ ] Verify links are descriptive when read out of context
- [ ] Verify button purposes are clear

---

## Automated Testing Checklist

Run these tools before manual testing:

- [ ] **axe DevTools** browser extension - catches 30-50% of issues
- [ ] **Lighthouse** accessibility audit - built into Chrome DevTools
- [ ] **WAVE** browser extension - visual feedback on accessibility issues
- [ ] **ESLint jsx-a11y plugin** - catches issues during development
- [ ] **Playwright accessibility tests** - automated regression tests

**Example Playwright test:**

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('should not have any automatically detectable accessibility issues', async ({ page }) => {
  await page.goto('/');
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});
```

---

## Common Issues and Fixes

| Issue | Fix |
|-------|-----|
| Missing alt text | Add `alt` attribute to all images |
| Low contrast | Darken text or lighten background to meet 4.5:1 ratio |
| Missing label | Add `<label>` with `htmlFor` or `aria-label` |
| Keyboard trap | Add `onKeyDown` handler to detect Esc key |
| No focus indicator | Add `:focus-visible { outline: 3px solid #0052cc; }` |
| Div button | Replace with `<button>` or add `role="button"` + keyboard handler |
| Empty link | Add descriptive text or `aria-label` |
| Small touch target | Increase `min-width` and `min-height` to 24px (44px for touch) |
| Non-semantic HTML | Replace divs with `<nav>`, `<main>`, `<article>`, `<button>`, etc. |
| Color-only status | Add icon or text label alongside color |

---

## Component-Specific Checklists

### Button Component

- [ ] Uses `<button>` element (not div with onClick)
- [ ] Has accessible name (visible text or aria-label)
- [ ] Disabled state uses `disabled` attribute (not just CSS)
- [ ] Icon-only buttons have `aria-label`
- [ ] Minimum 24x24px size
- [ ] Focus indicator visible

### Form Component

- [ ] All inputs have associated labels
- [ ] Required fields marked with `aria-required="true"`
- [ ] Error messages use `role="alert"`
- [ ] Error messages linked with `aria-describedby`
- [ ] Invalid fields marked with `aria-invalid="true"`
- [ ] Submit button clearly labeled
- [ ] Fieldsets group related inputs

### Modal/Dialog Component

- [ ] Uses `<dialog>` element or proper ARIA roles
- [ ] Focus trapped within modal when open
- [ ] Focus returns to trigger element when closed
- [ ] Closes on Esc key
- [ ] Backdrop closes modal on click
- [ ] First focusable element receives focus on open
- [ ] Title uses `<h2>` or `aria-labelledby`

### Navigation Component

- [ ] Uses `<nav>` landmark
- [ ] Skip link provided
- [ ] Current page indicated with `aria-current="page"`
- [ ] Keyboard accessible
- [ ] Links descriptive
- [ ] Dropdown menus keyboard accessible (arrow keys)

### Data Table Component

- [ ] Uses `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>` elements
- [ ] Header cells use `<th>` with `scope` attribute
- [ ] Complex tables have `<caption>` or `aria-label`
- [ ] Sortable columns indicate sort direction with `aria-sort`
- [ ] Expandable rows use `aria-expanded`

---

## Compliance Sign-Off

Component/Page: ____________________

- [ ] Automated tests passed (axe, Lighthouse, WAVE)
- [ ] Manual keyboard testing completed
- [ ] Screen reader testing completed
- [ ] Color contrast verified
- [ ] Semantic HTML used throughout
- [ ] All checklist items above verified

Reviewed by: ____________________
Date: ____________________

---

**Version**: 1.0.0
**Last Updated**: 2026-01-16
**Based on**: WCAG 2.2 Level AA
