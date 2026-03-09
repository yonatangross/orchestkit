---
title: Use sb.mock for story-level module isolation instead of vi.mock which leaks between tests
impact: HIGH
impactDescription: "Using vi.mock in story files causes mock leakage between stories — one story's mock affects another, producing flaky tests and false passes."
tags: [storybook, mocking, sb-mock, isolation, vitest, testing, mocked]
---

## Storybook: sb.mock for Story-Level Isolation

Storybook 9/10 provides `sb.mock()` for module mocking with story-level isolation. It uses a two-part pattern: **register** mocks in `.storybook/preview.ts`, then **configure** per-story behavior using the `mocked()` utility in `beforeEach`. Unlike `vi.mock()`, which leaks between test files, `sb.mock` is automatically cleaned up between stories.

**Incorrect:**
```tsx
// Using vi.mock — leaks between stories, breaks isolation
import type { Meta, StoryObj } from '@storybook/react'
import { vi } from 'vitest'
import { UserProfile } from './UserProfile'

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

**Correct — Step 1: Register mocks in `.storybook/preview.ts`:**
```ts
// .storybook/preview.ts — registration only, runs once at startup
import { sb } from '@storybook/test'

// Register modules to mock — use dynamic import(), not string paths
sb.mock(import('../src/lib/api'))
```

**Correct — Step 2: Configure per-story in `beforeEach` using `mocked()`:**
```tsx
// UserProfile.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { expect, mocked, within } from '@storybook/test'
import { UserProfile } from './UserProfile'
import { fetchUser } from '@/lib/api'

const meta = {
  component: UserProfile,
} satisfies Meta<typeof UserProfile>

export default meta
type Story = StoryObj<typeof meta>

export const AdminUser: Story = {
  async beforeEach() {
    // mocked() accesses the spy registered in preview.ts
    mocked(fetchUser).mockResolvedValue({ name: 'John', role: 'admin' })
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Admin')).toBeVisible()
  },
}

export const RegularUser: Story = {
  async beforeEach() {
    mocked(fetchUser).mockResolvedValue({ name: 'Jane', role: 'user' })
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('User')).toBeVisible()
  },
}
```

**Key rules:**
- **Register** mocks in `.storybook/preview.ts` using `sb.mock(import(...))` — this is the only place `sb.mock` can be called.
- **Configure** per-story using `mocked(namedExport).mockResolvedValue(...)` in `beforeEach` — never call `sb.mock()` in story files.
- `sb.mock` uses `import()` expressions (not string paths) for module resolution.
- Mocks are automatically restored between stories — no manual cleanup needed.
- Never use `vi.mock()` at the top level of story files — it leaks across stories and test runs.
- For shared mock setups across multiple stories, define `beforeEach` on the `meta` object.

Reference: https://storybook.js.org/docs/writing-stories/mocking-data-and-modules/mocking-modules
