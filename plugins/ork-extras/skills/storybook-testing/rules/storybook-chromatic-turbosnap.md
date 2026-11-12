---
title: Use Chromatic TurboSnap to reduce visual regression snapshot costs by 60-90%
impact: HIGH
impactDescription: "Full Chromatic snapshots on every PR are expensive and slow. Without TurboSnap, teams pay for unchanged story snapshots and wait for unnecessary visual diffs."
tags: [storybook, chromatic, turbosnap, visual-regression, ci, performance]
---

## Storybook: Chromatic TurboSnap

Chromatic TurboSnap uses Webpack/Vite dependency graphs to identify which stories are affected by code changes in a PR. Only affected stories are snapshotted, reducing Chromatic usage by 60-90% and speeding up visual regression checks.

**Incorrect:**
```yaml
# .github/workflows/chromatic.yml — full snapshots every time
name: Chromatic
on: pull_request
jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          # No TurboSnap — snapshots ALL stories on every PR
          # 500 stories × 3 viewports = 1500 snapshots per PR
```

**Correct:**
```yaml
# .github/workflows/chromatic.yml — TurboSnap enabled
name: Chromatic
on: pull_request
jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # required for TurboSnap git comparison
      - uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          onlyChanged: true  # enable TurboSnap
          externals: |
            - 'src/styles/**'
            - 'public/fonts/**'
          traceChanged: 'expanded'
          skip: 'dependabot/**'
```

```ts
// .storybook/main.ts — ensure correct build for TurboSnap
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: '@storybook/react-vite',
  // TurboSnap works automatically with Vite's module graph
}
```

**Key rules:**
- Set `onlyChanged: true` in the Chromatic GitHub Action to enable TurboSnap.
- Use `fetch-depth: 0` in checkout — TurboSnap needs full git history to compare changes.
- Declare `externals` for files outside the module graph (global CSS, fonts, static assets) so changes to them trigger relevant snapshots.
- Use `traceChanged: 'expanded'` to trace transitive dependencies (a utility change affects all stories that import it).
- Set `skip` for bot branches (Dependabot, Renovate) to avoid wasting snapshots on automated PRs.
- TurboSnap works with both Webpack and Vite — no extra configuration needed for Vite-based Storybook.

Reference: `references/storybook-ci-strategy.md`
