---
title: Use sb.mock for story-level module isolation instead of vi.mock which leaks between tests
impact: HIGH
impactDescription: "Using vi.mock in story files causes mock leakage between stories — one story's mock affects another, producing flaky tests and false passes."
tags: [storybook, mocking, sb-mock, isolation, vitest, testing]
---

## Storybook: sb.mock for Story-Level Isolation

Storybook 9/10 provides `sb.mock()` for story-scoped module mocking. Unlike `vi.mock()`, which applies globally and leaks between test files, `sb.mock()` is isolated per story and automatically cleaned up. Use it to mock API calls, services, and utilities at the story level.

**Incorrect:**
```tsx
// Using vi.mock — leaks between stories, breaks isolation
import type { Meta, StoryObj } from '@storybook/react'
import { vi } from 'vitest'
import { UserProfile } from './UserProfile'
import * as api from '@/lib/api'

// This mock leaks to ALL stories in this file and potentially others
vi.mock('@/lib/api', () => ({
  fetchUser: vi.fn().mockResolvedValue({ name: 'John', role: 'admin' }),
}))

const meta = { component: UserProfile } satisfies Meta<typeof UserProfile>
export default meta
type Story = StoryObj<typeof meta>

export const AdminUser: Story = {}
export const RegularUser: Story = {}  // Still sees admin mock — no isolation
```

**Correct:**
```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { expect, within } from '@storybook/test'
import { UserProfile } from './UserProfile'
// Import the module to get its type — sb.mock uses the module path
import * as api from '@/lib/api'

const meta = {
  component: UserProfile,
} satisfies Meta<typeof UserProfile>

export default meta
type Story = StoryObj<typeof meta>

export const AdminUser: Story = {
  async beforeEach({ sb }) {
    sb.mock('@/lib/api', () => ({
      fetchUser: async () => ({ name: 'John', role: 'admin' }),
    }))
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Admin')).toBeVisible()
  },
}

export const RegularUser: Story = {
  async beforeEach({ sb }) {
    sb.mock('@/lib/api', () => ({
      fetchUser: async () => ({ name: 'Jane', role: 'user' }),
    }))
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('User')).toBeVisible()
  },
}
```

**Key rules:**
- Use `sb.mock(modulePath, factory)` inside `beforeEach` — it scopes the mock to that story only.
- Never use `vi.mock()` at the top level of story files — it leaks across stories and test runs.
- `sb.mock` automatically restores the original module after each story — no manual cleanup needed.
- The module path in `sb.mock` must match the import path exactly (including aliases like `@/`).
- Combine `sb.mock` with `play()` functions to verify that components render correctly with mocked data.
- For shared mock setups across multiple stories, define `beforeEach` on the `meta` object.

Reference: `references/storybook-addon-ecosystem.md`
