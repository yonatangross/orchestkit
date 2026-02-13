// Virtualized List Template with TanStack Virtual
// Copy and customize for your project

import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'

// Types
interface ListItem {
  id: string
  [key: string]: unknown
}

interface VirtualizedListProps<T extends ListItem> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  estimateSize?: number
  overscan?: number
  className?: string
  itemClassName?: string
  height?: number | string
}

// Basic Virtualized List
export function VirtualizedList<T extends ListItem>({
  items,
  renderItem,
  estimateSize = 50,
  overscan = 5,
  className,
  itemClassName,
  height = 400,
}: VirtualizedListProps<T>) {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  })

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      style={{ height }}
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
            key={items[virtualItem.index].id}
            className={itemClassName}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  )
}

// Dynamic Height List (measures actual content)
export function DynamicVirtualizedList<T extends ListItem>({
  items,
  renderItem,
  estimateSize = 50,
  overscan = 5,
  className,
  height = 400,
}: VirtualizedListProps<T>) {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  })

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      style={{ height }}
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
            key={items[virtualItem.index].id}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  )
}

// Usage Examples:
/*
import { VirtualizedList, DynamicVirtualizedList } from './virtualized-list'

// Basic usage
const items = Array.from({ length: 10000 }, (_, i) => ({
  id: `item-${i}`,
  name: `Item ${i}`,
}))

<VirtualizedList
  items={items}
  renderItem={(item) => (
    <div className="p-4 border-b">{item.name}</div>
  )}
  height={500}
  estimateSize={48}
/>

// Dynamic heights
<DynamicVirtualizedList
  items={posts}
  renderItem={(post) => (
    <div className="p-4 border-b">
      <h3>{post.title}</h3>
      <p>{post.content}</p>
    </div>
  )}
/>

// With custom styling
<VirtualizedList
  items={items}
  renderItem={(item, index) => (
    <div className={cn(
      'p-4 border-b',
      index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
    )}>
      {item.name}
    </div>
  )}
  className="border rounded-lg"
  height="calc(100vh - 200px)"
/>
*/
