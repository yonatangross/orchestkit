---
name: interaction-patterns
license: MIT
compatibility: "Claude Code 2.1.72+."
description: UI interaction design patterns for skeleton loading, infinite scroll with accessibility, progressive disclosure, modal/drawer/inline selection, drag-and-drop with keyboard alternatives, tab overflow handling, and toast notification positioning. Use when implementing loading states, content pagination, disclosure patterns, overlay components, reorderable lists, or notification systems.
tags: [interaction-design, skeleton-loading, infinite-scroll, progressive-disclosure, modal, drawer, drag-drop, tabs, toast, ux-patterns]
context: fork
agent: frontend-ui-developer
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Interaction Patterns

Codifiable UI interaction patterns that prevent common UX failures. Covers loading states, content pagination, disclosure patterns, overlays, drag-and-drop, tab overflow, and notification systems — all with accessibility baked in.

## Quick Reference

| Rule | File | Impact | When to Use |
|------|------|--------|-------------|
| Skeleton Loading | `rules/interaction-skeleton-loading.md` | HIGH | Content-shaped placeholders for async data |
| Infinite Scroll | `rules/interaction-infinite-scroll.md` | CRITICAL | Paginated content with a11y and keyboard support |
| Progressive Disclosure | `rules/interaction-progressive-disclosure.md` | HIGH | Revealing complexity based on user need |
| Modal / Drawer / Inline | `rules/interaction-modal-drawer-inline.md` | HIGH | Choosing overlay vs inline display patterns |
| Drag & Drop | `rules/interaction-drag-drop.md` | CRITICAL | Reorderable lists with keyboard alternatives |
| Tabs Overflow | `rules/interaction-tabs-overflow.md` | MEDIUM | Tab bars with 7+ items or dynamic tabs |
| Toast Notifications | `rules/interaction-toast-notifications.md` | HIGH | Success/error feedback and notification stacking |
| Cognitive Load Thresholds | `rules/interaction-cognitive-load-thresholds.md` | HIGH | Enforcing Miller's Law, Hick's Law, and Doherty Threshold with numeric limits |
| Form UX | `rules/interaction-form-ux.md` | HIGH | Target sizing, label placement, error prevention, and smart defaults |
| Persuasion Ethics | `rules/interaction-persuasion-ethics.md` | HIGH | Detecting dark patterns and applying ethical engagement principles |

**Total: 10 rules across 6 categories**

## Decision Table — Loading States

| Scenario | Pattern | Why |
|----------|---------|-----|
| List/card content loading | Skeleton | Matches content shape, reduces perceived latency |
| Form submission | Spinner | Indeterminate, short-lived action |
| File upload | Progress bar | Measurable operation with known total |
| Image loading | Blur placeholder | Prevents layout shift, progressive reveal |
| Route transition | Skeleton | Preserves layout while data loads |
| Background sync | None / subtle indicator | Non-blocking, low priority |

## Quick Start

### Skeleton Loading

```tsx
function CardSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-48 w-full rounded-lg bg-muted" />
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-4 w-1/2 rounded bg-muted" />
    </div>
  )
}

function CardList({ items, isLoading }: { items: Item[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map((item) => <Card key={item.id} item={item} />)}
    </div>
  )
}
```

### Infinite Scroll with Accessibility

```tsx
function InfiniteList({ fetchNextPage, hasNextPage, items }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasNextPage) fetchNextPage() },
      { rootMargin: "200px" }
    )
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage])

  return (
    <div role="feed" aria-busy={isFetching}>
      {items.map((item) => (
        <article key={item.id} aria-posinset={item.index} aria-setsize={-1}>
          <ItemCard item={item} />
        </article>
      ))}
      <div ref={sentinelRef} />
      {hasNextPage && (
        <button onClick={() => fetchNextPage()}>Load more items</button>
      )}
      <div aria-live="polite" className="sr-only">
        {`Showing ${items.length} items`}
      </div>
    </div>
  )
}
```

## Rule Details

### Skeleton Loading

Content-shaped placeholders that match the final layout. Use skeleton for lists, cards, and text blocks.

