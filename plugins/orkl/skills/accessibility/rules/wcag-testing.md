---
title: "WCAG: Accessibility Testing"
category: wcag
impact: CRITICAL
impactDescription: "Ensures accessibility compliance through automated testing with axe-core and manual screen reader verification"
tags: wcag, testing, axe-core, screen-reader, automation
---

# Accessibility Testing

## Automated Testing with axe-core

### Component-Level (jest-axe)

```tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('form has no accessibility violations', async () => {
  const { container } = render(<AccessibleForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Page-Level (Playwright + axe-core)

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('should not have any automatically detectable accessibility issues', async ({ page }) => {
  await page.goto('/');
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});
```

### ESLint Plugin

```bash
npm install --save-dev eslint-plugin-jsx-a11y
```

Catches issues during development: missing alt text, missing labels, invalid ARIA attributes.

## Screen Reader Testing

Test with at least one screen reader:

| Platform | Screen Reader | How to Enable |
|----------|--------------|---------------|
| Windows | NVDA (free) | [nvaccess.org](https://www.nvaccess.org/) |
| Windows | JAWS | [freedomscientific.com](https://www.freedomscientific.com/) |
| macOS/iOS | VoiceOver | Cmd+F5 to enable |
| Android | TalkBack | Built-in |

### Verification Steps

- Navigate with Tab key, verify focus indicators
- Navigate with arrow keys (for custom widgets)
- Verify all images/icons are announced correctly
- Verify form labels are announced
- Verify error messages are announced via `role="alert"`
- Verify dynamic content updates are announced via `aria-live`
- Verify headings provide proper page structure
- Verify links are descriptive when read out of context

## Manual Keyboard Testing

1. Navigate entire UI with keyboard only (no mouse)
2. Verify all interactive elements are reachable via Tab
3. Test Tab, Shift+Tab, Arrow keys, Enter, Escape, Space
4. Verify focus order follows visual/logical reading order
5. Verify focus indicators are visible on all interactive elements
6. Verify focus does not get trapped (except in modals, which need Escape)
7. Check that focus returns after closing modals/menus

## Automated Testing Tools

| Tool | Purpose | Coverage |
|------|---------|----------|
| **axe DevTools** | Browser extension | ~30-50% of WCAG issues |
| **Lighthouse** | Accessibility audit | Built into Chrome DevTools |
| **WAVE** | Visual feedback | Page-level audit |
| **ESLint jsx-a11y** | Catches issues during development | Code-level |
| **Playwright + axe** | CI/CD automated regression | Page-level |

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Run accessibility tests
  run: npx playwright test --grep @a11y
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Only relying on automated tests | Automated tests catch 30-50%; manual + screen reader testing required |
| Testing only happy path | Test error states, loading states, empty states |
| Not testing keyboard navigation | Tab through entire flow manually |
| Ignoring screen reader announcements | Test with NVDA/VoiceOver for dynamic content |

**Incorrect — Only running automated tests:**
```typescript
test('accessibility', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  // Only catches ~30-50% of issues
});
```

**Correct — Combining automated + manual testing:**
```typescript
test('accessibility - automated', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

// Plus manual checklist:
// - Tab through all interactive elements
// - Test with screen reader (NVDA/VoiceOver)
// - Verify focus indicators visible
// - Test error state announcements
```
