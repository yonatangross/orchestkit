---
title: "Skeleton Loading States"
impact: "HIGH"
impactDescription: "Without content-shaped placeholders, users see jarring spinners or blank screens that increase perceived load time by 2-3x"
tags: [skeleton, loading, spinner, progress-bar, perceived-performance, animate-pulse]
---

## Skeleton Loading States

Use skeleton placeholders that match the shape of content being loaded. Reserve spinners for indeterminate actions and progress bars for measurable operations.

**Incorrect:**
```tsx
// Spinner for content loading — gives no spatial hint, feels slower
function UserProfile({ isLoading, user }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }
  return <ProfileCard user={user} />
}
```

**Correct:**
```tsx
// Skeleton matching content shape — preserves layout, reduces perceived latency
function ProfileSkeleton() {
  return (
    <div className="animate-pulse flex items-center gap-4 p-4">
      <div className="h-16 w-16 rounded-full bg-muted" /> {/* Avatar */}
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 rounded bg-muted" />  {/* Name */}
        <div className="h-3 w-1/2 rounded bg-muted" />  {/* Email */}
        <div className="h-3 w-2/3 rounded bg-muted" />  {/* Bio */}
      </div>
    </div>
  )
}

function UserProfile({ isLoading, user }: Props) {
  if (isLoading) return <ProfileSkeleton />
  return <ProfileCard user={user} />
}
```

### Decision Guide

| Scenario | Pattern | Duration |
|----------|---------|----------|
| List / card data | Skeleton | > 200ms |
| Form submission | Spinner (button) | < 3s |
| File upload | Progress bar | Variable |
| Image load | Blur placeholder | Variable |
| Route change | Skeleton | > 300ms |
| Background task | Subtle indicator | N/A |

### Skeleton Composition

```tsx
// Reusable skeleton primitives — cn() from shadcn/ui: import { cn } from "@/lib/utils"
function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />
}

// Compose to match any content shape
function TableRowSkeleton() {
  return (
    <tr>
      <td><Skeleton className="h-4 w-24" /></td>
      <td><Skeleton className="h-4 w-32" /></td>
      <td><Skeleton className="h-4 w-16" /></td>
    </tr>
  )
}
```

**Key rules:**
- Skeleton shapes must match the content they replace — same height, width, and position
- Use `animate-pulse` (Tailwind) or CSS `@keyframes` for subtle shimmer — never spinning skeleton
- Show skeletons only for loads > 200ms — use `startTransition` or delay to avoid flash
- Match skeleton count to expected content count (e.g., 6 card skeletons for a 6-item grid)
- Never nest spinners inside skeletons — pick one pattern per loading context

References:
- https://web.dev/articles/ux-basics-skeleton-screens
- https://www.w3.org/WAI/ARIA/apg/patterns/feed/ (aria-busy pattern for loading states)
