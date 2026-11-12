# Applitools Figma Plugin

Setup, configuration, and CI integration for comparing Figma designs against production screenshots.

## Overview

The Applitools Figma Plugin enables direct comparison between Figma design frames and live application screenshots. It overlays production captures on Figma artboards, highlighting pixel-level differences in color, spacing, typography, and layout.

## Setup

### 1. Install the Figma Plugin

1. Open Figma → Plugins → Search "Applitools"
2. Install "Applitools Eyes for Figma"
3. Authenticate with your Applitools API key

### 2. Configure the Project

```typescript
// applitools.config.ts
import { Configuration } from '@applitools/eyes-playwright';

const config: Configuration = {
  apiKey: process.env.APPLITOOLS_API_KEY,
  appName: 'MyApp',
  batchName: 'Design Handoff QA',
  // Match Figma frame dimensions
  browser: [
    { width: 1440, height: 900, name: 'chrome' },
    { width: 375, height: 812, name: 'chrome' }, // Mobile
  ],
  // AI-powered matching — ignores anti-aliasing, minor rendering diffs
  matchLevel: 'Layout',
};

export default config;
```

### 3. Link Figma Frames to Tests

```typescript
import { Eyes, Target } from '@applitools/eyes-playwright';

test.describe('Figma Design Comparison', () => {
  let eyes: Eyes;

  test.beforeEach(async ({ page }) => {
    eyes = new Eyes();
    await eyes.open(page, 'MyApp', test.info().title);
  });

  test.afterEach(async () => {
    await eyes.close();
  });

  test('Homepage hero section', async ({ page }) => {
    await page.goto('/');
    await eyes.check(
      'Hero',
      Target.region('#hero-section')
        .ignoreDisplacements()  // Ignore content shifts
        .layout()               // Layout-level matching
    );
  });

  test('Button component — all variants', async ({ page }) => {
    await page.goto('/storybook/iframe.html?id=button--all-variants');
    await eyes.check('Button Variants', Target.window().fully());
  });
});
```

## Match Levels

| Level | What it Catches | Use Case |
|-------|----------------|----------|
| Exact | Pixel-perfect differences | Icon rendering, brand assets |
| Strict | Visual differences visible to human eye | Component QA |
| Layout | Structural/layout differences only | Pages with dynamic content |
| Content | Text content changes only | Content-heavy pages |

## CI Integration

```yaml
# .github/workflows/visual-qa.yml
name: Visual QA
on: [pull_request]

jobs:
  visual-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test tests/visual/
        env:
          APPLITOOLS_API_KEY: ${{ secrets.APPLITOOLS_API_KEY }}
      - name: Check Applitools results
        if: always()
        run: npx @applitools/eyes-cli results --fail-on-diff
```

## Figma-to-Production Comparison Workflow

1. **Designer** marks frames as "Ready for QA" in Figma
2. **CI** runs visual tests on every PR
3. **Applitools** captures screenshots and compares against baselines
4. **Applitools Figma Plugin** overlays production screenshots on Figma frames
5. **Team** reviews diffs in Applitools dashboard or Figma plugin
6. **Approve** or **reject** — rejected diffs block the PR

## Common Diff Categories

- **Color mismatch**: Token not applied, wrong mode, opacity difference
- **Spacing drift**: Padding or margin off by 1-4px from Figma values
- **Typography**: Wrong font weight, size, or line height
- **Missing states**: Hover, focus, or disabled state not implemented
- **Layout shift**: Element positioned differently than the Figma frame
- **Asset quality**: SVG not optimized, PNG at wrong resolution
