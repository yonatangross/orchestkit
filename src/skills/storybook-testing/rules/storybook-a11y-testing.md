---
title: Integrate @storybook/addon-a11y with Vitest for automated accessibility testing in CI
impact: CRITICAL
impactDescription: "Without automated a11y testing, accessibility violations ship to production undetected — causing WCAG compliance failures, legal risk, and exclusion of users with disabilities."
tags: [storybook, accessibility, a11y, axe-core, wcag, ci, addon-a11y]
---

## Storybook: Accessibility Testing with addon-a11y

The `@storybook/addon-a11y` addon runs axe-core scans on every story, surfacing WCAG violations in the Storybook panel and failing CI pipelines. In Storybook 10, a11y checks integrate directly with the Vitest addon — accessibility violations become test failures.

**Incorrect:**
```tsx
// Manual accessibility checking — unreliable and not repeatable
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'

const meta = { component: Button } satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>

export const IconOnly: Story = {
  args: {
    icon: <SearchIcon />,
    // No aria-label — screen readers cannot identify the button
    // No automated test catches this
  },
}
```

**Correct:**
```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { expect, within } from '@storybook/test'
import { Button } from './Button'

const meta = {
  component: Button,
  tags: ['autodocs'],
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'button-name', enabled: true },
        ],
      },
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const IconOnly: Story = {
  args: {
    icon: <SearchIcon />,
    'aria-label': 'Search',  // accessible name for icon-only button
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: /search/i })
    await expect(button).toBeVisible()
    await expect(button).toHaveAccessibleName('Search')
  },
}

export const DisabledState: Story = {
  args: {
    label: 'Submit',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: /submit/i })
    await expect(button).toBeDisabled()
    // a11y addon automatically checks contrast, ARIA, focus management
  },
}
```

```ts
// .storybook/main.ts — register a11y addon
const config: StorybookConfig = {
  addons: [
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',  // runs axe-core on every story
  ],
}
```

**Key rules:**
- Add `@storybook/addon-a11y` to your Storybook addons — it runs axe-core scans on every story render.
- A11y violations appear in the Storybook panel AND fail as Vitest test assertions in CI.
- Configure rules per-story via `parameters.a11y.config.rules` to enable/disable specific axe rules.
- Use `tags: ['!a11y']` to exclude specific stories from a11y checks (e.g., intentional error states).
- Always provide accessible names: `aria-label` for icon buttons, `<label>` for inputs, headings for sections.
- Test keyboard navigation in play functions: `userEvent.tab()`, `userEvent.keyboard('{Enter}')`.

Reference: `references/storybook-ci-strategy.md`
