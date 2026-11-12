---
title: "Refactoring AI Output for Design System Conformance"
impact: "HIGH"
impactDescription: "Shipping raw AI output creates design system drift — inconsistent variants, missing TypeScript props, and components that bypass CVA patterns"
tags: [refactoring, design-system, cva, typescript, shadcn-ui, conformance]
---

## Refactoring AI Output for Design System Conformance

Raw AI-generated components must be refactored through a 5-step process before merging: extract tokens, apply CVA variants, add TypeScript props, wire to design system, and verify theme compatibility.

**Incorrect:**
```tsx
// Raw v0 output — shipped as-is
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
        ${status === "active" ? "bg-green-100 text-green-800" : ""}
        ${status === "inactive" ? "bg-gray-100 text-gray-800" : ""}
        ${status === "error" ? "bg-red-100 text-red-800" : ""}`}
    >
      {status}
    </span>
  )
}
```

**Correct:**
```tsx
// After 5-step refactoring — design system conformant
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        inactive: "bg-muted text-muted-foreground",
        error: "bg-destructive/15 text-destructive",
      },
    },
    defaultVariants: { variant: "inactive" },
  }
)

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  status: "active" | "inactive" | "error"
}

export function StatusBadge({
  status,
  className,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant: status }), className)} {...props}>
      {status}
    </span>
  )
}
```

### The 5-Step Refactoring Process

1. **Extract tokens** — Replace all hardcoded colors (`green-100`, `#3b82f6`) with semantic tokens (`bg-primary`, `text-muted-foreground`)
2. **Apply CVA variants** — Convert conditional className strings to `cva()` variant definitions with `defaultVariants`
3. **Add TypeScript props** — Create explicit interface extending HTML element props + `VariantProps<typeof variants>`
4. **Wire to design system** — Import `cn()` utility, accept `className` prop for composition, use `forwardRef` if needed
5. **Verify theme** — Test light mode, dark mode, and high contrast — tokens must resolve correctly in all themes

### Refactoring Checklist

| Step | Before (AI output) | After (conformant) |
|------|-------------------|-------------------|
| Colors | `bg-blue-500`, `text-gray-600` | `bg-primary`, `text-muted-foreground` |
| Variants | Ternary chains in className | `cva()` with named variants |
| Props | `{ status: string }` | `StatusBadgeProps` with union types |
| Composition | No className prop | `cn(variants(), className)` |
| Theme | Light mode only | Verified in light, dark, high contrast |

**Key rules:**
- Never ship raw AI output — always run the 5-step process
- Use CVA for any component with 2+ visual variants — AI outputs ternary chains instead
- Union types over `string` for variant props — `"active" | "inactive"` not `string`
- Always accept `className` and spread `...props` for composition
- Test dark mode — AI tools generate with light backgrounds, tokens may not resolve in dark

Reference: https://cva.style/docs
