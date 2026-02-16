---
title: "E2E: Page Objects"
category: e2e
impact: HIGH
impactDescription: "Encapsulates page interactions into reusable classes for maintainable and DRY end-to-end tests"
tags: page-object-model, playwright, e2e, maintainability, abstraction
---

# Page Object Model

Extract page interactions into reusable classes for maintainable E2E tests.

## Pattern

```typescript
// pages/CheckoutPage.ts
import { Page, Locator } from '@playwright/test';

export class CheckoutPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly confirmationHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.submitButton = page.getByRole('button', { name: 'Submit' });
    this.confirmationHeading = page.getByRole('heading', { name: 'Order confirmed' });
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async submit() {
    await this.submitButton.click();
  }

  async expectConfirmation() {
    await expect(this.confirmationHeading).toBeVisible();
  }
}
```

## Visual Regression

```typescript
// Capture and compare visual snapshots
await expect(page).toHaveScreenshot('checkout-page.png', {
  maxDiffPixels: 100,
  mask: [page.locator('.dynamic-content')],
});
```

## Critical User Journeys to Test

1. **Authentication:** Signup, login, password reset
2. **Core Transaction:** Purchase, booking, submission
3. **Data Operations:** Create, update, delete
4. **User Settings:** Profile update, preferences

**Incorrect — Duplicating selectors across tests:**
```typescript
test('checkout flow', async ({ page }) => {
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByRole('button', { name: 'Submit' }).click();
});

test('another checkout test', async ({ page }) => {
  await page.getByLabel('Email').fill('user@example.com');  // Duplicated
  await page.getByRole('button', { name: 'Submit' }).click();  // Duplicated
});
```

**Correct — Page Object encapsulates selectors:**
```typescript
const checkout = new CheckoutPage(page);
await checkout.fillEmail('test@example.com');
await checkout.submit();
await checkout.expectConfirmation();
```