> **Load**: `rules/interaction-skeleton-loading.md`

### Infinite Scroll

Accessible infinite scroll with IntersectionObserver, screen reader announcements, and "Load more" fallback.

> **Load**: `rules/interaction-infinite-scroll.md`

### Progressive Disclosure

Reveal complexity progressively: tooltip, accordion, wizard, contextual panel.

> **Load**: `rules/interaction-progressive-disclosure.md`

### Modal / Drawer / Inline

Choose the right overlay pattern: modal for confirmations, drawer for detail views, inline for simple toggles.

> **Load**: `rules/interaction-modal-drawer-inline.md`

### Drag & Drop

Drag-and-drop with mandatory keyboard alternatives using `@dnd-kit/core`.

> **Load**: `rules/interaction-drag-drop.md`

### Tabs Overflow

Scrollable tab bars with overflow menus for dynamic or numerous tabs.

> **Load**: `rules/interaction-tabs-overflow.md`

### Toast Notifications

Positioned, auto-dismissing notifications with ARIA roles and stacking.

> **Load**: `rules/interaction-toast-notifications.md`

### Cognitive Load Thresholds

Miller's Law (max 7 items per group), Hick's Law (max 1 primary CTA), and Doherty Threshold (400ms feedback) with specific, countable limits.

> **Load**: `rules/interaction-cognitive-load-thresholds.md`

### Form UX

Fitts's Law touch targets (44px mobile), top-aligned labels, Poka-Yoke error prevention with blur-only validation, and smart defaults.

> **Load**: `rules/interaction-form-ux.md`

### Persuasion Ethics

13 dark pattern red flags to detect and reject, the Hook Model ethical test (aware, reversible, user-benefits), and EU DSA Art. 25 compliance.

> **Load**: `rules/interaction-persuasion-ethics.md`

## Key Principles

1. **Keyboard parity** — Every mouse interaction MUST have a keyboard equivalent. No drag-only, no hover-only.
2. **Skeleton over spinner** — Use content-shaped placeholders for data loading; reserve spinners for indeterminate actions.
3. **Native HTML first** — Prefer `<dialog>`, `<details>`, `role="feed"` over custom implementations.
4. **Progressive enhancement** — Features should work without JS where possible, then enhance with interaction.
5. **Announce state changes** — Use `aria-live` regions to announce dynamic content changes to screen readers.
6. **Respect scroll position** — Back navigation must restore scroll position; infinite scroll must not lose user's place.

## Anti-Patterns (FORBIDDEN)

- **Spinner for content loading** — Spinners give no spatial hint. Use skeletons matching the content shape.
- **Infinite scroll without Load More** — Screen readers and keyboard users cannot reach footer content. Always provide a button fallback.
- **Modal for browsable content** — Modals trap focus and block interaction. Use drawers or inline expansion for browsing.
- **Drag-only reorder** — Excludes keyboard and assistive tech users. Always provide arrow key + Enter alternatives.
- **Toast without ARIA role** — Toasts are invisible to screen readers. Use `role="status"` for success, `role="alert"` for errors.
- **Auto-dismiss error toasts** — Users need time to read errors. Never auto-dismiss error notifications.

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [references/loading-states-decision-tree.md](references/loading-states-decision-tree.md) | Decision tree for skeleton vs spinner vs progress bar |
| [references/interaction-pattern-catalog.md](references/interaction-pattern-catalog.md) | Catalog of 15+ interaction patterns with when-to-use guidance |
| [references/keyboard-interaction-matrix.md](references/keyboard-interaction-matrix.md) | Keyboard shortcuts matrix for all interactive patterns (WAI-ARIA APG) |

## Related Skills

- `ork:ui-components` — shadcn/ui component patterns and CVA variants
- `ork:animation-motion-design` — Motion library and View Transitions API
- `ork:accessibility` — WCAG compliance, ARIA patterns, screen reader support
- `ork:responsive-patterns` — Responsive layout and container query patterns
- `ork:performance` — Core Web Vitals and runtime performance optimization
