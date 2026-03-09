---
title: Use @storybook/addon-vitest to run stories as Vitest tests instead of the deprecated test-runner
impact: HIGH
impactDescription: "Using the deprecated @storybook/test-runner requires a running Storybook instance, is slower, and will be removed in Storybook 10. The Vitest addon runs stories directly in Vitest without a browser."
tags: [storybook, vitest, test-runner, addon-vitest, ci]
---

## Storybook: Vitest Integration

Storybook 9 replaces `@storybook/test-runner` with `@storybook/addon-vitest`. Stories run as native Vitest tests — no running Storybook dev server required. The `storybookTest` Vitest plugin discovers `.stories.tsx` files and executes their `play()` functions as test cases.

**Incorrect:**
```ts
// Using deprecated test-runner — requires running Storybook server
// package.json
{
  "scripts": {
    "test-storybook": "test-storybook --url http://localhost:6006"
  },
  "devDependencies": {
    "@storybook/test-runner": "^0.17.0"  // deprecated in Storybook 9
  }
}
```

```ts
// Separate test config for Storybook — duplication
// test-runner-jest.config.js
module.exports = {
  testMatch: ['**/*.stories.*'],
  transform: { /* separate transform config */ },
}
```

**Correct:**
```ts
// vitest.config.ts — stories run as native Vitest tests
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [storybookTest()],
  test: {
    setupFiles: ['./vitest.setup.ts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
    },
  },
})
```

```ts
// .storybook/main.ts — register the addon
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
  ],
  framework: '@storybook/react-vite',
}

export default config
```

```ts
// vitest.setup.ts — global setup for story tests
import '@testing-library/jest-dom/vitest'
```

**Key rules:**
- Install `@storybook/addon-vitest` and remove `@storybook/test-runner` from dependencies.
- Add `storybookTest()` to your Vitest config plugins — it auto-discovers `.stories.tsx` files.
- Stories without `play()` functions still run as smoke tests (render without errors).
- Use browser mode with Playwright for accurate DOM testing — stories render in a real browser.
- Run `vitest` to execute both regular tests and story tests in a single command.
- The addon respects `tags` filtering — use `tags: ['!test']` to exclude stories from test runs.

Reference: `references/storybook-ci-strategy.md`
