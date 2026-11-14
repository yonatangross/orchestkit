---
title: "Infinite Scroll with Accessibility"
impact: "CRITICAL"
impactDescription: "Infinite scroll without a11y traps keyboard users, hides footer content, and makes screen readers announce nothing when new items load"
tags: [infinite-scroll, accessibility, aria-live, intersection-observer, keyboard, pagination, load-more]
---

## Infinite Scroll with Accessibility

Infinite scroll MUST include screen reader announcements via `aria-live`, a visible "Load more" button fallback, scroll position preservation on back navigation, and prevention of keyboard traps.

**Incorrect:**
```tsx
// Infinite scroll with no accessibility — keyboard users are trapped,
// screen readers announce nothing, footer is unreachable
function ItemList({ items, loadMore }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore()
    })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <div>
      {items.map((item) => <div key={item.id}>{item.name}</div>)}
      <div ref={ref} />
    </div>
  )
}
```

**Correct:**
```tsx
// Accessible infinite scroll — aria-live, load-more button, role="feed"
function ItemList({ items, loadMore, hasMore, isFetching }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isFetching) loadMore()
      },
      { rootMargin: "200px" }
    )
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [loadMore, hasMore, isFetching])

  return (
    <>
      <div role="feed" aria-busy={isFetching} aria-label="Item list">
        {items.map((item, index) => (
          <article
            key={item.id}
            aria-posinset={index + 1}
            aria-setsize={hasMore ? -1 : items.length}
            tabIndex={0}
          >
            <ItemCard item={item} />
          </article>
        ))}
      </div>
      <div ref={sentinelRef} aria-hidden="true" />
      {hasMore && (
        <button
          onClick={() => loadMore()}
          disabled={isFetching}
          className="mx-auto mt-4 block"
        >
          {isFetching ? "Loading..." : "Load more items"}
        </button>
      )}
      <div aria-live="polite" className="sr-only">
        {isFetching
          ? "Loading more items"
          : `Showing ${items.length} items`}
      </div>
    </>
  )
}
```

### Scroll Position Restoration

```tsx
// Preserve scroll position on back navigation
useEffect(() => {
  const key = `scroll-${location.pathname}`
  const saved = sessionStorage.getItem(key)
  if (saved) window.scrollTo(0, parseInt(saved, 10))

  return () => {
    sessionStorage.setItem(key, String(window.scrollY))
  }
}, [location.pathname])
```

**Key rules:**
- Use `role="feed"` on the container with `aria-busy` during fetches
- Each item needs `aria-posinset` and `aria-setsize` (set `-1` when total unknown)
- Always provide a visible "Load more" button below the sentinel — never rely solely on auto-load
- Use `rootMargin: "200px"` on IntersectionObserver to pre-fetch before the user reaches the end
- Announce item count changes via `aria-live="polite"` — never `"assertive"`
- Preserve scroll position in `sessionStorage` for back navigation restoration

Reference: https://www.w3.org/WAI/ARIA/apg/patterns/feed/
