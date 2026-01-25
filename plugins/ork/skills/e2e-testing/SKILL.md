---
name: e2e-testing
description: End-to-end testing with Playwright 1.57+. Use when testing critical user journeys, browser automation, cross-browser testing, AI-assisted test generation, or validating complete application flows.
version: 2.0.0
tags: [playwright, e2e, testing, ai-agents, 2026]
context: fork
agent: test-generator
author: OrchestKit
user-invocable: false
---

# E2E Testing with Playwright 1.57+

Validate critical user journeys end-to-end with AI-assisted test generation.

## Quick Reference - Semantic Locators

```typescript
// ✅ PREFERRED: Role-based locators (most resilient)
await page.getByRole('button', { name: 'Add to cart' }).click();
await page.getByRole('link', { name: 'Checkout' }).click();

// ✅ GOOD: Label-based for form controls
await page.getByLabel('Email').fill('test@example.com');

// ✅ ACCEPTABLE: Test IDs for stable anchors
await page.getByTestId('checkout-button').click();

// ❌ AVOID: CSS selectors and XPath (fragile)
// await page.click('[data-testid="add-to-cart"]');
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

## AI Agents (1.57+ - NEW)

```bash
# Generate test plan
npx playwright agents planner --url http://localhost:3000/checkout

# Generate tests from plan
npx playwright agents generator --plan checkout-test-plan.md

# Auto-repair failing tests
npx playwright agents healer --test checkout.spec.ts
```

## New Features (1.57+)

```typescript
// Assert individual class names
await expect(page.locator('.card')).toContainClass('highlighted');

// Flaky test detection
export default defineConfig({
  failOnFlakyTests: true,
});

// IndexedDB storage state
await page.context().storageState({
  path: 'auth.json',
  indexedDB: true  // NEW
});
```

## Anti-Patterns (FORBIDDEN)

```typescript
// ❌ NEVER use CSS selectors for user interactions
await page.click('.submit-btn');

// ❌ NEVER use hardcoded waits
await page.waitForTimeout(2000);

// ❌ NEVER test implementation details
await page.click('[data-testid="btn-123"]');

// ✅ ALWAYS use semantic locators
await page.getByRole('button', { name: 'Submit' }).click();

// ✅ ALWAYS use Playwright's auto-wait
await expect(page.getByRole('alert')).toBeVisible();
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Locators | `getByRole` > `getByLabel` > `getByTestId` |
| Browser | Chromium (Chrome for Testing in 1.57+) |
| Execution | 5-30s per test |
| Retries | 2-3 in CI, 0 locally |
| Screenshots | On failure only |

## Critical User Journeys to Test

1. **Authentication:** Signup, login, password reset
2. **Core Transaction:** Purchase, booking, submission
3. **Data Operations:** Create, update, delete
4. **User Settings:** Profile update, preferences

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [references/playwright-1.57-api.md](references/playwright-1.57-api.md) | Complete Playwright 1.57+ API reference |
| [examples/test-patterns.md](examples/test-patterns.md) | User flows, page objects, visual tests |
| [checklists/e2e-checklist.md](checklists/e2e-checklist.md) | Test selection and review checklists |
| [scripts/page-object-template.ts](scripts/page-object-template.ts) | Page object model template |

## Related Skills

- `integration-testing` - API-level testing
- `webapp-testing` - Autonomous test agents
- `performance-testing` - Load testing
- `llm-testing` - Testing AI/LLM components

## Capability Details

### semantic-locators
**Keywords:** getByRole, getByLabel, getByText, semantic, locator
**Solves:**
- Use accessibility-based locators
- Avoid brittle CSS/XPath selectors
- Write resilient element queries

### visual-regression
**Keywords:** visual regression, screenshot, snapshot, visual diff
**Solves:**
- Capture and compare visual snapshots
- Detect unintended UI changes
- Configure threshold tolerances

### cross-browser-testing
**Keywords:** cross browser, chromium, firefox, webkit, browser matrix
**Solves:**
- Run tests across multiple browsers
- Configure browser-specific settings
- Handle browser differences

### ai-test-generation
**Keywords:** AI test, generate test, autonomous, test agent, planner
**Solves:**
- Generate tests from user journeys
- Use AI agents for test planning
- Create comprehensive test coverage

### ai-test-healing
**Keywords:** test healing, self-heal, auto-fix, resilient test
**Solves:**
- Automatically fix broken selectors
- Adapt tests to UI changes
- Reduce test maintenance

### authentication-state
**Keywords:** auth state, storage state, login once, reuse session
**Solves:**
- Persist authentication across tests
- Avoid repeated login flows
- Share auth state between tests
