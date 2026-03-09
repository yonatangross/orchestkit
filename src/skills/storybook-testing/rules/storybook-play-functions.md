---
title: Use play() functions with @storybook/test for interaction testing instead of manual verification
impact: CRITICAL
impactDescription: "Without play() interaction tests, component behavior is only verified manually — regressions go undetected until production, and user flows are never validated in CI."
tags: [storybook, play-functions, interaction-testing, user-event, assertions]
---

## Storybook: Play Functions for Interaction Testing

Every story that demonstrates interactive behavior should include a `play()` function. Play functions simulate real user interactions using `userEvent` and validate outcomes with `expect` — all from `@storybook/test`. These run automatically in the Storybook UI and as Vitest tests in CI.

**Incorrect:**
```tsx
// No play function — behavior is only verified by opening Storybook and clicking manually
import type { Meta, StoryObj } from '@storybook/react'
import { LoginForm } from './LoginForm'

const meta = { component: LoginForm } satisfies Meta<typeof LoginForm>
export default meta
type Story = StoryObj<typeof meta>

export const SubmitForm: Story = {
  args: {
    onSubmit: () => console.log('submitted'),  // no mock tracking
  },
  // No play function — manual testing only
}
```

**Correct:**
```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, within } from '@storybook/test'
import { LoginForm } from './LoginForm'

const meta = {
  component: LoginForm,
  args: {
    onSubmit: fn(),
  },
} satisfies Meta<typeof LoginForm>

export default meta
type Story = StoryObj<typeof meta>

export const SubmitForm: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    // Simulate user filling out the form
    await userEvent.type(canvas.getByLabelText(/email/i), 'user@example.com')
    await userEvent.type(canvas.getByLabelText(/password/i), 'SecureP@ss1')
    await userEvent.click(canvas.getByRole('button', { name: /sign in/i }))

    // Assert the callback was called with form data
    await expect(args.onSubmit).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'SecureP@ss1',
    })
  },
}

export const ValidationError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Submit empty form
    await userEvent.click(canvas.getByRole('button', { name: /sign in/i }))

    // Assert validation messages appear
    await expect(canvas.getByText(/email is required/i)).toBeVisible()
    await expect(canvas.getByText(/password is required/i)).toBeVisible()
  },
}
```

**Key rules:**
- Import `expect`, `fn`, `userEvent`, and `within` from `@storybook/test` — not from Vitest or Testing Library directly.
- Use `within(canvasElement)` to scope queries to the story's rendered output, not `screen`.
- Use accessible queries: `getByRole`, `getByLabelText`, `getByText` — avoid `getByTestId` unless no semantic alternative exists.
- Always `await` each `userEvent` and `expect` call — play functions are async.
- Use `fn()` for callback props so assertions like `toHaveBeenCalledWith` work correctly.
- Play functions run in sequence: the Storybook UI shows step-by-step results, and Vitest reports pass/fail.

Reference: `references/storybook-ci-strategy.md`
