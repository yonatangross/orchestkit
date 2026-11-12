---
title: "Loading States Decision Tree"
version: 1.0.0
---

# Loading States Decision Tree

## Decision Flow

```
Is the operation measurable (known total)?
├── YES → Is total > 5 seconds?
│         ├── YES → Progress bar with percentage + time estimate
│         └── NO  → Progress bar with percentage only
└── NO  → Is it loading content that has a known shape?
          ├── YES → Does the content area have a defined layout?
          │         ├── YES → Skeleton matching layout shape
          │         └── NO  → Content placeholder (gray box)
          └── NO  → Is it a user-initiated action (button click, form submit)?
                    ├── YES → Is expected duration < 1 second?
                    │         ├── YES → Button spinner (inline)
                    │         └── NO  → Overlay spinner with message
                    └── NO  → Is it a background task?
                              ├── YES → Subtle indicator (status bar, badge)
                              └── NO  → Full-area spinner
```

## Pattern Comparison

| Pattern | Use When | Duration | Layout Shift | Perceived Speed |
|---------|----------|----------|-------------|-----------------|
| Skeleton | Content loading (lists, cards, profiles) | > 200ms | None | Fast |
| Spinner (inline) | Button actions, form submissions | < 3s | None | Neutral |
| Spinner (overlay) | Page-level blocking operations | 1-10s | None | Slow |
| Progress bar | File upload, export, sync | Variable | None | Predictable |
| Blur placeholder | Image loading | Variable | None | Fast |
| Shimmer | Content loading (alternative to pulse) | > 200ms | None | Fast |
| None | Background sync, prefetch | N/A | None | Invisible |

## Implementation Guidelines

### Skeleton

- Match the shape of the content being loaded (height, width, border-radius)
- Use `animate-pulse` (Tailwind) for subtle animation
- Show skeleton only after 200ms delay to avoid flash for fast loads
- Match skeleton count to expected item count

### Spinner

- Inline spinner: replace button text, keep button dimensions
- Overlay spinner: center in container, add semi-transparent backdrop
- Always include `aria-busy="true"` on the loading container
- Use `role="status"` with screen reader text: "Loading..."

### Progress Bar

- Show percentage and/or time estimate for operations > 5s
- Use `<progress>` element for semantic HTML
- Update smoothly — avoid jumps larger than 10%
- Show indeterminate state if total is temporarily unknown

### Blur Placeholder

- Generate low-res blur hash at build time (BlurHash, LQIP)
- Apply as CSS `background-image` before full image loads
- Transition from blur to sharp with `opacity` animation
- Set explicit `width` and `height` to prevent layout shift

## Timing Thresholds

| Threshold | Action |
|-----------|--------|
| < 100ms | No loading indicator needed |
| 100-200ms | Optional subtle indicator |
| 200ms-1s | Skeleton or spinner |
| 1-5s | Skeleton + progress message |
| 5-30s | Progress bar with estimate |
| > 30s | Progress bar + cancel button |

## Anti-Patterns

- **Spinner for content loading** — Gives no spatial hint; use skeleton instead
- **Flash of loading state** — Show skeleton only after 200ms delay
- **Progress bar jumping backward** — Never decrease progress; use indeterminate if uncertain
- **Multiple loading indicators** — One loading indicator per visual region, not per component
- **Loading without timeout** — Always set a timeout and show error/retry after 30s
