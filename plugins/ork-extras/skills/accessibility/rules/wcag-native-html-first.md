---
title: Prefer native HTML elements over custom ARIA widgets for built-in accessibility
category: modern-web
impact: CRITICAL
impactDescription: "Native HTML elements provide keyboard, focus, and screen reader support for free — custom ARIA recreates what the browser already does, introducing bugs and maintenance burden"
tags: wcag, native-html, dialog, details, semantic, accessibility
---

# Native HTML First (2026 Best Practice)

## Principle

Use the platform. Native HTML elements (`<dialog>`, `<details>`, `<select>`, `<button>`) ship with keyboard handling, focus management, and screen reader announcements built in. Custom ARIA widgets should only be used when **no native equivalent exists**.

## Native Element Replacements

| Instead of... | Use native | Why |
|--------------|-----------|-----|
| Custom modal + focus trap JS | `<dialog>` + `showModal()` | Built-in focus trap, Escape close, inert backdrop |
| Custom accordion + ARIA | `<details>` / `<summary>` | Built-in expand/collapse, keyboard, screen reader |
| Custom dropdown + listbox ARIA | `<select>` | Built-in keyboard nav, mobile-optimized |
| Custom toggle + aria-checked | `<input type="checkbox">` | Built-in state, label association, form submission |
| `<div onClick>` | `<button>` | Built-in focus, Enter/Space, role announcement |

## Dialog — Use `<dialog>` + `showModal()`

**Incorrect — Custom modal with manual focus trap:**
```tsx
function Modal({ isOpen, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (isOpen) ref.current?.focus();
    // manual focus trap, Escape handler, inert siblings...
  }, [isOpen]);

  return isOpen ? (
    <div role="dialog" aria-modal="true" ref={ref} tabIndex={-1}>
      <div className="backdrop" onClick={onClose} />
      {children}
    </div>
  ) : null;
}
```

**Correct — Native `<dialog>` with built-in focus management:**
```tsx
function Modal({ children }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <dialog ref={dialogRef} onClose={() => dialogRef.current?.close()}>
      {children}
      <button onClick={() => dialogRef.current?.close()}>Close</button>
    </dialog>
  );
}

// Open with showModal() for built-in focus trap + backdrop + Escape
dialogRef.current?.showModal();
```

## Accordion — Use `<details>` / `<summary>`

**Incorrect — Custom accordion with ARIA:**
```tsx
<div role="region">
  <button aria-expanded={open} aria-controls="panel-1"
    onClick={() => setOpen(!open)}>
    Section Title
  </button>
  <div id="panel-1" role="region" hidden={!open}>{content}</div>
</div>
```

**Correct — Native `<details>` with CSS styling:**
```tsx
<details>
  <summary>Section Title</summary>
  <div className="panel">{content}</div>
</details>
```

```css
details summary { cursor: pointer; padding: 0.75rem; font-weight: 600; }
details[open] summary { border-bottom: 1px solid var(--border); }
details summary::marker { content: ''; } /* Note: ::marker on <summary> is supported in Chrome 89+, Firefox 68+, Safari 15.4+ */
details summary::after { content: '\25B6'; transition: transform 0.2s; }
details[open] summary::after { transform: rotate(90deg); }
```

## When Custom ARIA Is Justified

Use custom ARIA only when native elements cannot meet the requirement:

| Use case | Why native fails | ARIA approach |
|----------|-----------------|---------------|
| Combobox with async search | `<datalist>` lacks async, filtering control | `role="combobox"` + `useComboBox` |
| Tab panel widget | No native tab element | `role="tablist"` + `role="tab"` |
| Tree view | No native tree element | `role="tree"` + `role="treeitem"` |
| Menu with submenus | `<menu>` has limited support | `role="menu"` + `role="menuitem"` |

## Audit Checklist

- [ ] Every `role="dialog"` — can it be `<dialog>`?
- [ ] Every custom accordion — can it be `<details>`?
- [ ] Every `<div onClick>` — should it be `<button>` or `<a>`?
- [ ] Every custom select — does `<select>` + CSS suffice?
- [ ] ARIA attributes are only used where no native equivalent exists
