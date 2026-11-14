---
title: "Modal vs Drawer vs Inline"
impact: "HIGH"
impactDescription: "Using modals for browsable content traps user focus and blocks interaction with the page — drawers and inline expansion preserve context"
tags: [modal, drawer, dialog, inline, overlay, focus-trap, side-panel]
---

## Modal vs Drawer vs Inline

Choose the right overlay pattern: `<dialog>` modal for confirmations and critical actions, drawer (side panel) for detail views and forms, inline expansion for simple toggles and previews.

**Incorrect:**
```tsx
// Modal for browsing content — blocks page interaction, traps focus unnecessarily
function ProductList({ products }: Props) {
  const [selected, setSelected] = useState<Product | null>(null)

  return (
    <>
      {products.map((p) => (
        <button key={p.id} onClick={() => setSelected(p)}>{p.name}</button>
      ))}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50">
          <div className="bg-white p-6 max-w-lg mx-auto mt-20 rounded">
            <ProductDetail product={selected} />
            <button onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  )
}
```

**Correct:**
```tsx
// Drawer for detail views — preserves page context, slides in from side
function ProductList({ products }: Props) {
  const [selected, setSelected] = useState<Product | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Move focus into drawer on open
  useEffect(() => {
    if (selected) closeRef.current?.focus()
  }, [selected])

  return (
    <div className="flex">
      <div className="flex-1">
        {products.map((p) => (
          <button
            key={p.id}
            ref={selected?.id === p.id ? triggerRef : undefined}
            onClick={() => setSelected(p)}
          >
            {p.name}
          </button>
        ))}
      </div>
      {selected && (
        <aside
          role="complementary"
          aria-label="Product details"
          className="w-96 border-l p-6 overflow-y-auto"
        >
          <button
            ref={closeRef}
            onClick={() => { setSelected(null); triggerRef.current?.focus() }}
            aria-label="Close panel"
          >
            &times;
          </button>
          <ProductDetail product={selected} />
        </aside>
      )}
    </div>
  )
}
```

### Modal with Native `<dialog>`

```tsx
// Use native <dialog> for confirmations — built-in focus trap and Escape handling
function DeleteConfirmation({ onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="rounded-lg p-6 backdrop:bg-black/50"
    >
      <h2>Delete this item?</h2>
      <p>This action cannot be undone.</p>
      <div className="flex gap-3 mt-4">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm} className="bg-destructive text-white">
          Delete
        </button>
      </div>
    </dialog>
  )
}
```

### Decision Matrix

| Scenario | Pattern | Why |
|----------|---------|-----|
| Delete confirmation | Modal (`<dialog>`) | Critical action, needs focus lock |
| Item detail view | Drawer (side panel) | Preserves list context |
| Settings toggle | Inline expansion | Simple, no overlay needed |
| Multi-field form | Drawer | Space for inputs, closeable |
| Terms acceptance | Modal | Must acknowledge before proceeding |
| Image preview | Inline / lightbox | Quick glance, no form inputs |

**Key rules:**
- Use native `<dialog>` element for modals — built-in `showModal()`, focus trap, Escape to close
- Modal = critical actions only (delete, confirm, acknowledge). Never for browsing.
- Drawer = detail views, forms, settings panels. Preserves page context.
- Inline = simple toggles, previews, small expansions. No overlay, no focus trap.
- Always provide Escape key to close overlays and a visible close button
- Return focus to the trigger element when closing any overlay

Reference: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
