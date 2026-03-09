---
title: Use CSF3 typesafe story factories with satisfies Meta for full type inference
impact: HIGH
impactDescription: "Without CSF3 and satisfies, stories lack type safety on args, play functions, and decorators — leading to runtime errors and missing autocomplete."
tags: [storybook, csf3, typescript, type-safety, stories]
---

## Storybook: CSF3 Typesafe Story Factories

Storybook 9/10 uses Component Story Format 3 (CSF3) where stories are plain objects instead of template-bound functions. Use `satisfies Meta<typeof Component>` on the meta export for full TypeScript inference on args, decorators, and play functions.

**Incorrect:**
```tsx
// CSF2 pattern — no type inference, verbose
import { ComponentStory, ComponentMeta } from '@storybook/react'
import { Button } from './Button'

export default {
  title: 'Components/Button',
  component: Button,
} as ComponentMeta<typeof Button>

const Template: ComponentStory<typeof Button> = (args) => <Button {...args} />

export const Primary = Template.bind({})
Primary.args = {
  label: 'Click me',
  variant: 'primary',
  onClck: () => {},  // typo not caught — no type checking on args
}
```

**Correct:**
```tsx
// CSF3 pattern — full type inference via satisfies
import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Button } from './Button'

const meta = {
  component: Button,
  args: {
    onClick: fn(),  // fn() provides mock tracking
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    label: 'Click me',
    variant: 'primary',
    // onClck: () => {},  // TypeScript ERROR — catches typo at compile time
  },
}

export const Secondary: Story = {
  args: {
    label: 'Cancel',
    variant: 'secondary',
  },
}

export const WithLongLabel: Story = {
  args: {
    label: 'This is a button with a very long label to test overflow',
    variant: 'primary',
  },
}
```

**Key rules:**
- Always use `satisfies Meta<typeof Component>` (not `as Meta`) — `satisfies` preserves the inferred type while `as` erases it.
- Define `type Story = StoryObj<typeof meta>` after the default export for per-story type inference.
- Use `fn()` from `@storybook/test` for action args instead of `action()` — `fn()` integrates with Vitest assertions.
- Remove `title` from meta — Storybook 9 auto-generates titles from file paths.
- Each story is a plain object with `args`, not a function bound via `Template.bind({})`.

Reference: `references/storybook-migration-guide.md`
