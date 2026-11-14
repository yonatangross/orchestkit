# Storybook CI Strategy (Storybook 10)

## Overview

A complete Storybook 10 CI pipeline combines three layers: **Vitest 4.1+** for interaction tests, **Chromatic** for visual regression, and **addon-a11y** for accessibility — all running in parallel for fast feedback.

---

## Pipeline Architecture

```
PR opened
├── Vitest (interaction + smoke)     ~2 min
│   ├── Stories with play() → interaction tests
│   ├── Stories without play() → smoke tests (render without error)
│   └── a11y addon → accessibility violations fail tests
├── Chromatic (visual regression)    ~3 min with TurboSnap
│   ├── TurboSnap → only changed stories snapshotted
│   ├── Visual diff review in Chromatic UI
│   └── Auto-accept on dependabot/renovate PRs
└── Lint + Type Check                ~1 min
    ├── ESLint with storybook plugin
    └── tsc --noEmit
```

---

## GitHub Actions Workflow

```yaml
name: Storybook CI
on:
  pull_request:
    branches: [main]

jobs:
  interaction-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx vitest --project=storybook --reporter=junit --outputFile=results.xml
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results
          path: results.xml

  visual-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          onlyChanged: true
          externals: |
            - 'src/styles/**'
            - 'public/fonts/**'

  a11y-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx vitest --project=storybook --reporter=default
        env:
          STORYBOOK_A11Y_STRICT: 'true'
```

---

## TurboSnap Cost Optimization

| Scenario | Without TurboSnap | With TurboSnap | Savings |
|----------|------------------|----------------|---------|
| Small component change | 500 snapshots | 15 snapshots | 97% |
| Utility file change | 500 snapshots | 80 snapshots | 84% |
| Global CSS change | 500 snapshots | 500 snapshots | 0% |
| Average PR | 500 snapshots | 50 snapshots | 90% |

---

## Best Practices

- Run Vitest interaction tests and Chromatic visual regression in **parallel** — they are independent.
- Use `onlyChanged: true` for TurboSnap to minimize Chromatic snapshot costs.
- Set `STORYBOOK_A11Y_STRICT=true` in CI to fail on any a11y violation (non-strict mode only warns).
- Cache `node_modules` and `.storybook/cache` between CI runs for faster builds.
- Use `--reporter=junit` for Vitest to produce CI-compatible test reports.
- Auto-accept Chromatic changes on bot PRs (Dependabot, Renovate) to avoid blocking dependency updates.
