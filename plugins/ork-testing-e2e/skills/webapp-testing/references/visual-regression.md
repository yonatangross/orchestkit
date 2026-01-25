# Playwright Native Visual Regression Testing

> **Updated Dec 2025** - Best practices for `toHaveScreenshot()` without external services like Percy or Chromatic.

## Overview

Playwright's built-in visual regression testing uses `expect(page).toHaveScreenshot()` to capture and compare screenshots. This is **completely free**, requires **no signup**, and works in CI without external dependencies.

## Quick Start

```typescript
import { test, expect } from '@playwright/test';

test('homepage visual regression', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png');
});
```

On first run, Playwright creates a baseline screenshot. Subsequent runs compare against it.

---

## Configuration (playwright.config.ts)

### Essential Settings

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  // Snapshot configuration
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  updateSnapshots: 'missing', // 'all' | 'changed' | 'missing' | 'none'

  expect: {
    toHaveScreenshot: {
      // Tolerance settings
      maxDiffPixelRatio: 0.01,  // Allow 1% pixel difference
      threshold: 0.2,           // Per-pixel color threshold (0-1)

      // Animation handling
      animations: 'disabled',   // Freeze CSS animations

      // Caret handling (text cursors)
      caret: 'hide',
    },
  },

  // CI-specific settings
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 2 : 0,

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Only run screenshots on Chromium for consistency
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      ignoreSnapshots: true,  // Skip VRT for Firefox
    },
  ],
});
```

### Snapshot Path Template Tokens

| Token | Description | Example |
|-------|-------------|---------|
| `{testDir}` | Test directory | `e2e` |
| `{testFilePath}` | Test file relative path | `specs/visual.spec.ts` |
| `{testFileName}` | Test file name | `visual.spec.ts` |
| `{arg}` | Screenshot name argument | `homepage` |
| `{ext}` | File extension | `.png` |
| `{projectName}` | Project name | `chromium` |

---

## Test Patterns

### Basic Screenshot

```typescript
test('page screenshot', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('page-name.png');
});
```

### Full Page Screenshot

```typescript
test('full page screenshot', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('full-page.png', {
    fullPage: true,
  });
});
```

### Element Screenshot

```typescript
test('component screenshot', async ({ page }) => {
  await page.goto('/');
  const header = page.locator('header');
  await expect(header).toHaveScreenshot('header.png');
});
```

### Masking Dynamic Content

```typescript
test('page with masked dynamic content', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveScreenshot('page.png', {
    mask: [
      page.locator('[data-testid="timestamp"]'),
      page.locator('[data-testid="random-avatar"]'),
      page.locator('time'),
    ],
    maskColor: '#FF00FF',  // Pink mask (default)
  });
});
```

### Custom Styles for Screenshots

```typescript
// e2e/fixtures/screenshot.css
// Hide dynamic elements during screenshots
[data-testid="timestamp"],
[data-testid="loading-spinner"] {
  visibility: hidden !important;
}

* {
  animation: none !important;
  transition: none !important;
}
```

```typescript
test('page with custom styles', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveScreenshot('styled.png', {
    stylePath: './e2e/fixtures/screenshot.css',
  });
});
```

### Responsive Viewports

```typescript
const viewports = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

