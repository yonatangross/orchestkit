---
title: UI Components Rule Categories
version: 2.2.0
---

# Rule Categories

Radix primitive mechanics and shadcn customization tutorials were removed on
2026-07-31 (wrap plus delta); see "Upstream coverage (do not restate)" in
SKILL.md and `references/ork-delta.md`.

## 1. shadcn/ui (shadcn), HIGH, 1 rule

shadcn v4 style system knowledge that first-party docs do not centralize.

- `shadcn-v4-styles.md`: v4 style system (6 styles), preset codes, style detection, class mapping

## 2. Design System (design-system), HIGH, 5 rules

Design system foundations: tokens, spacing, typography, states, component architecture, and accessibility.

| Rule | Impact | File |
|------|--------|------|
| Design System Token Architecture | HIGH | `design-system-tokens.md` |
| Design System Component Architecture | HIGH | `design-system-components.md` |
| 8px Grid Spacing Scale | MEDIUM | `design-system-spacing.md` |
| Semantic Typography Scale | MEDIUM | `design-system-typography.md` |
| Interactive Component States | HIGH | `design-system-states.md` |

## 3. Forms (forms), HIGH, 2 rules

React Hook Form v7 with Zod validation and React 19 Server Actions.

- `forms-react-hook-form.md`: useForm, field arrays, Controller, multi-step wizards, file uploads
- `forms-validation-zod.md`: Zod schemas, Server Actions, useActionState, async validation

## 4. Modern CSS & Tooling (modern-css), HIGH, 3 rules

Modern CSS patterns, Tailwind v4, and component documentation tooling for 2026.

- `css-cascade-layers.md`: @layer ordering, specificity-free overrides, third-party CSS isolation
- `tailwind-v4-patterns.md`: CSS-first @theme configuration, native container queries, @max-* variants
- `storybook-component-docs.md`: CSF3 stories, play() interaction tests, Chromatic visual regression

## 5. UX Foundations (ux-foundations), HIGH, 4 rules

Cognitive-science-grounded UI/UX principles with numeric thresholds.

- `visual-hierarchy.md`: button tiers, de-emphasis, F/Z scan, Von Restorff, proximity, max-width
- `typography-thresholds.md`: 65ch line length, 1.4 to 1.6 line height, rem units, modular type scale
- `color-system.md`: OKLCH 9-shade scales, semantic categories, no true black, brand-tinted neutrals
- `empty-states.md`: skeleton-first, icon + headline + description + CTA, cause-specific tone
