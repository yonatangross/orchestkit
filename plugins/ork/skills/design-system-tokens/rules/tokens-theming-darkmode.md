---
title: "Implement theme switching via alias token remapping"
impact: HIGH
impactDescription: "Hardcoded dark mode overrides create maintenance burden and miss edge cases like high-contrast and custom themes"
tags: [theming, dark-mode, css-variables, prefers-color-scheme, data-theme]
---

## Theming & Dark Mode

Implement themes by remapping alias tokens to different global values. Dark mode is one theme among many. Use `data-theme` attribute on the root element and `prefers-color-scheme` media query for system preference detection.

**Incorrect:**
```css
/* Hardcoded dark overrides — fragile, misses semantics */
.dark .card { background: #1f2937; color: #f9fafb; }
.dark .button { background: #60a5fa; }
.dark .sidebar { background: #111827; }
/* Hundreds of component-level overrides... */
```

**Correct:**
```css
/* Light theme (default) — alias tokens mapped to light globals */
:root {
  --color-surface: oklch(0.99 0.00 0);
  --color-surface-raised: oklch(1.00 0.00 0);
  --color-on-surface: oklch(0.15 0.00 0);
  --color-on-surface-muted: oklch(0.45 0.00 0);
  --color-action: oklch(0.55 0.18 250);
  --color-action-hover: oklch(0.48 0.18 250);
  --color-border: oklch(0.88 0.00 0);
}

/* Dark theme — same aliases, different globals */
[data-theme="dark"] {
  --color-surface: oklch(0.15 0.00 0);
  --color-surface-raised: oklch(0.20 0.01 250);
  --color-on-surface: oklch(0.95 0.00 0);
  --color-on-surface-muted: oklch(0.65 0.00 0);
  --color-action: oklch(0.65 0.16 250);
  --color-action-hover: oklch(0.70 0.14 250);
  --color-border: oklch(0.30 0.00 0);
}

/* System preference fallback */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --color-surface: oklch(0.15 0.00 0);
    --color-on-surface: oklch(0.95 0.00 0);
    /* ... same as [data-theme="dark"] */
  }
}
```

```js
// Theme toggle with system preference detection
function initTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) {
    document.documentElement.setAttribute('data-theme', stored);
  }
  // If no stored preference, :root:not([data-theme]) lets CSS handle it
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}
```

**Key rules:**
- Use `data-theme` attribute, not CSS classes, for theme selection
- Use `:root:not([data-theme])` with `prefers-color-scheme` for system preference when no explicit choice is set
- Components reference only alias tokens (`--color-surface`) — never raw values
- Dark mode is not just "invert lightness" — reduce chroma and adjust contrast for readability
- In dark themes, raise surface lightness slightly for elevated elements (cards, modals)
- Test all themes against WCAG AA contrast requirements (4.5:1 text, 3:1 UI elements)

Reference: [references/w3c-token-spec.md](../references/w3c-token-spec.md)
