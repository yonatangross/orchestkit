---
name: e2e-testing
description: End-to-end testing with Playwright 1.57+. Use when testing critical user journeys, browser automation, cross-browser testing, AI-assisted test generation, or validating complete application flows.
version: 1.2.0
tags: [playwright, e2e, testing, ai-agents, 2026]
---

# E2E Testing with Playwright 1.57+

Validate critical user journeys end-to-end with AI-assisted test generation.

## When to Use

- Critical user flows
- Cross-browser testing
- Visual regression testing
- Full stack validation
- AI-assisted test generation and healing

## Semantic Locators (2026 Best Practice)

```typescript
// ✅ PREFERRED: Role-based locators (most resilient)
await page.getByRole('button', { name: 'Add to cart' }).click();
await page.getByRole('link', { name: 'Checkout' }).click();
await page.getByRole('heading', { name: 'Order Summary' });

// ✅ GOOD: Label-based for form controls
await page.getByLabel('Email').fill('test@example.com');
await page.getByLabel('Card number').fill('4242424242424242');

// ✅ ACCEPTABLE: Test IDs for stable anchors
await page.getByTestId('checkout-button').click();

// ❌ AVOID: CSS selectors and XPath (fragile)
// await page.click('[data-testid="add-to-cart"]');  // Use getByTestId instead
// await page.locator('.confirmation');              // Use getByRole instead
```

**Locator Priority (2026):**
1. `getByRole()` - Matches how users/assistive tech see the page
2. `getByLabel()` - For form inputs with labels
3. `getByPlaceholder()` - For inputs with placeholders
4. `getByTestId()` - When semantic locators aren't possible

## Basic Playwright Test

```typescript
import { test, expect } from '@playwright/test';

test('user can complete checkout flow', async ({ page }) => {
  // Navigate
  await page.goto('/products');

  // Add to cart (semantic locator)
  await page.getByRole('button', { name: 'Add to cart' }).click();

  // Go to checkout
  await page.getByRole('link', { name: 'Checkout' }).click();

  // Fill form (label-based locators)
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Card number').fill('4242424242424242');

  // Submit
  await page.getByRole('button', { name: 'Submit' }).click();

  // Verify
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
});
```

## Page Object Model

```typescript
// pages/checkout.page.ts
export class CheckoutPage {
  constructor(private page: Page) {}

  async fillEmail(email: string) {
    await this.page.fill('[name="email"]', email);
  }

  async fillCard(card: string) {
    await this.page.fill('[name="card"]', card);
  }

  async submit() {
    await this.page.click('button[type="submit"]');
  }

  async getConfirmation() {
    return this.page.locator('.confirmation').textContent();
  }
}

// tests/checkout.spec.ts
test('checkout flow', async ({ page }) => {
  const checkout = new CheckoutPage(page);

  await page.goto('/checkout');
  await checkout.fillEmail('test@example.com');
  await checkout.fillCard('4242424242424242');
  await checkout.submit();

  expect(await checkout.getConfirmation()).toContain('confirmed');
});
```

## Visual Regression

```typescript
test('homepage visual regression', async ({ page }) => {
  await page.goto('/');

  // Full page screenshot
  await expect(page).toHaveScreenshot('homepage.png');

  // Element screenshot
  await expect(page.locator('.hero')).toHaveScreenshot('hero.png');
});
```

## Authentication State

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'logged-in',
      dependencies: ['setup'],
      use: {
        storageState: 'playwright/.auth/user.json',
      },
    },
  ],
});

// auth.setup.ts
test('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});
```

## Critical User Journeys

Focus E2E tests on business-critical paths:

1. **Authentication:** Signup, login, password reset
2. **Core Transaction:** Purchase, booking, submission
3. **Data Operations:** Create, update, delete
4. **User Settings:** Profile update, preferences

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Locators | `getByRole` > `getByLabel` > `getByTestId` |
| Browser | Chromium default, Firefox/WebKit for compat |
| Execution | 5-30s per test |
| Parallelism | Use test sharding |
| Screenshots | On failure only |
| CSS/XPath | Avoid (fragile, breaks on layout changes) |

## Common Mistakes

- Too many E2E tests (slow, flaky)
- No retry logic (flaky tests)
- Hard-coded waits (use Playwright's auto-wait)
- Testing non-critical paths

## Playwright AI Agents (1.57+ - NEW)

Playwright 1.57 introduces three AI agents for LLM-guided test development:

### 1. Planner Agent 🎭

Explores your app and generates a Markdown test plan:

```bash
# Generate test plan for a user flow
npx playwright agents planner --url http://localhost:3000/checkout

# Output: checkout-test-plan.md with steps, assertions, edge cases
```

### 2. Generator Agent 🎭

Transforms the Markdown plan into Playwright test files:

```bash
# Generate tests from plan
npx playwright agents generator --plan checkout-test-plan.md

# Output: checkout.spec.ts with complete test implementation
```

### 3. Healer Agent 🎭

Automatically repairs failing tests by analyzing failures and updating selectors/assertions:

```bash
# Run healer on failing tests
npx playwright agents healer --test checkout.spec.ts

# Analyzes failures, updates locators, re-runs until passing
```

### AI Agents Workflow

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    // Enable AI agent features
    aiAgents: {
      enabled: true,
      model: 'gpt-4o',  // or local Ollama
      autoHeal: true,   // Auto-repair on CI failures
    }
  }
});
```

**Use Cases:**
- Generate tests for new features from user stories
- Maintain tests when UI changes (auto-healing)
- Bootstrap E2E coverage for legacy codebases

---

## Chrome for Testing (1.57+ Breaking Change)

Playwright 1.57 switches from Chromium to **Chrome for Testing** builds:

```typescript
// Tests now run on Chrome for Testing (not Chromium)
// This provides better compatibility with production Chrome

// No code changes needed - just upgrade Playwright
npm install @playwright/test@latest
npx playwright install
```

---

## New Assertions (1.57+)

```typescript
// New: Assert individual class names
await expect(page.locator('.card')).toContainClass('highlighted');
await expect(page.locator('.card')).toContainClass(['active', 'visible']);

// New: Describe locators for trace viewer
const submitBtn = page.getByRole('button', { name: 'Submit' });
submitBtn.describe('Main form submit button');
```

---

## Flaky Test Detection (1.57+)

```typescript
// playwright.config.ts
export default defineConfig({
  // Fail CI if any flaky tests detected
  failOnFlakyTests: true,

  // Web server with regex-based ready detection
  webServer: {
    command: 'npm run dev',
    wait: /ready in \d+ms/,  // Wait for this log pattern
  },
});
```

---

## IndexedDB Storage State (1.57+)

Save and restore IndexedDB (useful for Firebase Auth):

```typescript
// Save storage state including IndexedDB
await page.context().storageState({
  path: 'auth.json',
  indexedDB: true  // NEW: Include IndexedDB
});

// Restore with IndexedDB
const context = await browser.newContext({
  storageState: 'auth.json'  // Includes IndexedDB automatically
});
```

---

## Related Skills

- `integration-testing` - API-level testing
- `webapp-testing` - Autonomous test agents
- `performance-testing` - Load testing
- `llm-testing` - Testing AI/LLM components
