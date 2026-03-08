---
title: Storybook CSF3 stories with play() interaction tests and Chromatic visual regression
impact: HIGH
impactDescription: "Without stories per state and automated visual testing, UI regressions ship undetected"
tags: storybook, csf3, testing, visual-regression, chromatic, interaction-testing
---

# Storybook Component Documentation (2026)

Every component state should be a story, every story a visual test. Use CSF3 format, `play()` functions for interaction testing, and Chromatic for CI visual regression.

## CSF3 Story Format

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'destructive', 'outline'] },
    size: { control: 'select', options: ['sm', 'default', 'lg'] },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

// One story per visual state
export const Default: Story = {
  args: { children: 'Click me', variant: 'default' },
}

export const Destructive: Story = {
  args: { children: 'Delete', variant: 'destructive' },
}

export const Loading: Story = {
  args: { children: 'Saving...', loading: true, disabled: true },
}
```

## play() Functions for Interaction Testing

Test component behavior in isolation without a full E2E framework:

```tsx
import { expect, userEvent, within } from '@storybook/test'

export const FormSubmission: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Email'), 'user@example.com')
    await userEvent.type(canvas.getByLabelText('Password'), 'securepass')
    await userEvent.click(canvas.getByRole('button', { name: /sign in/i }))
    await expect(canvas.getByText('Welcome back!')).toBeInTheDocument()
  },
}
```

## Chromatic CI Visual Regression

```yaml
# .github/workflows/chromatic.yml
- uses: chromaui/action@latest
  with:
    projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
    onlyChanged: true        # Only snapshot changed stories
    exitZeroOnChanges: true   # Don't fail CI, flag for review
```

## Incorrect -- No stories, manual visual testing only

```tsx
// Component exists but no stories
// "I'll just check it in the browser"
// No automated visual regression — bugs ship silently

// Or: stories without interaction coverage
export const Default: Story = { args: { open: true } }
// Never tests open/close flow, form validation, error states
```

## Correct -- Story per state, play() for interactions, Chromatic in CI

```tsx
// Every meaningful state is a story
export const Empty: Story = { args: { items: [] } }
export const WithItems: Story = { args: { items: mockItems } }
export const Loading: Story = { args: { loading: true } }
export const Error: Story = { args: { error: 'Failed to load' } }

// Interactive flows tested with play()
export const AddItem: Story = {
  args: { items: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /add/i }))
    await expect(canvas.getByText('New Item')).toBeInTheDocument()
  },
}
```

## Key Rules

- Use CSF3 format (`satisfies Meta<typeof Component>`) for type safety
- Add `tags: ['autodocs']` for automatic documentation generation
- Create one story per meaningful visual state (empty, loading, error, populated)
- Use `play()` functions to test interactions without E2E overhead
- Run Chromatic in CI for automated visual regression on every PR
- Keep stories co-located with components (`Component.stories.tsx`)

Reference: [Storybook Docs](https://storybook.js.org/docs)
