---
title: Design System Component Architecture
impact: HIGH
impactDescription: "Atomic design structure and proper component patterns ensure scalable, maintainable component libraries"
tags: atomic-design, components, compound-components, accessibility, storybook, wcag
---

## Design System Component Architecture

**Incorrect — unstructured components without patterns:**
```tsx
// WRONG: No variant system, inline styles
function Button({ type, children }) {
  const style = type === 'primary'
    ? { background: 'blue', color: 'white', padding: '10px 20px' }
    : { background: 'gray', color: 'black', padding: '10px 20px' };
  return <button style={style}>{children}</button>;
}

// WRONG: Wrapper divs instead of composition
<div className="dialog-wrapper">
  <div className="dialog-overlay" />
  <div className="dialog-content">
    <button onClick={close}>Close</button>
  </div>
</div>
```

**Correct — Atomic Design with CVA variants:**
```tsx
// Atomic Design hierarchy
// Atoms -> Molecules -> Organisms -> Templates -> Pages

// Atom: Button with CVA variants
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

### Atomic Design Levels

| Level | Description | Examples |
|-------|-------------|----------|
| Atoms | Indivisible primitives | Button, Input, Label, Icon |
| Molecules | Simple compositions | FormField, SearchBar, Card |
| Organisms | Complex compositions | Navigation, Modal, DataTable |
| Templates | Page layouts | DashboardLayout, AuthLayout |
| Pages | Specific instances | HomePage, SettingsPage |

### WCAG 2.1 Level AA Requirements

| Requirement | Threshold |
|-------------|-----------|
| Normal text contrast | 4.5:1 minimum |
| Large text contrast | 3:1 minimum |
| UI components | 3:1 minimum |

### Accessibility Essentials

- **Keyboard Navigation**: All interactive elements must be keyboard accessible
- **Focus Management**: Use focus traps in modals, maintain logical focus order
- **Semantic HTML**: Use `<button>`, `<nav>`, `<main>` instead of generic divs
- **ARIA Attributes**: `aria-label`, `aria-expanded`, `aria-controls`, `aria-live`
- **No positive tabindex**: Using `tabindex > 0` disrupts natural tab order

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Component architecture | Atomic Design (scalable hierarchy) |
| Variant management | CVA (Class Variance Authority) |
| Documentation | Storybook (interactive component playground) |
| Composition | Use `asChild` to avoid wrapper divs |
| Extending components | Wrap, don't modify source files |
| Class merging | Always use cn() for Tailwind conflicts |
