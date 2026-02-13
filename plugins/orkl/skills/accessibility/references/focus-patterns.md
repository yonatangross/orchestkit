# Focus Management Patterns

Detailed implementation guide for keyboard navigation and focus management in React applications.

## Focus Trap Algorithms

### Basic Focus Trap

A focus trap restricts keyboard navigation to a specific container (modal, dialog, drawer).

**Algorithm:**

1. Find all focusable elements within the container
2. On Tab key, move focus to next focusable element
3. On Shift+Tab, move focus to previous focusable element
4. Wrap around at boundaries (first ↔ last)
5. Prevent focus from escaping the container

**Focusable Element Selector:**

```typescript
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');
```

**Implementation:**

```typescript
function trapFocus(container: HTMLElement, event: KeyboardEvent) {
  const focusableElements = container.querySelectorAll(FOCUSABLE_SELECTOR);
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  if (event.key !== 'Tab') return;

  if (event.shiftKey) {
    // Shift + Tab
    if (document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    }
  } else {
    // Tab
    if (document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }
}
```

### Return Focus on Close

When a modal closes, return focus to the element that triggered it.

```typescript
function useFocusTrap(isOpen: boolean) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Store the currently focused element
      triggerRef.current = document.activeElement as HTMLElement;
    } else if (triggerRef.current) {
      // Return focus when modal closes
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [isOpen]);

  return triggerRef;
}
```

---

## Roving Tabindex Patterns

Roving tabindex allows arrow key navigation within a group (toolbar, menu, listbox).

### Rules

1. Only one element in the group has `tabindex="0"` (the active item)
2. All other elements have `tabindex="-1"` (reachable via script, not Tab)
3. Arrow keys move focus and update the active item
4. Tab moves out of the group

### Implementation

```typescript
function useRovingTabindex<T extends HTMLElement>(
  items: T[],
  orientation: 'horizontal' | 'vertical' = 'vertical'
) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const keys = orientation === 'horizontal'
      ? { next: 'ArrowRight', prev: 'ArrowLeft' }
      : { next: 'ArrowDown', prev: 'ArrowUp' };

    if (event.key === keys.next) {
      event.preventDefault();
      const nextIndex = (activeIndex + 1) % items.length;
      setActiveIndex(nextIndex);
      items[nextIndex]?.focus();
    } else if (event.key === keys.prev) {
      event.preventDefault();
      const prevIndex = (activeIndex - 1 + items.length) % items.length;
      setActiveIndex(prevIndex);
      items[prevIndex]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      const lastIndex = items.length - 1;
      setActiveIndex(lastIndex);
      items[lastIndex]?.focus();
    }
  };

  return {
    activeIndex,
    setActiveIndex,
    handleKeyDown,
    getItemProps: (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      onFocus: () => setActiveIndex(index),
    }),
  };
}
```

### Example: Toolbar

```tsx
function Toolbar() {
  const buttons = useRef<HTMLButtonElement[]>([]);
  const { getItemProps, handleKeyDown } = useRovingTabindex(buttons.current, 'horizontal');

  return (
    <div role="toolbar" onKeyDown={handleKeyDown}>
      <button ref={el => buttons.current[0] = el!} {...getItemProps(0)}>
        Bold
      </button>
      <button ref={el => buttons.current[1] = el!} {...getItemProps(1)}>
        Italic
      </button>
      <button ref={el => buttons.current[2] = el!} {...getItemProps(2)}>
        Underline
      </button>
    </div>
  );
}
```

---

## Focus Restoration Strategies

### Strategy 1: Save/Restore on Navigation

```typescript
function useFocusRestore() {
  useEffect(() => {
    const savedFocus = sessionStorage.getItem('focusedElement');
    if (savedFocus) {
      const element = document.querySelector(`[data-focus-id="${savedFocus}"]`) as HTMLElement;
      element?.focus();
      sessionStorage.removeItem('focusedElement');
    }
  }, []);

  const saveFocus = (id: string) => {
    sessionStorage.setItem('focusedElement', id);
  };

  return { saveFocus };
}
```

### Strategy 2: Focus First Error

After form submission, focus the first validation error.

```typescript
function focusFirstError(errors: Record<string, string>) {
  const firstErrorField = Object.keys(errors)[0];
  if (firstErrorField) {
    const element = document.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
    element?.focus();
  }
}
```

### Strategy 3: Focus Confirmation Message

After a successful action, focus a confirmation message for screen readers.

```tsx
function FormWithConfirmation() {
  const [submitted, setSubmitted] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async () => {
    await submitForm();
    setSubmitted(true);
    confirmationRef.current?.focus();
  };

  return (
    <>
      <form onSubmit={handleSubmit}>{/* fields */}</form>
      {submitted && (
        <div
          ref={confirmationRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
        >
          Form submitted successfully!
        </div>
      )}
    </>
  );
}
```

---

## Skip Links Implementation

Skip links allow keyboard users to bypass repetitive navigation and jump to main content.

### Basic Skip Link

```tsx
function SkipLink() {
  return (
    <a
      href="#main-content"
      className="skip-link"
      style={{
        position: 'absolute',
        left: '-9999px',
        zIndex: 999,
      }}
      onFocus={(e) => {
        e.currentTarget.style.left = '0';
      }}
      onBlur={(e) => {
        e.currentTarget.style.left = '-9999px';
      }}
    >
      Skip to main content
    </a>
  );
}
```

### CSS Approach (Preferred)

```css
.skip-link {
  position: absolute;
  left: -9999px;
  z-index: 999;
  padding: 1rem;
  background: var(--color-primary);
  color: white;
}

.skip-link:focus {
  left: 0;
  top: 0;
}
```

### Multiple Skip Links

```tsx
function SkipLinks() {
  return (
    <nav aria-label="Skip links">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <a href="#navigation" className="skip-link">
        Skip to navigation
      </a>
      <a href="#footer" className="skip-link">
        Skip to footer
      </a>
    </nav>
  );
}
```

**Usage:**

```tsx
function Layout({ children }) {
  return (
    <>
      <SkipLinks />
      <nav id="navigation">{/* nav */}</nav>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer id="footer">{/* footer */}</footer>
    </>
  );
}
```

**Important:** Add `tabIndex={-1}` to target elements so they receive focus programmatically.

---

## Advanced Patterns

### Focus Within Detection

```typescript
function useFocusWithin<T extends HTMLElement>() {
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

### Escape Key to Close

```typescript
function useEscapeKey(onEscape: () => void, isActive: boolean) {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onEscape, isActive]);
}
```

---

## Testing Focus Management

### Manual Testing Checklist

1. Navigate entire UI with keyboard only (no mouse)
2. Verify all interactive elements are reachable
3. Check that focus indicator is visible
4. Test Tab, Shift+Tab, Arrow keys, Escape, Enter
5. Verify focus doesn't get trapped unexpectedly
6. Check that focus returns after closing dialogs

### Automated Testing with Playwright

```typescript
test('modal traps focus', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Modal' }).click();

  // First focusable element
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();

  // Last focusable element
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Submit' })).toBeFocused();

  // Wrap around
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();
});
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Removing focus outline globally | Use `:focus-visible` to show only for keyboard |
| Focus trap without escape hatch | Always allow Escape key to close |
| Not returning focus after modal close | Store trigger element and refocus it |
| Setting `tabindex="0"` on all items in roving group | Only the active item should be `tabindex="0"` |
| Skip link always visible | Only show on focus (screen reader users need it) |

---

**Last Updated:** 2026-01-16
