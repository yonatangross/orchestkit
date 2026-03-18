# Storybook Migration Guide

## Storybook 9 → 10 (Current)

### Breaking Changes in Storybook 10

#### 1. CSF2 Support Removed

CSF2 `Template.bind({})` is no longer supported. All stories must use CSF3 object format:

```tsx
// CSF3 (required)
export const Primary: Story = {
  args: { label: 'Click me' },
}
```

Run the codemod if you have remaining CSF2 stories:
```bash
npx storybook@latest migrate csf-2-to-3 --glob="src/**/*.stories.tsx"
```

#### 2. ESM-Only Enforced

All Storybook packages are ESM-only. Ensure your `tsconfig.json` is configured:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

#### 3. Module Automocking

Storybook 10 introduces automatic module mocking. For explicit per-story overrides, use the two-part pattern:

1. Register mocks in `.storybook/preview.ts`:
```ts
import { sb } from '@storybook/test'
sb.mock(import('../src/api/client'), { spy: true })
```

2. Configure per-story with `mocked()` in `beforeEach`:
```tsx
import { mocked } from '@storybook/test'
import { fetchUser } from '../src/api/client'

export const WithUser: Story = {
  beforeEach: () => {
    mocked(fetchUser).mockResolvedValue({ id: '1', name: 'Test' })
  },
}
```

#### 4. React Server Component Support

Stories can now render React Server Components in isolation:
```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { ServerComponent } from './ServerComponent'

const meta = {
  component: ServerComponent,
  // RSC stories work without additional configuration in SB 10
} satisfies Meta<typeof ServerComponent>
```

#### 5. Parallel Browser Tests

Vitest integration now runs stories in parallel browser contexts for faster CI:
```ts
// vitest.config.ts
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'

export default defineConfig({
  plugins: [storybookTest({ parallel: true })],
})
```

### Migration Steps

```bash
# 1. Upgrade
npx storybook@latest upgrade

# 2. Run codemods (handles most breaking changes)
npx storybook@latest automigrate

# 3. Verify
npm run storybook        # visual check
npx vitest               # run story tests
npx chromatic            # visual regression baseline
```

---

## Storybook 7/8 → 9 (Legacy)

### Breaking Changes in Storybook 9

#### 1. ESM-Only Packages
All Storybook packages became ESM-only.

#### 2. CSF3 is Default
CSF2 still works but deprecated.

#### 3. Test Runner Replaced by Vitest Addon
```bash
npm uninstall @storybook/test-runner
npm install -D @storybook/addon-vitest
```

#### 4. Module Mocking: vi.mock → sb.mock
Two-part pattern: register in preview.ts, configure per-story.

#### 5. Actions: action() → fn()
```tsx
// Before
import { action } from '@storybook/addon-actions'
args: { onClick: action('clicked') }

// After
import { fn } from '@storybook/test'
args: { onClick: fn() }
```

#### 6. Unified Imports
```tsx
// Before (scattered imports)
import { action } from '@storybook/addon-actions'
import { within, userEvent } from '@storybook/testing-library'

// After (unified under @storybook/test)
import { fn, within, userEvent, expect } from '@storybook/test'
```
