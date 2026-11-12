---
title: Tailwind v4 CSS-first configuration and native container queries
impact: HIGH
impactDescription: "Using legacy tailwind.config.js or container query plugins in v4 causes build errors and missed native features"
tags: tailwind, v4, container-queries, css-first, configuration
---

# Tailwind v4 Patterns (2026)

Tailwind v4 moves configuration to CSS, drops `tailwind.config.js`, and adds native container query support without plugins.

## CSS-First Configuration

All theme customization lives in CSS via `@theme`:

```css
/* app.css — replaces tailwind.config.js */
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.6 0.2 250);
  --color-secondary: oklch(0.7 0.15 200);
  --font-sans: "Inter", system-ui, sans-serif;
  --radius-lg: 0.75rem;
  --breakpoint-xs: 30rem;
}
```

No `tailwind.config.js`, no `resolveConfig`, no JavaScript theme access at build time.

## Native Container Queries

Container queries are built-in — no `@tailwindcss/container-queries` plugin needed.

### Basic Usage

```tsx
{/* Parent declares containment */}
<div className="@container">
  {/* Children respond to parent's width */}
  <div className="flex flex-col @md:flex-row @lg:grid @lg:grid-cols-3">
    <Card />
  </div>
</div>
```

### Named Containers

```tsx
{/* Named container */}
<div className="@container/card">
  <p className="text-sm @md/card:text-base @lg/card:text-lg">
    Responds to the card container width
  </p>
</div>
```

### Max-Width Container Queries

```tsx
{/* Max-width variant — styles apply below the breakpoint */}
<div className="@container">
  <nav className="@max-md:hidden">Desktop only nav</nav>
  <nav className="@md:hidden">Mobile nav</nav>
</div>
```

## Incorrect -- Using tailwind.config.js in v4

```js
// tailwind.config.js — WRONG in v4, this file is ignored
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
      },
    },
  },
  plugins: [
    require('@tailwindcss/container-queries'), // Plugin not needed in v4
  ],
}
```

```tsx
// Using plugin-based container syntax — unnecessary in v4
<div className="@container">
  <div className="@[480px]:flex"> {/* Old plugin syntax */}
    Content
  </div>
</div>
```

## Correct -- CSS-first @theme and native @container

```css
/* app.css */
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.6 0.2 250);
  --color-surface: oklch(0.98 0 0);
}
```

```tsx
<div className="@container/sidebar">
  <div className="flex flex-col @sm/sidebar:flex-row @md/sidebar:grid @md/sidebar:grid-cols-2">
    <Widget className="@max-sm/sidebar:p-2 @sm/sidebar:p-4" />
  </div>
</div>
```

## Key Rules

- Use `@theme` in CSS for all configuration — no `tailwind.config.js`
- Container queries are native — do not install `@tailwindcss/container-queries`
- Use `@sm:`, `@md:`, `@lg:` variants for container-width breakpoints
- Use `@max-*:` variants for max-width container queries
- Name containers with `@container/<name>` for targeted queries
- Use `/name` suffix on variants to target specific named containers
- Migrate existing `tailwind.config.js` to `@theme` block when upgrading to v4

Reference: [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
