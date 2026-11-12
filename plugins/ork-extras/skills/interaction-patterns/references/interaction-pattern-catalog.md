---
title: "Interaction Pattern Catalog"
version: 1.0.0
---

# Interaction Pattern Catalog

A catalog of UI interaction patterns with when-to-use guidance. Organized by interaction type.

## Loading & Waiting

| Pattern | When to Use | Key Element | a11y |
|---------|-------------|-------------|------|
| Skeleton screen | Content loading with known layout | `animate-pulse` divs matching content shape | `aria-busy="true"` |
| Inline spinner | Button/form submission | Spinner replacing button text | `aria-busy`, disable button |
| Progress bar | Measurable operations (upload, export) | `<progress>` element | `aria-valuenow`, `aria-valuemax` |
| Optimistic update | Low-risk mutations (like, bookmark) | Immediate UI change, rollback on error | Announce rollback |

## Scrolling & Pagination

| Pattern | When to Use | Key Element | a11y |
|---------|-------------|-------------|------|
| Infinite scroll | Social feeds, image galleries | IntersectionObserver + sentinel | `role="feed"`, `aria-live` |
| Load more button | When footer must be reachable | Explicit button below content | Standard button a11y |
| Virtual scroll | 1000+ items in a list | `@tanstack/react-virtual` | `aria-rowcount`, `aria-rowindex` |
| Cursor pagination | API-driven lists | Cursor token, no page numbers | Announce page changes |

## Disclosure & Expansion

| Pattern | When to Use | Key Element | a11y |
|---------|-------------|-------------|------|
| Tooltip | Short helper text on hover/focus | `title` or custom tooltip | `role="tooltip"`, `aria-describedby` |
| Accordion | FAQ, settings sections | `<details>` / `<summary>` | Built-in with native HTML |
| Expandable row | Table row details | Inline expansion below row | `aria-expanded` on trigger |
| Collapsible section | Dashboard sections | Toggle header | `aria-expanded`, `aria-controls` |

## Overlays

| Pattern | When to Use | Key Element | a11y |
|---------|-------------|-------------|------|
| Modal dialog | Confirmations, critical actions | `<dialog>` element | Focus trap, `aria-modal` |
| Drawer / Side panel | Detail views, forms, settings | Slide-in panel | `role="complementary"` |
| Popover | Context menus, dropdowns | Popover API or floating-ui | `aria-haspopup`, focus management |
| Lightbox | Image/video preview | Full-screen overlay | Focus trap, Escape to close |
| Command palette | Power user actions, search | `Cmd+K` triggered overlay | `role="combobox"`, `aria-autocomplete` |

## Direct Manipulation

| Pattern | When to Use | Key Element | a11y |
|---------|-------------|-------------|------|
| Drag and drop | Reorder lists, kanban boards | `@dnd-kit/core` | Keyboard arrows + Enter |
| Inline edit | Quick text/value editing | Click-to-edit, Enter to save | `aria-label="Edit"` on trigger |
| Resize handles | Resizable panels, columns | Drag handle on edge | Keyboard resize with Shift+Arrow |
| Swipe actions | Mobile list item actions | Touch gesture + button fallback | Visible button alternative |

## Navigation

| Pattern | When to Use | Key Element | a11y |
|---------|-------------|-------------|------|
| Tabs | 2-6 related views | `role="tablist"` | Arrow key navigation |
| Scrollable tabs | 7+ tabs | Scroll arrows + overflow menu | Roving tabindex |
| Breadcrumbs | Deep hierarchies | `<nav aria-label="Breadcrumb">` | `aria-current="page"` |
| Stepper / Wizard | Multi-step processes | Step indicators + back/next | `aria-current="step"` |

## Feedback

| Pattern | When to Use | Key Element | a11y |
|---------|-------------|-------------|------|
| Toast notification | Success/error feedback | Auto-dismiss (not errors) | `role="status"` / `role="alert"` |
| Inline validation | Form field errors | Error below input | `aria-invalid`, `aria-describedby` |
| Empty state | No content to display | Illustration + CTA | Descriptive text |
| Confirmation | Destructive actions | Dialog with explicit action name | Focus on cancel button |

## Selection Guidelines

1. **Prefer native HTML** — `<dialog>`, `<details>`, `<progress>` over custom implementations
2. **Match complexity to task** — Tooltip for a hint, modal for a critical decision
3. **Mobile-first** — Ensure touch targets are 44x44px minimum, swipe actions have button fallbacks
4. **Keyboard always** — Every pattern must be operable via keyboard alone
5. **Announce changes** — Dynamic content changes need `aria-live` announcements
