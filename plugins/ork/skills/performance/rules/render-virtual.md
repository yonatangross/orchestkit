---
title: List Virtualization
impact: HIGH
impactDescription: "Virtualization renders only visible items, enabling smooth scrolling for lists with hundreds or thousands of items"
tags: virtual, tanstack, large-list, scroll, overscan, useVirtualizer
---

# List Virtualization

Use TanStack Virtual for efficient rendering of large lists.

## Virtualization Thresholds

| Item Count | Recommendation |
|------------|----------------|
| < 100 | Regular rendering usually fine |
| 100-500 | Consider virtualization |
| 500+ | Virtualization required |

## Basic Setup

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualList({ items }) {
  const parentRef = useRef(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  })

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {items[virtualRow.index].name}
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Dynamic Height

```tsx
const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
  overscan: 5,
  measureElement: (element) => element.getBoundingClientRect().height,
})
```

**Incorrect — Rendering 1000 items causes scroll jank:**
```tsx
function List({ items }) {
  return (
    <div style={{ height: '400px', overflow: 'auto' }}>
      {items.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

**Correct — Virtualization renders only visible items:**
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualList({ items }) {
  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {items[virtualRow.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Key Rules

1. **Virtualize** lists with 100+ items
2. **Set** `overscan: 5` for smooth scrolling
3. **Use** `estimateSize` close to actual average
4. **Use** `measureElement` for variable height items
5. **Position** items with `transform: translateY()` (avoids layout recalculation)
