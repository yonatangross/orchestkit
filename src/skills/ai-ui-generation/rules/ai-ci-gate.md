---
title: "CI Gate for AI-Generated UI"
impact: "HIGH"
impactDescription: "Skipping CI for AI-generated components ships accessibility violations and visual regressions that manual review misses"
tags: [ci, testing, storybook, axe-core, visual-regression, lint, ai-generated]
---

## CI Gate for AI-Generated UI

Every AI-generated component must pass the same CI pipeline as hand-written code. AI tools produce plausible output that passes visual inspection but fails automated checks — especially accessibility, type safety, and bundle size.

**Incorrect:**
```yaml
# Skipping CI because "it's just a simple component from v0"
# No lint, no a11y check, no visual regression
name: Quick Deploy
on: push
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - run: npm run build
      - run: npm run deploy  # straight to production
```

**Correct:**
```yaml
name: UI Component CI
on: pull_request
jobs:
  quality-gate:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci

      # 1. Type check — AI often generates implicit any
      - run: npx tsc --noEmit

      # 2. Lint — catches unused imports, console.log, bad patterns
      - run: npx eslint 'src/components/**/*.{ts,tsx}' --max-warnings 0

      # 3. Unit tests — component renders without errors
      - run: npx vitest run --reporter=verbose

      # 4. Accessibility — axe-core catches WCAG violations
      - run: npx playwright install --with-deps chromium
      - run: npx vitest run --project=storybook

      # 5. Visual regression — catches unintended visual changes
      - run: npx playwright test --project=visual

      # 6. Bundle size — AI components may import entire libraries
      - run: npx size-limit
```

### Required CI Checks

| Check | Tool | What It Catches |
|-------|------|----------------|
| Type safety | `tsc --noEmit` | Implicit `any`, missing props, wrong event types |
| Lint | ESLint + Prettier | Unused imports, console.log, formatting |
| Unit tests | Vitest + Testing Library | Render errors, missing error boundaries |
| Accessibility | `@storybook/addon-a11y` + axe-core | Missing labels, bad ARIA, color contrast |
| Visual regression | Playwright screenshots | Unintended layout shifts, styling bugs |
| Bundle size | size-limit | Bloated imports (`import * from "lucide-react"`) |

### Storybook A11y Test Setup

`@storybook/test-runner` was removed in Storybook 9. A11y now runs through
`@storybook/addon-a11y` under `@storybook/addon-vitest`, so violations surface as
ordinary Vitest failures.

```ts
// .storybook/preview.ts
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: {
    a11y: {
      test: "error", // fail the Vitest run on any axe violation
      config: {
        rules: [
          { id: "color-contrast", enabled: true },
          { id: "label", enabled: true },
          { id: "button-name", enabled: true },
        ],
      },
    },
  },
};

export default preview;
```

```ts
// vitest.config.ts — defines the "storybook" project the CI step runs
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

export default defineConfig({
  test: {
    projects: [{
      plugins: [storybookTest({ configDir: ".storybook" })],
      test: { name: "storybook", browser: { enabled: true, provider: "playwright", headless: true } },
    }],
  },
});
```

**Key rules:**
- AI-generated components go through the exact same CI as hand-written code — no fast lanes
- Run `tsc --noEmit` before anything else — type errors indicate fundamental issues
- Use `--max-warnings 0` for ESLint — AI-generated code often has warnings that hide bugs
- Test bundle size — AI tools import entire icon libraries instead of individual icons
- Add Storybook stories for every AI-generated component — they serve as both docs and test targets

Reference: https://storybook.js.org/docs/writing-tests/accessibility-testing
