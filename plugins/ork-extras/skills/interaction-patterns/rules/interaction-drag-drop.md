---
title: "Drag & Drop with Keyboard Alternatives"
impact: "CRITICAL"
impactDescription: "Drag-only interfaces exclude keyboard users, screen reader users, and users with motor impairments — affecting 15-20% of users"
tags: [drag-drop, dnd-kit, keyboard, reorder, accessibility, aria-live, sortable]
---

## Drag & Drop with Keyboard Alternatives

Drag-and-drop MUST have a keyboard alternative: arrow keys to navigate, Enter/Space to pick up and drop, Escape to cancel. Use `@dnd-kit/core` for React. Announce all state changes via `aria-live`.

**Incorrect:**
```tsx
// Drag-only — no keyboard support, no screen reader announcements
function SortableList({ items, onReorder }: Props) {
  return (
    <div>
      {items.map((item) => (
        <div
          key={item.id}
          draggable
          onDragStart={(e) => e.dataTransfer.setData("id", item.id)}
          onDrop={(e) => {
            const draggedId = e.dataTransfer.getData("id")
            onReorder(draggedId, item.id)
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          {item.name}
        </div>
      ))}
    </div>
  )
}
```

**Correct:**
```tsx
// @dnd-kit with keyboard support and screen reader announcements
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

function SortableItem({ item }: { item: Item }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-50 shadow-lg" : ""}
      {...attributes}
      {...listeners}
    >
      <span className="cursor-grab" aria-label={`Reorder ${item.name}`}>
        &#x2630;
      </span>
      {item.name}
    </div>
  )
}

function SortableList({ items, onReorder }: Props) {
  const [announcement, setAnnouncement] = useState("")
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      onReorder(active.id as string, over.id as string)
      setAnnouncement(`Moved item to position ${items.findIndex((i) => i.id === over.id) + 1}`)
    }
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableItem key={item.id} item={item} />
          ))}
        </SortableContext>
      </DndContext>
      <div aria-live="assertive" className="sr-only">
        {announcement}
      </div>
    </>
  )
}
```

**Key rules:**
- Always register `KeyboardSensor` alongside `PointerSensor` in `useSensors`
- Use `sortableKeyboardCoordinates` for arrow key navigation within sortable lists
- Announce drag start, position changes, and drop via `aria-live="assertive"`
- Provide visual feedback during drag: `opacity`, `shadow`, or `scale` on the dragged item
- Use `@dnd-kit/core` — not HTML5 drag API which has no keyboard support
- Escape must cancel the drag and return the item to its original position

References:
- https://docs.dndkit.com/
- https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/ (WAI-ARIA keyboard patterns)
