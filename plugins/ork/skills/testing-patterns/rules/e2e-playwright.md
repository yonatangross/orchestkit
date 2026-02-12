---
title: "E2E: Playwright Core"
category: e2e
impact: HIGH
---

# Playwright E2E Testing (1.58+)

## Semantic Locators

```typescript
// PREFERRED: Role-based locators (most resilient)
await page.getByRole('button', { name: 'Add to cart' }).click();
await page.getByRole('link', { name: 'Checkout' }).click();

// GOOD: Label-based for form controls
await page.getByLabel('Email').fill('test@example.com');

// ACCEPTABLE: Test IDs for stable anchors
await page.getByTestId('checkout-button').click();

// AVOID: CSS selectors and XPath (fragile)
```

**Locator Priority:** `getByRole()` > `getByLabel()` > `getByPlaceholder()` > `getByTestId()`

## Basic Test

```typescript
import { test, expect } from '@playwright/test';

test('user can complete checkout', async ({ page }) => {
  await page.goto('/products');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('link', { name: 'Checkout' }).click();
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
});
```

## New Features (1.58+)

```typescript
// Flaky test detection
export default defineConfig({ failOnFlakyTests: true });

// Assert individual class names
await expect(page.locator('.card')).toContainClass('highlighted');

// IndexedDB storage state
await page.context().storageState({ path: 'auth.json', indexedDB: true });
```

## Anti-Patterns (FORBIDDEN)

```typescript
// NEVER use hardcoded waits
await page.waitForTimeout(2000);

// NEVER use CSS selectors for user interactions
await page.click('.submit-btn');

// ALWAYS use semantic locators + auto-wait
await page.getByRole('button', { name: 'Submit' }).click();
await expect(page.getByRole('alert')).toBeVisible();
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Locators | `getByRole` > `getByLabel` > `getByTestId` |
| Browser | Chromium (Chrome for Testing in 1.58+) |
| Execution | 5-30s per test |
| Retries | 2-3 in CI, 0 locally |