for (const viewport of viewports) {
  test(`homepage - ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height
    });
    await page.goto('/');
    await expect(page).toHaveScreenshot(`homepage-${viewport.name}.png`);
  });
}
```

### Dark Mode Testing

```typescript
test('homepage dark mode', async ({ page }) => {
  await page.goto('/');

  // Toggle dark mode
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  });

  // Wait for theme to apply
  await page.waitForTimeout(100);

  await expect(page).toHaveScreenshot('homepage-dark.png');
});
```

### Waiting for Stability

```typescript
test('page after animations complete', async ({ page }) => {
  await page.goto('/');

  // Wait for network idle
  await page.waitForLoadState('networkidle');

  // Wait for specific content
  await page.waitForSelector('[data-testid="content-loaded"]');

  // Playwright auto-waits for 2 consecutive stable screenshots
  await expect(page).toHaveScreenshot('stable.png');
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Visual Regression Tests

on:
  pull_request:
    branches: [main, dev]

jobs:
  visual-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Run visual regression tests
        run: npx playwright test --project=chromium e2e/specs/visual-regression.spec.ts

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

      - name: Upload screenshots on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: screenshot-diffs
          path: e2e/__screenshots__/
          retention-days: 7
```

### Handling Baseline Updates

```yaml
# Separate workflow for updating baselines
name: Update Visual Baselines

on:
  workflow_dispatch:  # Manual trigger only

jobs:
  update-baselines:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup and install
        run: |
          npm ci
          npx playwright install chromium --with-deps

      - name: Update snapshots
        run: npx playwright test --update-snapshots

      - name: Commit updated snapshots
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add e2e/__screenshots__/
          git commit -m "chore: update visual regression baselines" || exit 0
          git push
```

---

## Handling Cross-Platform Issues

### The Problem

Screenshots differ between macOS (local) and Linux (CI) due to:
- Font rendering differences
- Anti-aliasing variations
- Subpixel rendering

### Solutions

**Option 1: Generate baselines only in CI (Recommended)**

```typescript
// playwright.config.ts
export default defineConfig({
  // Only update snapshots in CI
  updateSnapshots: process.env.CI ? 'missing' : 'none',
});
```

**Option 2: Use Docker for local development**

```bash
# Run tests in same container as CI
docker run --rm -v $(pwd):/work -w /work mcr.microsoft.com/playwright:v1.40.0-jammy \
  npx playwright test --project=chromium
```

**Option 3: Increase threshold tolerance**

```typescript
expect: {
  toHaveScreenshot: {
    maxDiffPixelRatio: 0.05,  // 5% tolerance
    threshold: 0.3,           // Higher per-pixel tolerance
  },
},
```

---

## Debugging Failed Screenshots

### View Diff Report

```bash
npx playwright show-report
```

### Generated Files on Failure

```
e2e/__screenshots__/
├── homepage.png              # Expected (baseline)
├── homepage-actual.png       # Actual (current run)
└── homepage-diff.png         # Difference highlighted
```

### Trace Viewer for Context

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    trace: 'on-first-retry',  // Capture trace on failures
  },
});
```

---

## Best Practices

### 1. Stable Selectors
```typescript
// Good - semantic selectors
await page.waitForSelector('[data-testid="content"]');

// Avoid - fragile selectors
await page.waitForSelector('.css-1234xyz');
```

### 2. Wait for Stability
```typescript
// Ensure page is ready before screenshot
await page.waitForLoadState('networkidle');
await page.waitForSelector('[data-loaded="true"]');
```

### 3. Mask Dynamic Content
```typescript
// Always mask timestamps, avatars, random content
mask: [
  page.locator('time'),
  page.locator('[data-testid="avatar"]'),
],
```

### 4. Disable Animations
```typescript
// Global in config
animations: 'disabled',

// Or per-test with CSS
stylePath: './e2e/fixtures/no-animations.css',
```

### 5. Single Browser for VRT
```typescript
// Only Chromium for visual tests - most consistent
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
],
```

### 6. Meaningful Names
```typescript
// Good - descriptive names
await expect(page).toHaveScreenshot('checkout-payment-form-error.png');

// Avoid - generic names
await expect(page).toHaveScreenshot('test1.png');
```

---

## Migration from Percy

| Percy | Playwright Native |
|-------|-------------------|
| `percySnapshot(page, 'name')` | `await expect(page).toHaveScreenshot('name.png')` |
| `.percy.yml` | `playwright.config.ts` expect settings |
| `PERCY_TOKEN` | Not needed |
| Cloud dashboard | Local HTML report |
| `percy exec --` | Direct `npx playwright test` |

### Quick Migration Script

```typescript
// Before (Percy)
import { percySnapshot } from '@percy/playwright';
await percySnapshot(page, 'Homepage - Light Mode');

// After (Playwright)
// No import needed
await expect(page).toHaveScreenshot('homepage-light.png');
```

---

## Troubleshooting

### Flaky Screenshots

**Symptoms:** Different results on each run

**Solutions:**
1. Increase `maxDiffPixelRatio` tolerance
2. Add explicit waits for dynamic content
3. Mask loading spinners and animations
4. Use `animations: 'disabled'`

### CI vs Local Differences

**Symptoms:** Tests pass locally, fail in CI

**Solutions:**
1. Generate baselines only in CI
2. Use Docker locally for consistency
3. Increase threshold for font rendering

### Large Screenshot Files

**Symptoms:** Git repository bloat

**Solutions:**
1. Use `.gitattributes` for LFS
2. Compress with `quality` option (JPEG only)
3. Limit screenshot dimensions

```gitattributes
# .gitattributes
e2e/__screenshots__/**/*.png filter=lfs diff=lfs merge=lfs -text
```
