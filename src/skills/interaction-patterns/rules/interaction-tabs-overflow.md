---
title: "Tabs Overflow Handling"
impact: "MEDIUM"
impactDescription: "Tab bars with 7+ items overflow on small screens, hiding tabs without scroll indicators or an overflow menu"
tags: [tabs, overflow, scroll, navigation, responsive, tab-panel, aria-tablist]
---

## Tabs Overflow Handling

When tab bars contain 7+ items or dynamic tabs, use scrollable tabs with arrow indicators or an overflow dropdown menu. Always use `role="tablist"` with proper ARIA.

**Incorrect:**
```tsx
// Horizontal overflow with no indicators — hidden tabs are undiscoverable
function TabBar({ tabs, activeTab, onSelect }: Props) {
  return (
    <div className="flex overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={activeTab === tab.id ? "border-b-2 border-primary" : ""}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
```

**Correct:**
```tsx
// Scrollable tabs with arrow buttons and overflow menu
function TabBar({ tabs, activeTab, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(false)

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowLeft(el.scrollLeft > 0)
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    updateArrows()
    const el = scrollRef.current
    el?.addEventListener("scroll", updateArrows)
    return () => el?.removeEventListener("scroll", updateArrows)
  }, [updateArrows])

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -200 : 200,
      behavior: "smooth",
    })
  }

  return (
    <div className="relative flex items-center">
      {showLeft && (
        <button onClick={() => scroll("left")} aria-label="Scroll tabs left"
          className="absolute left-0 z-10 bg-gradient-to-r from-white">
          &larr;
        </button>
      )}
      <div
        ref={scrollRef}
        role="tablist"
        className="flex overflow-x-auto gap-1 px-8 scrollbar-none"
        /* Hide scrollbar: .scrollbar-none { scrollbar-width: none; -webkit-overflow-scrolling: touch; } */
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            className="whitespace-nowrap px-4 py-2"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {showRight && (
        <button onClick={() => scroll("right")} aria-label="Scroll tabs right"
          className="absolute right-0 z-10 bg-gradient-to-l from-white">
          &rarr;
        </button>
      )}
    </div>
  )
}
```

### Keyboard Navigation

```tsx
// Arrow key navigation within tablist (WAI-ARIA Tabs pattern)
function handleTabKeyDown(e: React.KeyboardEvent, tabs: Tab[], activeTab: string, onSelect: (id: string) => void) {
  const currentIndex = tabs.findIndex((t) => t.id === activeTab)
  let nextIndex = currentIndex

  if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length
  if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
  if (e.key === "Home") nextIndex = 0
  if (e.key === "End") nextIndex = tabs.length - 1

  if (nextIndex !== currentIndex) {
    e.preventDefault()
    onSelect(tabs[nextIndex].id)
  }
}
```

**Key rules:**
- Show scroll arrows only when content overflows — check `scrollWidth > clientWidth`
- Use `role="tablist"`, `role="tab"`, and `role="tabpanel"` with `aria-selected` and `aria-controls`
- Only the active tab has `tabIndex={0}`; all others get `tabIndex={-1}` (roving tabindex)
- Arrow keys navigate between tabs; Tab key moves focus to the panel content
- For 10+ tabs, add an overflow dropdown menu ("More...") showing hidden tabs
- Hide scrollbar with CSS `scrollbar-width: none` (or Tailwind plugin `scrollbar-none`) but keep scroll arrows visible

Reference: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
