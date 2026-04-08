---
title: UI Components Rule Categories
version: 2.1.0
---

# Rule Categories

## 1. shadcn/ui (shadcn) — HIGH — 4 rules

Beautifully designed, accessible components built on CVA variants, cn() utility, and OKLCH theming.

- `shadcn-customization.md` — CVA variants, cn() utility, OKLCH theming, component extension
- `shadcn-forms.md` — Form field wrappers, react-hook-form integration, validation
- `shadcn-data-table.md` — TanStack Table integration, column definitions, sorting/filtering
- `shadcn-v4-styles.md` — v4 style system (6 styles), preset codes, style detection, class mapping

## 2. Radix Primitives (radix) — HIGH — 3 rules

Unstyled, accessible React primitives for building high-quality design systems.

- `radix-dialog.md` — Dialog, AlertDialog, controlled state, animations
- `radix-composition.md` — asChild, Slot, nested triggers, polymorphic rendering
- `radix-styling.md` — Data attributes, Tailwind arbitrary variants, focus management

## 3. Design System (design-system) — HIGH — 5 rules

Design system foundations: tokens, spacing, typography, states, component architecture, and accessibility.

| Rule | Impact | File |
|------|--------|------|
| Design System Token Architecture | HIGH | `design-system-tokens.md` |
| Design System Component Architecture | HIGH | `design-system-components.md` |
| 8px Grid Spacing Scale | MEDIUM | `design-system-spacing.md` |
| Semantic Typography Scale | MEDIUM | `design-system-typography.md` |
| Interactive Component States | HIGH | `design-system-states.md` |

## 4. Forms (forms) -- HIGH -- 2 rules

React Hook Form v7 with Zod validation and React 19 Server Actions.

- `forms-react-hook-form.md` -- useForm, field arrays, Controller, multi-step wizards, file uploads
- `forms-validation-zod.md` -- Zod schemas, Server Actions, useActionState, async validation

## 5. Modern CSS & Tooling (modern-css) — HIGH — 3 rules

Modern CSS patterns, Tailwind v4, and component documentation tooling for 2026.

- `css-cascade-layers.md` — @layer ordering, specificity-free overrides, third-party CSS isolation
- `tailwind-v4-patterns.md` — CSS-first @theme configuration, native container queries, @max-* variants
- `storybook-component-docs.md` — CSF3 stories, play() interaction tests, Chromatic visual regression
