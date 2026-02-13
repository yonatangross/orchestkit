---
name: ui-components
license: MIT
compatibility: "Claude Code 2.1.34+."
description: UI component library patterns for shadcn/ui and Radix Primitives. Use when building accessible component libraries, customizing shadcn components, using Radix unstyled primitives, or creating design system foundations.
tags: [ui-components, shadcn, radix, component-library, design-system, accessible-components, react-hook-form, zod, forms, validation, server-actions, field-arrays]
context: fork
agent: frontend-ui-developer
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: medium
metadata:
  category: document-asset-creation
---

# UI Components

Comprehensive patterns for building accessible UI component libraries with shadcn/ui and Radix Primitives. Covers CVA variants, OKLCH theming, cn() utility, component extension, asChild composition, dialog/menu patterns, and data-attribute styling. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [shadcn/ui](#shadcnui) | 3 | HIGH | CVA variants, component customization, form patterns, data tables |
| [Radix Primitives](#radix-primitives) | 3 | HIGH | Dialogs, polymorphic composition, data-attribute styling |
| [Design System Tokens](#design-system-tokens) | 1 | HIGH | W3C tokens, OKLCH theming, Tailwind @theme, spacing scales |
| [Design System Components](#design-system-components) | 1 | HIGH | Atomic design, CVA variants, accessibility, Storybook |
| [Forms](#forms) | 2 | HIGH | React Hook Form v7, Zod validation, Server Actions |

**Total: 10 rules across 4 categories**

## Quick Start

```tsx
// CVA variant system with cn() utility
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)
```

```tsx
// Radix Dialog with asChild composition
import { Dialog } from 'radix-ui'

<Dialog.Root>
  <Dialog.Trigger asChild>
    <Button>Open</Button>
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 bg-black/50" />
    <Dialog.Content className="data-[state=open]:animate-in">
      <Dialog.Title>Title</Dialog.Title>
      <Dialog.Description>Description</Dialog.Description>
      <Dialog.Close>Close</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

## shadcn/ui

Beautifully designed, accessible components built on CVA variants, cn() utility, and OKLCH theming.

| Rule | File | Key Pattern |
|------|------|-------------|
| Customization | `rules/shadcn-customization.md` | CVA variants, cn() utility, OKLCH theming, component extension |
| Forms | `rules/shadcn-forms.md` | Form field wrappers, react-hook-form integration, validation |
| Data Table | `rules/shadcn-data-table.md` | TanStack Table integration, column definitions, sorting/filtering |

## Radix Primitives

Unstyled, accessible React primitives for building high-quality design systems.

| Rule | File | Key Pattern |
|------|------|-------------|
| Dialog | `rules/radix-dialog.md` | Dialog, AlertDialog, controlled state, animations |
| Composition | `rules/radix-composition.md` | asChild, Slot, nested triggers, polymorphic rendering |
| Styling | `rules/radix-styling.md` | Data attributes, Tailwind arbitrary variants, focus management |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Color format | OKLCH for perceptually uniform theming |
| Class merging | Always use cn() for Tailwind conflicts |
| Extending components | Wrap, don't modify source files |
| Variants | Use CVA for type-safe multi-axis variants |
| Styling approach | Data attributes + Tailwind arbitrary variants |
| Composition | Use `asChild` to avoid wrapper divs |
| Animation | CSS-only with data-state selectors |
| Form components | Combine with react-hook-form |

## Anti-Patterns (FORBIDDEN)

- **Modifying shadcn source**: Wrap and extend instead of editing generated files
- **Skipping cn()**: Direct string concatenation causes Tailwind class conflicts
- **Inline styles over CVA**: Use CVA for type-safe, reusable variants
- **Wrapper divs**: Use `asChild` to avoid extra DOM elements
- **Missing Dialog.Title**: Every dialog must have an accessible title
- **Positive tabindex**: Using `tabindex > 0` disrupts natural tab order
- **Color-only states**: Use data attributes + multiple indicators
- **Manual focus management**: Use Radix built-in focus trapping

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [scripts/](scripts/) | Templates: CVA component, extended button, dialog, dropdown |
| [checklists/](checklists/) | shadcn setup, accessibility audit checklists |
| [references/](references/) | CVA system, OKLCH theming, cn() utility, focus management |

## Design System Tokens

Design token architecture for consistent theming and visual identity.

| Rule | File | Key Pattern |
|------|------|-------------|
| Token Architecture | `rules/design-system-tokens.md` | W3C tokens, OKLCH colors, Tailwind @theme, spacing scales |

## Design System Components

Component architecture patterns with atomic design and accessibility.

| Rule | File | Key Pattern |
|------|------|-------------|
| Component Architecture | `rules/design-system-components.md` | Atomic design, CVA variants, WCAG 2.1 AA, Storybook |

## Forms

React Hook Form v7 with Zod validation and React 19 Server Actions.

| Rule | File | Key Pattern |
|------|------|-------------|
| React Hook Form | `rules/forms-react-hook-form.md` | useForm, field arrays, Controller, wizards, file uploads |
| Zod & Server Actions | `rules/forms-validation-zod.md` | Zod schemas, Server Actions, useActionState, async validation |

## Related Skills

- `accessibility` - WCAG compliance and React Aria patterns
- `testing-patterns` - Component testing patterns
