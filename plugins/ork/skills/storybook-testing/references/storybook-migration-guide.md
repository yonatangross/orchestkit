# Storybook Migration Guide: 7/8 to 9/10

## Overview

Storybook 9 introduces breaking changes: ESM-only packages, CSF3 as the default format, Vitest replacing test-runner, and new module mocking APIs. Storybook 10 continues this direction with stricter defaults.

---

## Breaking Changes in Storybook 9

### 1. ESM-Only Packages

All Storybook packages are ESM-only. Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

### 2. CSF3 is Default

CSF2 `Template.bind({})` still works but is deprecated. Migrate to object stories:

```tsx
// Before (CSF2)
const Template: ComponentStory<typeof Button> = (args) => <Button {...args} />
export const Primary = Template.bind({})
Primary.args = { label: 'Click me' }

// After (CSF3)
export const Primary: Story = {
  args: { label: 'Click me' },
}
```

### 3. Test Runner Replaced by Vitest Addon

```bash
# Remove deprecated test-runner
npm uninstall @storybook/test-runner

# Install Vitest addon
npm install -D @storybook/addon-vitest
```

### 4. Module Mocking: vi.mock to sb.mock

Story-level mocks now use `sb.mock()` in `beforeEach` instead of top-level `vi.mock()`.

### 5. Actions: action() to fn()

```tsx
// Before
import { action } from '@storybook/addon-actions'
args: { onClick: action('clicked') }

// After
import { fn } from '@storybook/test'
args: { onClick: fn() }
```

---

## Migration Steps

### Step 1: Update Dependencies

```bash
npx storybook@latest upgrade
```

This runs codemods for common migrations automatically.

### Step 2: Update Story Files

Run the CSF3 codemod:

```bash
npx storybook@latest migrate csf-2-to-3 --glob="src/**/*.stories.tsx"
```

### Step 3: Replace Test Runner

1. Remove `@storybook/test-runner` from `package.json`
2. Add `@storybook/addon-vitest` to `.storybook/main.ts` addons
3. Add `storybookTest()` plugin to `vitest.config.ts`
4. Remove any `test-runner-jest.config.js`

### Step 4: Update Imports

```tsx
// Before (scattered imports)
import { action } from '@storybook/addon-actions'
import { within, userEvent } from '@storybook/testing-library'

// After (unified under @storybook/test)
import { fn, within, userEvent, expect } from '@storybook/test'
```

### Step 5: Verify

```bash
npm run storybook        # visual check
npx vitest               # run story tests
npx chromatic            # visual regression baseline
```

---

## Storybook 10 Preview

- Stricter CSF3 enforcement — CSF2 support removed
- React Server Component story support
- Improved Vitest integration with parallel browser tests
- Native CSS-in-JS support without extra configuration
