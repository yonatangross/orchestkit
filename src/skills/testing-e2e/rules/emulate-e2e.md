---
title: E2E Testing with emulate Backends
impact: HIGH
impactDescription: Replace flaky external APIs with emulate for deterministic E2E tests
tags: [emulate, e2e, playwright, stateful-testing, ci]
---

# E2E Testing with emulate Backends

Use emulate as the backend API layer for Playwright E2E tests. This eliminates flaky real-API calls, rate limiting, and non-deterministic data.

## Pattern: Seed -> Start -> Playwright -> Assert

```typescript
import { test, expect } from '@playwright/test';
import { startEmulate, seedConfig } from '@orchestkit/emulate';

let emulate: EmulateInstance;

test.beforeAll(async () => {
  emulate = await startEmulate({
    provider: 'github',
    seed: seedConfig({
      repos: [{ owner: 'acme', name: 'app', issues: [{ number: 1, title: 'Bug fix', state: 'open' }] }],
    }),
  });
});

test.afterAll(async () => {
  await emulate.stop();
});

test('dashboard shows seeded issues', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('cell', { name: 'Bug fix' })).toBeVisible();
});

test('closing issue updates UI', async ({ page }) => {
  await page.goto('/issues/1');
  await page.getByRole('button', { name: 'Close issue' }).click();
  await expect(page.getByText('Closed')).toBeVisible();
});
```

## Per-Worker Port Isolation (Parallel Playwright)

Playwright runs workers in parallel. Each worker needs its own emulate instance on a unique port:

```typescript
// fixtures/emulate.fixture.ts
import { test as base } from '@playwright/test';
import { startEmulate, seedConfig } from '@orchestkit/emulate';

type EmulateFixtures = { emulatePort: number };

export const test = base.extend<EmulateFixtures>({
  emulatePort: [async ({}, use, workerInfo) => {
    const port = 4100 + workerInfo.workerIndex;
    const emulate = await startEmulate({
      provider: 'github',
      port,
      seed: seedConfig({ repos: [{ owner: 'acme', name: 'app' }] }),
    });
    await use(port);
    await emulate.stop();
  }, { scope: 'worker' }],
});

// In tests:
test('worker-isolated test', async ({ page, emulatePort }) => {
  // App configured to use http://localhost:{emulatePort} as API base
  await page.goto(`/dashboard?api_port=${emulatePort}`);
});
```

## CI Configuration

```yaml
# .github/workflows/e2e.yml
jobs:
  e2e:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
        env:
          GITHUB_API_BASE: http://localhost:4100
          CI: true
```

**Incorrect -- E2E tests hitting real GitHub/Vercel APIs:**
```typescript
test('shows repos from GitHub', async ({ page }) => {
  // Flaky: depends on real GitHub API, rate-limited, non-deterministic data
  await page.goto('/repos');
  await expect(page.getByRole('cell')).toHaveCount(30); // Random count
});
```

**Correct -- emulate backends with seeded data:**
```typescript
test('shows repos from emulate', async ({ page }) => {
  // Deterministic: emulate seeded with exactly 3 repos
  await page.goto('/repos');
  await expect(page.getByRole('row')).toHaveCount(4); // 3 repos + header
});
```

## Related Skills

- `emulate-seed` — Seed configuration authoring for emulate providers
- `testing-integration` — Integration tests also use emulate as first choice
