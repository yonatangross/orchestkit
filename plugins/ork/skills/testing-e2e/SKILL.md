---
name: testing-e2e
license: MIT
compatibility: "Claude Code 2.1.183+."
description: End-to-end testing patterns with Playwright — page objects, AI agent testing, visual regression, accessibility testing with axe-core, and CI integration. Use when writing E2E tests, setting up Playwright, implementing visual regression, or testing accessibility.
tags: [testing, e2e, playwright, accessibility, visual-regression, page-objects]
context: fork
agent: test-generator
version: 2.1.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
persuasion-type: reference
targets:
  - library: "@playwright/test"
    version: ">=1.59.0"  # 1.60 adds connectOverCDP({noDefaults}), webError.location(), consoleMessage.location()
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
path_patterns: ["**/e2e/**", "**/playwright/**", "**/cypress/**", "playwright.config.*"]
---

# E2E Testing Patterns

End-to-end testing with Playwright 1.59+, visual regression, accessibility, and AI agent workflows.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [**emulate Backends**](#emulate-backends) | `rules/emulate-e2e.md` | **HIGH** | **FIRST CHOICE — deterministic API backends for E2E** |
| [Playwright Core](#playwright-core) | `rules/e2e-playwright.md` | HIGH | Semantic locators, auto-wait, flaky detection |
| [Page Objects](#page-objects) | `rules/e2e-page-objects.md` | HIGH | Encapsulate page interactions, visual regression |
| [AI Agents](#ai-agents) | `rules/e2e-ai-agents.md` | HIGH | Planner/Generator/Healer, init-agents |
| [A11y Playwright](#accessibility-playwright) | `rules/a11y-playwright.md` | MEDIUM | Full-page axe-core scanning with WCAG 2.2 AA |
| [A11y CI/CD](#accessibility-cicd) | `rules/a11y-testing.md` | MEDIUM | CI gates, jest-axe unit tests, PR blocking |
| [End-to-End Types](#end-to-end-types) | `rules/validation-end-to-end.md` | HIGH | tRPC, Prisma, Pydantic type safety |

**Total: 7 rules, 4 references, 3 checklists, 3 examples, 1 script**

## emulate Backends

For E2E tests that interact with external APIs (GitHub, Vercel, Google), **use emulate as the backend** instead of hitting real APIs. This eliminates flakiness from rate limits, network issues, and non-deterministic data.

| Approach | Result |
|----------|--------|
| **emulate backends** (FIRST CHOICE) | Deterministic, fast, CI-friendly |
| Real APIs | Flaky, rate-limited, slow |
| MSW/Nock intercepts | No state machines, manual response management |

Key features: seed config for reproducible data, per-worker port isolation for parallel Playwright, full state machine transitions.

See `rules/emulate-e2e.md` for patterns, CI configuration, and per-worker isolation fixtures.

---

## Playwright Quick Start

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

**Locator Priority:** `getByRole()` > `getByLabel()` > `getByPlaceholder()` > `getByTestId()`

## Playwright Core

Semantic locator patterns and best practices for resilient tests.

| Rule | File | Key Pattern |
|------|------|-------------|
| Playwright E2E | `rules/e2e-playwright.md` | Semantic locators, auto-wait, new 1.58+ features |

Anti-patterns (FORBIDDEN):
- Hardcoded waits: `await page.waitForTimeout(2000)`
- CSS selectors for interactions: `await page.click('.submit-btn')`
- XPath locators

Removed in 1.58/1.59 — do NOT use:
- `_react=ComponentName[prop=value]` and `_vue=...` component selector engines — **removed in 1.58**
- `:light` selector suffix — **removed**
- `launch({ devtools: true })` option — **removed**; use `args: ['--auto-open-devtools-for-tabs']`

## Page Objects

Encapsulate page interactions into reusable classes.

| Rule | File | Key Pattern |
|------|------|-------------|
| Page Object Model | `rules/e2e-page-objects.md` | Locators in constructor, action methods, assertion methods |

```typescript
const checkout = new CheckoutPage(page);
await checkout.fillEmail('test@example.com');
await checkout.submit();
await checkout.expectConfirmation();
```

## AI Agents

Playwright 1.59+ AI agent framework for test planning, generation, and self-healing. Includes a **token-efficient CLI mode** designed for coding agents — minimal output, structured responses, reduced context overhead.

| Rule | File | Key Pattern |
|------|------|-------------|
| AI Agents | `rules/e2e-ai-agents.md` | Planner, Generator, Healer workflow |

```bash
npx playwright init-agents --loop=claude    # For Claude Code
```

**Token-efficient CLI mode** (1.58+): Playwright ships a SKILL-focused CLI mode that produces compact, agent-friendly output — use this when running Playwright from AI agents to minimize token consumption.

Workflow: Planner (explores app, creates specs) -> Generator (reads spec, tests live app) -> Healer (fixes failures, updates selectors).

**New in Playwright 1.59 (Apr 2026) — relevant for AI agents:**

- `page.screencast({ start, stop, showActions })` — unified video + real-time JPEG frame streaming. Lets a Healer agent read frames mid-run for visual assertion without writing video files.
- `browser.bind()` / `npx playwright-cli attach` — attach to a running browser from an MCP client mid-test; useful for Healer to inspect a hung or failing CI run.
- `locator.normalize()` — rewrites a brittle locator to best-practice equivalents. Pair with Healer to auto-upgrade `getByTestId` → `getByRole` where possible.

## Accessibility (Playwright)

Full-page accessibility validation with axe-core in E2E tests.

| Rule | File | Key Pattern |
|------|------|-------------|
| Playwright + axe | `rules/a11y-playwright.md` | WCAG 2.2 AA, interactive state testing |

```typescript
import AxeBuilder from '@axe-core/playwright';

test('page meets WCAG 2.2 AA', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

## Accessibility (CI/CD)

CI pipeline integration and jest-axe unit-level component testing.

| Rule | File | Key Pattern |
|------|------|-------------|
| CI Gates + jest-axe | `rules/a11y-testing.md` | PR blocking, component state testing |

## End-to-End Types

Type safety across API layers to eliminate runtime type errors.

| Rule | File | Key Pattern |
|------|------|-------------|
| Type Safety | `rules/validation-end-to-end.md` | tRPC, Zod, Pydantic, schema rejection tests |

## Visual Regression

Native Playwright screenshot comparison without external services.

```typescript
await expect(page).toHaveScreenshot('checkout-page.png', {
  maxDiffPixels: 100,
  mask: [page.locator('.dynamic-content')],
});
```

See `references/visual-regression.md` for full configuration, CI/CD workflows, cross-platform handling, and Percy migration guide.

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| E2E framework | Playwright 1.59+ with semantic locators |
| Locator strategy | `getByRole` > `getByLabel` > `getByTestId` |
| Browser | Chromium (Chrome for Testing in 1.59+) |
| Page pattern | Page Object Model for complex pages |
| Visual regression | Playwright native `toHaveScreenshot()` |
| A11y testing | axe-core (E2E) + jest-axe (unit) |
| CI retries | 2-3 in CI, 0 locally |
| Flaky detection | `failOnFlakyTests: true` in CI |
| AI agents | Planner/Generator/Healer via `init-agents` |
| Type safety | tRPC for end-to-end, Zod for runtime validation |

## References

| Resource | Description |
|----------|-------------|
| `references/playwright-1.59-api.md` | Playwright 1.59 API: locators, assertions, AI agents, `screencast`, `browser.bind()`, `locator.normalize()` |
| `references/playwright-setup.md` | Installation, MCP server, seed tests, agent initialization |
| `references/visual-regression.md` | Screenshot config, CI/CD workflows, cross-platform, Percy migration |
| `references/a11y-testing-tools.md` | jest-axe setup, Playwright axe-core, CI pipelines, manual checklists |

## Checklists

| Checklist | Description |
|-----------|-------------|
| `checklists/e2e-checklist.md` | Locator strategy, page objects, CI/CD, visual regression |
| `checklists/e2e-testing-checklist.md` | Comprehensive: planning, implementation, SSE, responsive, maintenance |
| `checklists/a11y-testing-checklist.md` | Automated + manual: keyboard, screen reader, color contrast, WCAG |

## Examples

| Example | Description |
|---------|-------------|
| `examples/e2e-test-patterns.md` | User flows, page objects, auth fixtures, API mocking, multi-tab, file upload |
| `examples/a11y-testing-examples.md` | jest-axe components, Playwright axe E2E, custom rules, CI pipeline |
| `examples/orchestkit-e2e-tests.md` | OrchestKit analysis flow: page objects, SSE progress, error handling |

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/create-page-object.md` | Generate Playwright page object with auto-detected patterns |

## Related Skills

- `testing-unit` - Unit testing patterns with mocking, fixtures, and data factories
- `test-standards-enforcer` - AAA and naming enforcement
- `run-tests` - Test execution orchestration
- `emulate-seed` - Seed configuration authoring for emulate providers
- `portless` (upstream) - Stable HTTPS `baseURL` for local E2E tests (`https://myapp.localhost` instead of port guessing; HTTPS-on-443 default since portless 0.10)
