# TanStack Virtual Patterns

Efficient virtualization for large lists and grids.

## When to Virtualize

| Item Count | Recommendation |
|------------|----------------|
| < 50 | Not needed |
| 50-100 | Consider if items are complex |
| 100-500 | Recommended |
| 500+ | Required |

## Basic List Virtualization

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualList({ items }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Estimated row height in px
    overscan: 5, // Render 5 extra items for smooth scrolling
  })

  return (
    <div
      ref={parentRef}
      style={{ height: '400px', overflow: 'auto' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {items[virtualItem.index].name}
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Variable Height Rows

For rows with different heights:

```tsx
function VariableHeightList({ items }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      // Return estimated height based on content
      return items[index].type === 'header' ? 80 : 50
    },
    overscan: 5,
  })

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement} // Enable dynamic measurement
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <ItemComponent item={items[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Dynamic Measurement

When content determines height:

```tsx
const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50, // Initial estimate
  // measureElement enables dynamic re-measurement
})

// Add ref to each item
<div
  key={virtualItem.key}
  data-index={virtualItem.index}
  ref={virtualizer.measureElement}
>
  {/* Content with unknown height */}
</div>
```

## Horizontal Virtualization

```tsx
const columnVirtualizer = useVirtualizer({
  horizontal: true,
  count: columns.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 150, // Column width
  overscan: 3,
})
```

## Grid Virtualization

Combine row and column virtualizers:

```tsx
function VirtualGrid({ rows, columns }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  })

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 3,
  })

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: `${columnVirtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <React.Fragment key={virtualRow.key}>
            {columnVirtualizer.getVirtualItems().map((virtualColumn) => (
              <div
                key={virtualColumn.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${virtualColumn.size}px`,
                  height: `${virtualRow.size}px`,
                  transform: `translateX(${virtualColumn.start}px) translateY(${virtualRow.start}px)`,
                }}
              >
                {/* Cell content */}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
```

## Scroll to Index

```tsx
const virtualizer = useVirtualizer({/* ... */})

// Scroll to specific item
virtualizer.scrollToIndex(50, { align: 'start' })

// Align options: 'start' | 'center' | 'end' | 'auto'
```

## Window Scroller

For document-level scrolling:

```tsx
import { useWindowVirtualizer } from '@tanstack/react-virtual'

function WindowList({ items }) {
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 50,
    overscan: 5,
  })

  return (
    <div
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        position: 'relative',
      }}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => (
        <div
          key={virtualItem.key}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualItem.start}px)`,
          }}
        >
          {items[virtualItem.index].name}
        </div>
      ))}
    </div>
  )
}
```

## Performance Tips

1. **Use stable keys**: Avoid array index as key
2. **Memoize items**: If item rendering is expensive
3. **Adjust overscan**: More overscan = smoother scroll, more DOM nodes
4. **Measure sparingly**: Only use `measureElement` when needed
5. **Debounce scroll**: For very heavy computations
