# Token Naming Conventions

## Overview

Consistent token naming is essential for discoverability, tooling compatibility, and team collaboration. This guide covers naming patterns aligned with the W3C DTCG specification and industry best practices.

## Naming Structure

Tokens follow a hierarchical dot-notation path: `category.concept.modifier.state`

| Segment | Examples | Purpose |
|---------|----------|---------|
| Category | `color`, `spacing`, `typography` | What type of value |
| Concept | `primary`, `surface`, `body` | Semantic meaning |
| Modifier | `500`, `lg`, `bold` | Variant within concept |
| State | `hover`, `active`, `disabled` | Interactive state |

## Examples by Category

### Colors
```
color.primary.500          → Base primary color
color.primary.500.hover    → Hovered state
color.surface.default      → Default background
color.on-surface.default   → Text on default background
color.border.default       → Default border color
color.danger.500           → Error/danger base
```

### Spacing
```
spacing.xs     → 4px   (extra small)
spacing.sm     → 8px   (small)
spacing.md     → 16px  (medium / base)
spacing.lg     → 24px  (large)
spacing.xl     → 32px  (extra large)
spacing.2xl    → 48px  (2x extra large)
```

### Typography
```
typography.heading.xl      → Page title
typography.heading.lg      → Section heading
typography.body.md         → Body text
typography.body.sm         → Small body text
typography.label.md        → Form labels
typography.code.md         → Code blocks
```

### Component Tokens
```
button.bg.default          → Button background
button.bg.hover            → Button hover background
button.text.default        → Button text color
button.border.radius       → Button corner radius
input.bg.default           → Input background
input.border.default       → Input border
input.border.focus         → Input focus border
card.bg.default            → Card background
card.shadow.default        → Card shadow
card.border.radius         → Card corner radius
```

## Naming Rules

1. **Use camelCase** for multi-word segments: `fontSize`, `lineHeight`, `borderRadius`
2. **Use dot notation** for hierarchy: `color.primary.500`, not `color-primary-500`
3. **Semantic over visual**: `color.danger` not `color.red`; `spacing.md` not `spacing.16`
4. **Consistent state naming**: `default`, `hover`, `active`, `focus`, `disabled`
5. **Consistent scale naming**: Use t-shirt sizes (`xs`, `sm`, `md`, `lg`, `xl`) or numeric scales (`100`-`900`)
6. **No abbreviations** except well-known ones: `bg`, `sm`, `md`, `lg`, `xl`, `2xl`
7. **Prefix component tokens** with component name: `button.bg`, `card.shadow`

## CSS Custom Property Output

When tokens are transformed to CSS, dots become dashes:

```
color.primary.500  →  --color-primary-500
spacing.md         →  --spacing-md
button.bg.hover    →  --button-bg-hover
```

## Common Mistakes

| Mistake | Why It's Wrong | Better |
|---------|---------------|--------|
| `blue-500` | Visual, not semantic | `primary-500` |
| `small-padding` | Mixes concept and category | `spacing-sm` |
| `btnBg` | Unclear abbreviation | `button-bg-default` |
| `color1`, `color2` | Meaningless names | `primary`, `secondary` |
| `dark-background` | Theme-specific naming | `surface-default` |

## Mapping Figma Variables

When exporting from Figma, map variable collections to token tiers:

| Figma Collection | Token Tier | Example |
|-----------------|------------|---------|
| Primitives | Global | `color/blue/500` |
| Tokens | Alias | `color/action/default` |
| Components | Component | `button/bg/default` |
