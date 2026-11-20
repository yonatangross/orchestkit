---
title: Define all interactive component states with consistent visual feedback patterns
impact: HIGH
impactDescription: "Missing states cause confusion; users need clear feedback for every interaction"
tags: component-states, hover, focus, disabled, loading, animation, accessibility
---

## Interactive Component States

**Incorrect -- button with only default state:**
```tsx
// WRONG: No hover, focus, disabled, or loading states
function Button({ children, onClick }) {
  return (
    <button onClick={onClick} className="bg-blue-500 text-white px-4 py-2 rounded">
      {children}
    </button>
  );
}
// User gets no feedback on hover, no focus ring for keyboard users,
// no visual change when disabled, no loading indicator
```

**Correct -- button with all 6 states plus animation:**

### Required States for Interactive Components

| State | Visual Indicator | Purpose |
|-------|-----------------|---------|
| Default | Base styling | Resting appearance |
| Hover | Subtle background shift, cursor change | Indicates interactivity |
| Focus | Visible ring (2px offset) | Keyboard navigation feedback |
| Active/Pressed | Scale down or darken | Confirms click/tap registered |
| Disabled | Reduced opacity, no pointer events | Shows unavailability |
| Loading | Spinner + disabled interaction | Async operation in progress |

### TypeScript Interface

```typescript
interface ComponentStateProps {
  isDisabled?: boolean;
  isLoading?: boolean;
  // Default, hover, focus, active are handled via CSS
}
```

### Tailwind State Classes

```tsx
function Button({ children, onClick, isDisabled, isLoading }: ComponentStateProps & {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isDisabled || isLoading}
      className={cn(
        // Default
        "bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium",
        "inline-flex items-center justify-center gap-2",
        // Hover
        "hover:bg-primary/90",
        // Focus (visible ring for keyboard, not mouse)
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Active
        "active:scale-[0.98] active:bg-primary/80",
        // Disabled
        "disabled:opacity-50 disabled:pointer-events-none",
        // Transition
        "transition-all duration-150 ease-in-out",
      )}
    >
      {isLoading && <Spinner className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
```

### Motion Presets

| Context | Animation Name | CSS/Tailwind | Duration | Easing |
|---------|---------------|--------------|----------|--------|
| Page transitions | `pageFade` | `animate-in fade-in` | 200ms | ease-out |
| Modals | `modalContent` | `animate-in zoom-in-95 fade-in` | 200ms | ease-out |
| List items | `staggerItem` | `animate-in slide-in-from-bottom-2` | 150ms | ease-out |
| Card hover | `cardHover` | `hover:-translate-y-1 hover:shadow-lg` | 200ms | ease-in-out |
| Button tap | `tapScale` | `active:scale-[0.98]` | 100ms | ease-in |
| Toast enter | `toastSlideIn` | `animate-in slide-in-from-right` | 300ms | ease-out |

```tsx
// Staggered list animation
{items.map((item, i) => (
  <div
    key={item.id}
    className="animate-in slide-in-from-bottom-2 fade-in"
    style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
  >
    {item.content}
  </div>
))}
```

### Accessibility Contrast Requirements

| Element | Minimum Ratio | Target Ratio | WCAG Level |
|---------|--------------|--------------|------------|
| Body text | 4.5:1 | 7:1 | AA / AAA |
| Large text (18px+ or 14px bold) | 3:1 | 4.5:1 | AA / AAA |
| UI components (borders, icons) | 3:1 | 4.5:1 | AA |
| Focus indicators | 3:1 | 4.5:1 | AA |

### State Checklist for New Components

Every interactive component must define:
1. **Default** -- base visual appearance
2. **Hover** -- `hover:` modifier with subtle visual shift
3. **Focus** -- `focus-visible:ring-2` (never remove focus outlines)
4. **Active** -- `active:` feedback (scale, darken, or both)
5. **Disabled** -- `disabled:opacity-50 disabled:pointer-events-none`
6. **Loading** -- spinner icon, disabled interaction, aria-busy="true"

Key decisions:
- Always use `focus-visible` (not `focus`) to avoid showing rings on mouse click
- Keep transitions under 200ms for interactive feedback (longer feels sluggish)
- Use `prefers-reduced-motion` media query to disable animations for accessibility
- Test all states in Storybook with a dedicated "States" story per component
