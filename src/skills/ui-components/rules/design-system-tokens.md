---
title: Design System Token Architecture
impact: HIGH
impactDescription: "Consistent design tokens prevent visual inconsistencies and enable global theme changes"
tags: design-tokens, css-variables, theme, colors, spacing, typography, tailwind
---

## Design System Token Architecture

**Incorrect — hardcoded values and CSS variable abuse:**
```tsx
// WRONG: Hardcoded colors
<div className="bg-[#0066cc] text-[#ffffff]">

// WRONG: CSS variables in className (use semantic tokens instead)
<div className="bg-[var(--color-primary)]">

// WRONG: No token structure
const styles = { color: '#333', padding: '17px', fontSize: '15px' };
```

**Correct — W3C design token structure with Tailwind @theme:**
```typescript
const tokens = {
  colors: {
    primary: { base: "#0066cc", hover: "#0052a3" },
    semantic: { success: "#28a745", error: "#dc3545" }
  },
  spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px" }
};
```

```css
/* Tailwind @theme directive (recommended) */
@theme {
  --color-primary: oklch(0.55 0.15 250);
  --color-primary-hover: oklch(0.45 0.15 250);
  --color-text-primary: oklch(0.15 0 0);
  --color-background: oklch(0.98 0 0);
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
}
```

```tsx
// Components use Tailwind utilities (correct)
<div className="bg-primary text-text-primary p-md">
```

### Token Categories

| Category | Examples | Scale |
|----------|----------|-------|
| Colors | `blue.500`, `text.primary`, `feedback.error` | 50-950 |
| Typography | `fontSize.base`, `fontWeight.semibold` | xs-5xl |
| Spacing | `spacing.4`, `spacing.8` | 0-24 (4px base) |
| Border Radius | `borderRadius.md`, `borderRadius.full` | none-full |
| Shadows | `shadow.sm`, `shadow.lg` | xs-xl |

### Design System Layers

| Layer | Description | Examples |
|-------|-------------|----------|
| Design Tokens | Foundational design decisions | Colors, spacing, typography |
| Components | Reusable UI building blocks | Button, Input, Card, Modal |
| Patterns | Common UX solutions | Forms, Navigation, Layouts |
| Guidelines | Rules and best practices | Accessibility, naming, APIs |

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Token format | W3C Design Tokens (industry standard) |
| Color format | OKLCH for perceptually uniform theming |
| Styling approach | Tailwind `@theme` directive |
| Spacing base | 4px system |
| Dark mode | Tailwind `@theme` with CSS variables |
