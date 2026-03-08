---
title: Use autodocs tag for living documentation generated from stories instead of maintaining separate docs
impact: MEDIUM
impactDescription: "Maintaining a separate documentation site causes docs to drift from actual component behavior. Autodocs generates accurate, always-current docs directly from stories and TypeScript types."
tags: [storybook, autodocs, documentation, prop-tables, living-docs]
---

## Storybook: Autodocs for Living Documentation

Storybook 9/10 generates documentation pages automatically from stories tagged with `autodocs`. Prop tables are derived from TypeScript types, code examples from story definitions, and usage descriptions from JSDoc comments. No separate documentation tool needed.

**Incorrect:**
```tsx
// Separate documentation maintained manually — drifts from reality
// docs/components/Button.mdx
import { Button } from '../components/Button'

# Button

| Prop | Type | Default |
|------|------|---------|
| label | string | — |
| variant | 'primary' \| 'secondary' | 'primary' |
| size | 'sm' \| 'md' \| 'lg' | 'md' |

// ^ This table is manually maintained and already out of date
// The component added a 'danger' variant last sprint
```

**Correct:**
```tsx
// Button.stories.tsx — autodocs generates the docs page
import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Button } from './Button'

const meta = {
  component: Button,
  tags: ['autodocs'],  // generates a Docs page for this component
  args: {
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
      description: 'Visual style variant of the button',
      table: { defaultValue: { summary: 'primary' } },
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
      description: 'Button size affecting padding and font size',
      table: { defaultValue: { summary: 'md' } },
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

/** The default button style used for primary actions. */
export const Primary: Story = {
  args: { label: 'Click me', variant: 'primary' },
}

/** Secondary button for less prominent actions. */
export const Secondary: Story = {
  args: { label: 'Cancel', variant: 'secondary' },
}

/** Danger variant for destructive actions like delete. */
export const Danger: Story = {
  args: { label: 'Delete', variant: 'danger' },
}
```

```tsx
// Button.tsx — JSDoc comments appear in autodocs
interface ButtonProps {
  /** Text displayed inside the button */
  label: string
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'danger'
  /** Button size affecting padding and font size */
  size?: 'sm' | 'md' | 'lg'
  /** Click handler */
  onClick?: () => void
}
```

**Key rules:**
- Add `tags: ['autodocs']` to the meta object — this generates a Docs page for the component.
- Use `argTypes` with `description` and `table.defaultValue` for rich prop documentation.
- Add JSDoc comments to component props — autodocs extracts them for the prop table.
- Add JSDoc comments to story exports — they appear as descriptions on the docs page.
- To enable autodocs globally, set `tags: ['autodocs']` in `.storybook/preview.ts`.
- Use `parameters.docs.description.component` for a component-level description at the top of the docs page.

Reference: `references/storybook-addon-ecosystem.md`
