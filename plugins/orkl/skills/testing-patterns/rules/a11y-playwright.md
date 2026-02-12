---
title: "A11y: Playwright axe-core"
category: a11y
impact: MEDIUM
---

# Playwright + axe-core E2E

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('page has no a11y violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('modal state has no violations', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="open-modal"]');
  await page.waitForSelector('[role="dialog"]');

  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Test runner | Playwright + axe | Full page coverage |
| WCAG level | AA (wcag2aa) | Industry standard |
| State testing | Test all interactive states | Modal, error, loading |
| Browser matrix | Chromium + Firefox | Cross-browser coverage |
