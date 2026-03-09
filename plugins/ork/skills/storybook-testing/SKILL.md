---
name: storybook-testing
license: MIT
compatibility: "Claude Code 2.1.59+."
description: Storybook 9/10 testing patterns with Vitest integration, CSF3 typesafe factories, play() interaction tests, Chromatic TurboSnap visual regression, sb.mock isolation, accessibility addon testing, and autodocs generation. Use when writing component stories, setting up visual regression testing, configuring Storybook CI pipelines, or migrating to Storybook 9/10.
tags: [storybook, vitest, csf3, chromatic, turbosnap, visual-regression, play-functions, component-testing, a11y-testing, autodocs]
context: fork
agent: frontend-ui-developer
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Storybook Testing — Storybook 9/10

## Overview

Storybook 9/10 unifies component testing into a single workflow: **interaction tests** via `play()` functions, **visual regression** via Chromatic TurboSnap, and **accessibility audits** via the a11y addon — all running through Vitest. Stories are no longer just documentation; they are executable test specifications.

**When to use this skill:**
- Writing component stories in CSF3 format with TypeScript
- Setting up interaction tests with `play()` functions
- Configuring Chromatic visual regression with TurboSnap
- Mocking modules at the story level with `sb.mock`
- Running accessibility tests in CI via the a11y addon
- Generating living documentation with autodocs
- Migrating from Storybook 7/8 to 9/10

---

## Quick Reference

| Rule | Impact | Description |
|------|--------|-------------|
| `storybook-csf3-factories` | HIGH | Typesafe CSF3 story factories with `satisfies Meta` |
| `storybook-play-functions` | CRITICAL | Interaction testing with `play()` and `@storybook/test` |
| `storybook-vitest-integration` | HIGH | Run stories as Vitest tests via `@storybook/addon-vitest` |
| `storybook-chromatic-turbosnap` | HIGH | TurboSnap reduces snapshot cost 60-90% |
| `storybook-sb-mock` | HIGH | Story-level module mocking with `sb.mock` |
| `storybook-a11y-testing` | CRITICAL | Automated axe-core accessibility scans in CI |
| `storybook-autodocs` | MEDIUM | Auto-generated docs from stories |

---

## Storybook Testing Pyramid

```
         ┌──────────────┐
         │   Visual     │  Chromatic TurboSnap
         │  Regression  │  (snapshot diffs)
         ├──────────────┤
         │ Accessibility│  @storybook/addon-a11y
         │   (a11y)     │  (axe-core scans)
         ├──────────────┤
         │ Interaction  │  play() functions
         │   Tests      │  (@storybook/test)
         ├──────────────┤
         │  Unit Tests  │  Vitest + storybookTest
         │  (stories)   │  plugin
         └──────────────┘
```

Each layer catches different defects: unit tests validate logic, interaction tests verify user flows, a11y tests catch accessibility violations, and visual tests catch unintended UI regressions.

---

## Quick Start

### CSF3 Story with Play Function

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from '@storybook/test'
import { Button } from './Button'

const meta = {
  component: Button,
  args: {
    onClick: fn(),
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    label: 'Click me',
    variant: 'primary',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: /click me/i })

    await userEvent.click(button)
    await expect(args.onClick).toHaveBeenCalledOnce()
    await expect(button).toHaveStyle({ backgroundColor: 'rgb(37, 99, 235)' })
  },
}
```

### Vitest Configuration

```ts
// vitest.config.ts
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [storybookTest()],
  test: {
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

---

## Key Principles

- **Stories are tests.** Every story with a `play()` function is an executable interaction test that runs in Vitest.
- **CSF3 + `satisfies` for type safety.** Use `satisfies Meta<typeof Component>` for full type inference on args and play functions.
- **Isolate with `sb.mock`, not `vi.mock`.** Story-level module mocking via `sb.mock` is scoped per-story and does not leak between tests.
- **TurboSnap for CI speed.** Only snapshot stories affected by code changes — reduces Chromatic usage by 60-90%.
- **Accessibility is not optional.** The a11y addon runs axe-core scans on every story and gates CI on violations.
- **Living documentation.** Autodocs generates prop tables and usage examples directly from stories — no separate docs site needed.

---

## Anti-Patterns (FORBIDDEN)

| Anti-Pattern | Why It Fails | Use Instead |
|-------------|-------------|-------------|
| CSF2 `Template.bind({})` | No type inference, verbose | CSF3 object stories with `satisfies` |
| `@storybook/test-runner` package | Deprecated in Storybook 9 | `@storybook/addon-vitest` |
| `vi.mock()` in story files | Leaks between stories, breaks isolation | Register `sb.mock(import(...))` in preview.ts, configure with `mocked()` in beforeEach |
| Full Chromatic snapshots on every PR | Expensive and slow | TurboSnap with `onlyChanged: true` |
| Manual accessibility checking | Misses violations, not repeatable | `@storybook/addon-a11y` in CI pipeline |
| Separate documentation site | Drifts from actual component behavior | Autodocs with `tags: ['autodocs']` |
| Testing implementation details | Brittle, breaks on refactors | Test user-visible behavior via `play()` |

---

## References

- `references/storybook-migration-guide.md` — Migration path from Storybook 7/8 to 9/10
- `references/storybook-ci-strategy.md` — CI pipeline configuration for visual, interaction, and a11y testing
- `references/storybook-addon-ecosystem.md` — Essential addons for Storybook 9/10 in 2026

## Related Skills

- `react-server-components-framework` — React 19 + Next.js 16 patterns (component architecture)
- `accessibility` — Broader accessibility patterns beyond Storybook
- `ci-automation` — CI pipeline patterns for automated testing
