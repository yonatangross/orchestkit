---
title: "Visual Regression Testing for Design Fidelity"
impact: "MEDIUM"
impactDescription: "Without visual regression, design drift accumulates silently — spacing, color, and typography deviations ship undetected across releases."
tags: [visual-regression, applitools, chromatic, storybook, percy, design-qa]
---

## Visual Regression Testing for Design Fidelity

Visual regression testing compares production UI screenshots against approved baselines. For design handoff, the baseline is the Figma design itself. Use Applitools Eyes with the Figma Plugin for direct Figma-to-production comparison, Chromatic for Storybook component snapshots, or Percy for full-page regression.

**Incorrect:**
```typescript
// No visual regression — manual screenshot comparison
test('button looks right', async ({ page }) => {
  await page.goto('/components/button');
  // Developer opens Figma side-by-side and squints
  // Misses: wrong padding, slightly off color, missing focus ring
  expect(true).toBe(true); // "Looks good to me"
});
```

**Correct:**
```typescript
// Applitools Eyes — automated visual comparison
import { Eyes, Target, BatchInfo } from '@applitools/eyes-playwright';

test('button matches Figma design', async ({ page }) => {
  const eyes = new Eyes();
  eyes.setBatch(new BatchInfo('Design Handoff QA'));

  await eyes.open(page, 'Component Library', 'Button — All Variants');

  // Capture each variant
  for (const variant of ['primary', 'secondary', 'ghost', 'destructive']) {
    await page.goto(`/storybook/iframe.html?id=button--${variant}`);
    await eyes.check(`Button ${variant}`, Target.window().fully());
  }

  await eyes.close(); // Fails if visual diff exceeds threshold
});
```

**Chromatic + Storybook setup:**
```typescript
// .storybook/main.ts — Chromatic captures all stories automatically
export default {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@chromatic-com/storybook'],
};

// CI: npx chromatic --project-token=$CHROMATIC_TOKEN
// Each story = one visual snapshot
// PR gets a Chromatic status check with diff review UI
```

**Percy for page-level regression:**
```typescript
// playwright.config.ts — Percy snapshot integration
import { percySnapshot } from '@percy/playwright';

test('homepage matches design', async ({ page }) => {
  await page.goto('/');
  await percySnapshot(page, 'Homepage', {
    widths: [375, 768, 1280], // Mobile, tablet, desktop
  });
});
```

**Key rules:**
- Use Applitools Figma Plugin for direct design-to-production comparison
- Use Chromatic for component-level regression via Storybook stories
- Use Percy or Playwright visual comparisons for full-page regression
- Run visual regression in CI on every PR — never rely on manual review alone
- Set appropriate diff thresholds: strict for components, relaxed for dynamic content
- Capture multiple viewport widths (375, 768, 1280) for responsive verification
- Ignore dynamic content regions (timestamps, user data) in snapshot comparisons

Reference: [Applitools Figma Plugin](https://applitools.com/platform/integrations/figma/)
