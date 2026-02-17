---
title: "Focus: Keyboard Navigation"
category: focus
impact: HIGH
impactDescription: "Ensures all interactive elements are keyboard accessible with proper tab order and roving tabindex patterns"
tags: keyboard, focus, tabindex, navigation, skip-links
---

# Keyboard Navigation (WCAG 2.1.1, 2.4.3, 2.4.7)

## Roving Tabindex

Only one item in a group has `tabIndex={0}`; the rest have `tabIndex={-1}`. Arrow keys move focus.

```tsx
function TabList({ tabs, onSelect }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<HTMLButtonElement[]>([]);

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    const keyMap: Record<string, number> = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0, End: tabs.length - 1,
    };
    if (e.key in keyMap) {
      e.preventDefault();
      setActiveIndex(keyMap[e.key]);
      tabRefs.current[keyMap[e.key]]?.focus();
    }
  };

  return (
    <div role="tablist">
      {tabs.map((tab, i) => (
        <button key={tab.id} ref={(el) => (tabRefs.current[i] = el!)}
          role="tab" tabIndex={i === activeIndex ? 0 : -1}
          aria-selected={i === activeIndex}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onClick={() => { setActiveIndex(i); onSelect(tab); }}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

## useRovingTabindex Hook

Reusable hook for toolbars, menus, and lists:

```tsx
type Orientation = 'horizontal' | 'vertical';

export function useRovingTabindex<T extends HTMLElement>(
  itemCount: number,
  orientation: Orientation = 'vertical'
) {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemsRef = useRef<Map<number, T>>(new Map());

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const keys = orientation === 'horizontal'
      ? { next: 'ArrowRight', prev: 'ArrowLeft' }
      : { next: 'ArrowDown', prev: 'ArrowUp' };

    let nextIndex: number | null = null;

    if (event.key === keys.next) {
      nextIndex = (activeIndex + 1) % itemCount;
    } else if (event.key === keys.prev) {
      nextIndex = (activeIndex - 1 + itemCount) % itemCount;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = itemCount - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      setActiveIndex(nextIndex);
      itemsRef.current.get(nextIndex)?.focus();
    }
  }, [activeIndex, itemCount, orientation]);

  const getItemProps = useCallback((index: number) => ({
    ref: (element: T | null) => {
      if (element) {
        itemsRef.current.set(index, element);
      } else {
        itemsRef.current.delete(index);
      }
    },
    tabIndex: index === activeIndex ? 0 : -1,
    onFocus: () => setActiveIndex(index),
  }), [activeIndex]);

  return { activeIndex, setActiveIndex, handleKeyDown, getItemProps };
}

// Usage: Toolbar
function Toolbar() {
  const { getItemProps, handleKeyDown } = useRovingTabindex<HTMLButtonElement>(
    3, 'horizontal'
  );

  return (
    <div role="toolbar" aria-label="Text formatting" onKeyDown={handleKeyDown}>
      <button {...getItemProps(0)} aria-label="Bold"><BoldIcon /></button>
      <button {...getItemProps(1)} aria-label="Italic"><ItalicIcon /></button>
      <button {...getItemProps(2)} aria-label="Underline"><UnderlineIcon /></button>
    </div>
  );
}
```

## Skip Links

Allow keyboard users to bypass repeated navigation:

```tsx
export function SkipLinks() {
  return (
    <nav aria-label="Skip links">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <a href="#navigation" className="skip-link">
        Skip to navigation
      </a>
    </nav>
  );
}

// Layout usage
export function Layout({ children }) {
  return (
    <>
      <SkipLinks />
      <nav id="navigation" aria-label="Main navigation">
        {/* navigation */}
      </nav>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  z-index: 100;
}
.skip-link:focus {
  top: 0;
}
```

## Focus Within Detection

```tsx
export function useFocusWithin<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isFocusWithin, setIsFocusWithin] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleFocusIn = () => setIsFocusWithin(true);
    const handleFocusOut = (e: FocusEvent) => {
      if (!element.contains(e.relatedTarget as Node)) {
        setIsFocusWithin(false);
      }
    };

    element.addEventListener('focusin', handleFocusIn);
    element.addEventListener('focusout', handleFocusOut);
    return () => {
      element.removeEventListener('focusin', handleFocusIn);
      element.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return { ref, isFocusWithin };
}
```

## Focus Indicator Styles

```css
/* Use :focus-visible (not :focus) for keyboard-only indicators */
:focus-visible {
  outline: 3px solid #0052cc;
  outline-offset: 2px;
}

/* Ensure scroll margin for sticky headers */
:focus {
  scroll-margin-top: var(--header-height, 64px);
}
```

## Anti-Patterns

```tsx
// NEVER use positive tabindex - breaks natural tab order
<button tabIndex={5}>Bad</button>

// NEVER remove focus outline without replacement (WCAG 2.4.7)
button:focus { outline: none; }

// NEVER auto-focus without user expectation
useEffect(() => inputRef.current?.focus(), []);

// NEVER hide skip links permanently - must be visible on focus
.skip-link { display: none; }
```

**Incorrect — Removing focus outline globally:**
```css
*:focus {
  outline: none;
}
/* Violates WCAG 2.4.7, keyboard users can't see focus */
```

**Correct — Using focus-visible for keyboard-only indicators:**
```css
:focus-visible {
  outline: 3px solid #0052cc;
  outline-offset: 2px;
}
```
