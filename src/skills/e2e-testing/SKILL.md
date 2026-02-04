---
name: e2e-testing
description: End-to-end testing with Playwright 1.58+. Use when testing critical user journeys, browser automation, cross-browser testing, AI-assisted test generation, or validating complete application flows.
version: 2.1.0
tags: [playwright, e2e, testing, ai-agents]
context: fork
agent: test-generator
author: OrchestKit
user-invocable: false
---

# E2E Testing with Playwright 1.58+

Validate critical user journeys end-to-end with AI-assisted test generation.

## Quick Reference - Semantic Locators

```typescript
// PREFERRED: Role-based locators (most resilient)
await page.getByRole('button', { name: 'Add to cart' }).click();
await page.getByRole('link', { name: 'Checkout' }).click();

// GOOD: Label-based for form controls
await page.getByLabel('Email').fill('test@example.com');

// ACCEPTABLE: Test IDs for stable anchors
await page.getByTestId('checkout-button').click();

// AVOID: CSS selectors and XPath (fragile)
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

## AI Agents (1.58+)

### Initialize AI Agents

```bash
# Initialize agents for your preferred AI tool
npx playwright init-agents --loop=claude    # For Claude Code
npx playwright init-agents --loop=vscode    # For VS Code (requires v1.105+)
npx playwright init-agents --loop=opencode  # For OpenCode
```

### Generated Structure

Running `init-agents` creates the following:

| Directory/File | Purpose |
|----------------|---------|
| `.github/` | Agent definitions and configuration |
| `specs/` | Test plans in Markdown format |
| `tests/seed.spec.ts` | Seed file for AI agents to reference |

### Working with AI Agents

After initialization, agents can:
- Read test plans from `specs/` and generate tests
- Use `seed.spec.ts` as a template for consistent patterns
- Auto-repair failing tests by analyzing failures

## Breaking Changes (1.58)

The following features have been removed in Playwright 1.58:

| Removed | Migration |
|---------|-----------|
| `_react` selector | Use `getByRole()` or `getByTestId()` |
| `_vue` selector | Use `getByRole()` or `getByTestId()` |
| `:light` selector suffix | Use standard CSS selectors without `:light` |
| `devtools` launch option | Use `args: ['--auto-open-devtools-for-tabs']` instead |
| macOS 13 WebKit support | Upgrade to macOS 14+ for WebKit testing |

### Migration Examples

```typescript
// Before (1.57 and earlier)
await page.locator('_react=MyComponent').click();
await page.locator('.card:light').click();

// After (1.58+)
await page.getByTestId('my-component').click();
await page.locator('.card').click();

// DevTools launch option
// Before
const browser = await chromium.launch({ devtools: true });

// After
const browser = await chromium.launch({
  args: ['--auto-open-devtools-for-tabs']
});
```

## New Features (1.58+)

```typescript
// Connect over CDP with local flag
const browser = await chromium.connectOverCDP({
  endpointURL: 'http://localhost:9222',
  isLocal: true  // NEW: Optimizes for local connections
});

// Assert individual class names
await expect(page.locator('.card')).toContainClass('highlighted');

// Flaky test detection
export default defineConfig({
  failOnFlakyTests: true,
});

// IndexedDB storage state
await page.context().storageState({
  path: 'auth.json',
  indexedDB: true  // Include IndexedDB in storage state
});
```

### Timeline in Speedboard HTML Reports

HTML reports now include a timeline visualization showing:
- Test execution sequence
- Parallel test distribution
- Time spent in each test phase
- Performance bottlenecks

```typescript
// Enable HTML reporter with timeline
export default defineConfig({
  reporter: [['html', { open: 'never' }]],
});
```

## Anti-Patterns (FORBIDDEN)

```typescript
// NEVER use CSS selectors for user interactions
await page.click('.submit-btn');

// NEVER use hardcoded waits
await page.waitForTimeout(2000);

// NEVER test implementation details
await page.click('[data-testid="btn-123"]');

// ALWAYS use semantic locators
await page.getByRole('button', { name: 'Submit' }).click();

// ALWAYS use Playwright's auto-wait
await expect(page.getByRole('alert')).toBeVisible();
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Locators | `getByRole` > `getByLabel` > `getByTestId` |
| Browser | Chromium (Chrome for Testing in 1.58+) |
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
| [references/playwright-1.57-api.md](references/playwright-1.57-api.md) | Complete Playwright API reference |
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
**Keywords:** AI test, generate test, autonomous, test agent, planner, init-agents
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
**Keywords:** auth state, storage state, login once, reuse session, indexedDB
**Solves:**
- Persist authentication across tests
- Avoid repeated login flows
- Share auth state between tests
