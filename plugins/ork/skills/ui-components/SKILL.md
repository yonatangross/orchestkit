---
name: ui-components
license: MIT
compatibility: "Claude Code 2.1.220+."
description: UI component library patterns for shadcn/ui and Radix Primitives. Use when building accessible component libraries, customizing shadcn components, using Radix unstyled primitives, or creating design system foundations.
tags: [ui-components, shadcn, radix, component-library, design-system, accessible-components, react-hook-form, zod, forms, validation, server-actions, field-arrays]
context: fork
agent: frontend-ui-developer
version: 2.1.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
persuasion-type: reference
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# UI Components

Patterns for building accessible UI component libraries with shadcn/ui and Radix Primitives, as a thin wrap over the first-party docs: quick-start recipes, key decisions, anti-patterns, and the house delta. Vendor mechanics (CVA variants, cn() utility, component extension, asChild composition, dialog/menu patterns, data-attribute styling) are upstream's job; see [Upstream coverage (do not restate)](#upstream-coverage-do-not-restate). Each remaining category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [shadcn/ui](#shadcnui) | 1 | HIGH | v4 styles, preset codes, style detection |
| [Design System](#design-system) | 4 | HIGH | W3C tokens, OKLCH theming, spacing scales, typography, component states, animation |
| [Design System Components](#design-system-components) | 1 | HIGH | Atomic design, CVA variants, accessibility, Storybook |
| [Forms](#forms) | 2 | HIGH | React Hook Form v7, Zod validation, Server Actions |
| [Modern CSS & Tooling](#modern-css--tooling) | 3 | HIGH | CSS cascade layers, Tailwind v4, Storybook CSF3 |
| [UX Foundations](#ux-foundations) | 4 | HIGH | Visual hierarchy, typography thresholds, color system, empty states |

**Total: 15 rules across 6 categories.** Radix primitive mechanics and shadcn
customization tutorials are first-party documented; see
[Upstream coverage (do not restate)](#upstream-coverage-do-not-restate) and
[references/ork-delta.md](references/ork-delta.md) for what stays ours.

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
| v4 Styles | `rules/shadcn-v4-styles.md` | 6 styles (Vega→Luma), preset codes, style detection, class mapping |

Customization, form, and data-table walkthroughs are upstream's job now; see
[Upstream coverage (do not restate)](#upstream-coverage-do-not-restate). Our
conventions on top of them live in [references/ork-delta.md](references/ork-delta.md).

### v4 Style System

shadcn CLI v4 ships 6 visual styles. Each rewrites component class names — not just CSS variables.

| Style | Character | Best For |
|-------|-----------|----------|
| **Vega** | Balanced radius, clean lines | General purpose (successor to New York) |
| **Nova** | Compact padding, reduced margins | Dense dashboards, admin panels |
| **Maia** | Soft, rounded, generous spacing | Consumer-facing, friendly apps |
| **Lyra** | Sharp, zero radius, monospace pairs | Editorial, developer tools |
| **Mira** | Ultra-compact, minimal chrome | Spreadsheets, data-heavy interfaces |
| **Luma** | Extreme rounding (`rounded-4xl`), soft elevation (`shadow-md` + ring), breathable layouts | Polished native-app feel, macOS Tahoe-inspired |

Configure visually at [ui.shadcn.com/create](https://ui.shadcn.com/create) → pick style, theme, fonts, icons, then copy the generated command. **Do not hardcode preset codes in docs** — they're tied to a specific style snapshot and can drift.

### shadcn CLI v4 (Apr 2026) — new commands

| Command | Purpose |
|---------|---------|
| `npx shadcn@latest apply <style>` | Apply a published style (e.g. `luma`, `nova`, `lyra`) to the current project — re-skins existing components without re-adding them |
| `npx shadcn@latest info` | Show resolved config: registry, style, tokens, components present, Tailwind version |
| `npx shadcn@latest skills` | List the `shadcn/skills` registry — Claude Code- and Cursor-ready skill packs that bundle CLI commands with agent guidance |
| `npx shadcn@latest build` | Build a custom registry (already-documented) — pair with `apply` to ship a private style |

**Detection:** Read `components.json` → `"style"` field (e.g., `"radix-luma"`, `"base-nova"`). Old `"new-york"` and `"default"` styles are superseded by Vega.

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
| Destructive confirmations | AlertDialog, never plain Dialog (see [references/ork-delta.md](references/ork-delta.md)) |

## Anti-Patterns (FORBIDDEN)

- **Modifying shadcn source**: Wrap and extend instead of editing generated files
- **Skipping cn()**: Direct string concatenation causes Tailwind class conflicts
- **Inline styles over CVA**: Use CVA for type-safe, reusable variants
- **Wrapper divs**: Use `asChild` to avoid extra DOM elements
- **Missing Dialog.Title**: Every dialog must have an accessible title
- **Positive tabindex**: Using `tabindex > 0` disrupts natural tab order
- **Color-only states**: Use data attributes + multiple indicators
- **Manual focus management**: Use Radix built-in focus trapping

## Upstream coverage (do not restate)

These topics were removed from this skill on 2026-07-31 because a first-party
source owns them. Point sessions at the source; keep only floors, scars, and
house decisions here (they live in [references/ork-delta.md](references/ork-delta.md)).

| Topic | First-party source |
|-------|--------------------|
| shadcn setup, init checklist, adding components | vercel:shadcn (marketplace skill), https://ui.shadcn.com/docs/installation |
| shadcn customization, CVA variants, cn() utility, component extension | vercel:shadcn (marketplace skill), https://ui.shadcn.com/docs and https://cva.style/docs |
| OKLCH theming variables, light/dark CSS variable sets | https://ui.shadcn.com/docs/theming |
| Dark mode toggle with next-themes | https://ui.shadcn.com/docs/dark-mode and https://github.com/pacocoursey/next-themes |
| Data table with TanStack Table | https://ui.shadcn.com/docs/components/data-table and https://tanstack.com/table |
| Form field wrappers and validation states | https://ui.shadcn.com/docs/components/form |
| Radix Dialog and AlertDialog patterns | https://www.radix-ui.com/primitives/docs/components/dialog and .../components/alert-dialog |
| Radix asChild / Slot composition | https://www.radix-ui.com/primitives/docs/guides/composition |
| Radix data-attribute styling and focus management | https://www.radix-ui.com/primitives/docs/guides/styling |
| Dropdown menu, popover, tooltip, hover card | https://www.radix-ui.com/primitives/docs/components/dropdown-menu (and sibling component pages) |
| Radix accessibility audit checklist | https://www.radix-ui.com/primitives/docs/overview/accessibility plus `ork:accessibility` |

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [scripts/](scripts/) | Templates: CVA component, extended button, dialog, dropdown, theme CSS |
| [references/ork-delta.md](references/ork-delta.md) | Ork floors, scars, and house decisions kept out of upstream docs |

## Design System

Design token architecture, spacing, typography, and interactive component states.

| Rule | File | Key Pattern |
|------|------|-------------|
| Token Architecture | `rules/design-system-tokens.md` | W3C tokens, OKLCH colors, Tailwind @theme |
| Spacing Scale | `rules/design-system-spacing.md` | 8px grid, Tailwind space-1 to space-12 |
| Typography Scale | `rules/design-system-typography.md` | Font sizes, weights, line heights |
| Component States | `rules/design-system-states.md` | Hover, focus, active, disabled, loading, animation presets |

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

## Modern CSS & Tooling

Modern CSS patterns, Tailwind v4, and component documentation tooling for 2026.

| Rule | File | Key Pattern |
|------|------|-------------|
| CSS Cascade Layers | `rules/css-cascade-layers.md` | @layer ordering, specificity-free overrides, third-party isolation |
| Tailwind v4 | `rules/tailwind-v4-patterns.md` | CSS-first @theme, native container queries, @max-* variants |
| Storybook Docs | `rules/storybook-component-docs.md` | CSF3 stories, play() interaction tests, Chromatic visual regression |

## UX Foundations

Cognitive-science-grounded UI/UX principles with specific numeric thresholds for production-quality interfaces.

| Rule | File | Key Pattern |
|------|------|-------------|
| Visual Hierarchy | `rules/visual-hierarchy.md` | Button tiers, de-emphasis, F/Z scan, Von Restorff, proximity, max-width |
| Typography Thresholds | `rules/typography-thresholds.md` | 65ch line length, 1.4–1.6 line height, rem units, modular type scale |
| Color System | `rules/color-system.md` | OKLCH 9-shade scales, semantic categories, no true black, brand-tinted neutrals |
| Empty States | `rules/empty-states.md` | Skeleton-first, icon + headline + description + CTA, cause-specific tone |

## Related Skills

- `ork:accessibility` - WCAG compliance and React Aria patterns
- `ork:testing-unit` - Component testing patterns
