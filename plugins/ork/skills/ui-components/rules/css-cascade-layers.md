---
title: Use CSS Cascade Layers for predictable style precedence without specificity wars
impact: HIGH
impactDescription: "Without cascade layers, teams fight specificity with !important and deeply nested selectors, causing fragile stylesheets"
tags: css, cascade-layers, specificity, architecture
---

# CSS Cascade Layers (`@layer`)

Cascade layers give you explicit control over which styles win, regardless of specificity or source order within each layer. Styles in later layers always beat earlier layers.

## Recommended Layer Order

```css
/* Declare layer order once at the top of your entry CSS file */
@layer reset, base, tokens, components, utilities, overrides;
```

| Layer | Purpose | Example |
|-------|---------|---------|
| `reset` | Normalize browser defaults | `*, *::before { box-sizing: border-box; margin: 0; }` |
| `base` | Element-level defaults | `body { font-family: var(--font-sans); }` |
| `tokens` | Design tokens / CSS custom properties | `:root { --color-primary: oklch(0.6 0.2 250); }` |
| `components` | Component-scoped styles | `.card { border-radius: var(--radius-md); }` |
| `utilities` | Tailwind or utility classes | `.sr-only { position: absolute; ... }` |
| `overrides` | Page-specific or one-off overrides | `.hero-banner .card { padding: 3rem; }` |

## Assigning Third-Party CSS to Early Layers

Push third-party styles into a low-priority layer so your styles always win:

```css
/* Import third-party CSS into the reset layer */
@import url('normalize.css') layer(reset);
@import url('some-library/styles.css') layer(base);
```

## Unlayered Styles

Styles outside any `@layer` always beat layered styles. Use this sparingly for truly global escape hatches.

## Incorrect -- Fighting specificity with !important and deep nesting

```css
/* Specificity war — fragile and hard to maintain */
.page-wrapper .content-area .sidebar .card .card-header h2 {
  color: blue;
}

.card-header h2 {
  color: red !important; /* Only way to override the above */
}
```

## Correct -- Clean layer structure with clear precedence

```css
@layer reset, base, tokens, components, utilities, overrides;

@layer components {
  .card-header h2 {
    color: var(--color-heading);
  }
}

@layer overrides {
  /* Wins over components layer regardless of specificity */
  .card-header h2 {
    color: var(--color-accent);
  }
}
```

## Key Rules

- Declare all layers in a single `@layer` statement at the top of your entry CSS
- Later layers beat earlier layers regardless of selector specificity
- Assign third-party CSS to early layers (`reset` or `base`) for clean overrides
- Never use `!important` to fight specificity — restructure layers instead
- Unlayered CSS beats all layers — keep it minimal
- Tailwind v4 uses layers internally; place custom layers around it accordingly

Reference: [MDN @layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
