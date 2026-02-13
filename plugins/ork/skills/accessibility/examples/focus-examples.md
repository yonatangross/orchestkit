# Focus Management Examples

Complete, production-ready code examples for focus management patterns.

## Example 1: Focus Trap Hook

A reusable hook for modal/dialog focus trapping.

```tsx
import { useEffect, useRef, useCallback } from 'react';

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
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap<T extends HTMLElement>(isActive: boolean) {
  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store the element that triggered the modal
  useEffect(() => {
    if (isActive) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
      previousActiveElement.current = null;
    }
  }, [isActive]);

  // Trap focus within the container
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isActive || event.key !== 'Tab') return;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = Array.from(
      container.querySelectorAll(FOCUSABLE_SELECTOR)
    ) as HTMLElement[];

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift + Tab: wrap to last element
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: wrap to first element
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }, [isActive]);

  // Focus the first element when activated
  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = Array.from(
      container.querySelectorAll(FOCUSABLE_SELECTOR)
    ) as HTMLElement[];

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, [isActive]);

  // Attach event listener
  useEffect(() => {
    if (!isActive) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, handleKeyDown]);

  return containerRef;
}
```

**Usage:**

```tsx
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { AnimatePresence, motion } from 'motion/react';
import { modalBackdrop, modalContent } from '@/lib/animations';

function Modal({ isOpen, onClose, children }) {
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            {...modalBackdrop}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            {...modalContent}
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

---

## Example 2: Roving Tabindex Component

A toolbar with arrow key navigation.

```tsx
import { useRef, useState, useCallback } from 'react';

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

  return {
    activeIndex,
    setActiveIndex,
    handleKeyDown,
    getItemProps,
  };
}
```

**Usage: Toolbar**

```tsx
function Toolbar() {
  const { getItemProps, handleKeyDown } = useRovingTabindex<HTMLButtonElement>(
    3,
    'horizontal'
  );

  return (
    <div role="toolbar" aria-label="Text formatting" onKeyDown={handleKeyDown}>
      <button {...getItemProps(0)} aria-label="Bold">
        <BoldIcon />
      </button>
      <button {...getItemProps(1)} aria-label="Italic">
        <ItalicIcon />
      </button>
      <button {...getItemProps(2)} aria-label="Underline">
        <UnderlineIcon />
      </button>
    </div>
  );
}
```

**Usage: Vertical Menu**

```tsx
function Menu() {
  const items = ['Profile', 'Settings', 'Logout'];
  const { getItemProps, handleKeyDown } = useRovingTabindex<HTMLButtonElement>(
    items.length,
    'vertical'
  );

  return (
    <div role="menu" onKeyDown={handleKeyDown}>
      {items.map((item, index) => (
        <button
          key={item}
          role="menuitem"
          {...getItemProps(index)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
```

---

## Example 3: Focus Restore Utility

Utility for restoring focus after navigation or modal close.

```tsx
import { useEffect, useRef } from 'react';

export function useFocusRestore(shouldRestore: boolean) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Store current focus when component mounts
    previousFocusRef.current = document.activeElement as HTMLElement;

    return () => {
      // Restore focus when component unmounts (if flag is true)
      if (shouldRestore && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [shouldRestore]);
}
```

**Usage: Modal with Focus Restore**

```tsx
function ConfirmationModal({ isOpen, onClose }) {
  useFocusRestore(isOpen);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2>Are you sure?</h2>
      <button onClick={onClose}>Cancel</button>
      <button onClick={handleConfirm}>Confirm</button>
    </Modal>
  );
}
```

**Advanced: Focus First Error in Form**

```tsx
import { useEffect, useRef } from 'react';

export function useFocusFirstError(errors: Record<string, string>) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (Object.keys(errors).length === 0) return;

    const firstErrorField = Object.keys(errors)[0];
    const element = formRef.current?.querySelector(
      `[name="${firstErrorField}"]`
    ) as HTMLElement;

    element?.focus();
  }, [errors]);

  return formRef;
}
```

**Usage:**

```tsx
function MyForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useFocusFirstError(errors);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateForm();
    setErrors(validationErrors);
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <input name="email" type="email" aria-invalid={!!errors.email} />
      {errors.email && <span role="alert">{errors.email}</span>}

      <input name="password" type="password" aria-invalid={!!errors.password} />
      {errors.password && <span role="alert">{errors.password}</span>}

      <button type="submit">Submit</button>
    </form>
  );
}
```

---

## Example 4: Skip Link Component

Accessible skip links for keyboard navigation.

```tsx
import { motion } from 'motion/react';
import { fadeIn } from '@/lib/animations';

export function SkipLinks() {
  return (
    <nav aria-label="Skip links" className="sr-only focus-within:not-sr-only">
      <motion.a
        {...fadeIn}
        href="#main-content"
        className="skip-link"
      >
        Skip to main content
      </motion.a>
      <motion.a
        {...fadeIn}
        href="#navigation"
        className="skip-link"
      >
        Skip to navigation
      </motion.a>
    </nav>
  );
}
```

**CSS (Tailwind):**

```css
/* Add to global styles */
.skip-link {
  @apply fixed top-0 left-0 z-[9999] bg-primary text-white px-4 py-2 transform -translate-y-full;
  @apply focus:translate-y-0 transition-transform;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.focus-within\:not-sr-only:focus-within {
  position: static;
  width: auto;
  height: auto;
  padding: 0;
  margin: 0;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

**Usage in Layout:**

```tsx
import { SkipLinks } from '@/components/SkipLinks';

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

---

## Example 5: Escape Key to Close

Utility hook for closing modals/menus with Escape key.

```tsx
import { useEffect } from 'react';

export function useEscapeKey(onEscape: () => void, isActive: boolean = true) {
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

**Usage:**

```tsx
function Drawer({ isOpen, onClose }) {
  useEscapeKey(onClose, isOpen);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div {...slideInRight}>
          <h2>Drawer Content</h2>
          <button onClick={onClose}>Close</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

## Example 6: Focus Within Detection

Detect when focus is inside a component (for styling/logic).

```tsx
import { useEffect, useRef, useState } from 'react';

export function useFocusWithin<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isFocusWithin, setIsFocusWithin] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleFocusIn = () => setIsFocusWithin(true);
    const handleFocusOut = (e: FocusEvent) => {
      // Check if focus moved outside the element
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

**Usage: Highlight Card on Focus Within**

```tsx
function Card({ title, children }) {
  const { ref, isFocusWithin } = useFocusWithin<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(
        'p-4 rounded-lg border',
        isFocusWithin ? 'border-primary ring-2 ring-primary/20' : 'border-border'
      )}
    >
      <h3>{title}</h3>
      {children}
    </div>
  );
}
```

---

## Testing Example: Playwright

Test focus trap in a modal:

```typescript
import { test, expect } from '@playwright/test';

test('modal traps focus correctly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Modal' }).click();

  // Modal should be open
  await expect(page.getByRole('dialog')).toBeVisible();

  // First element should be focused
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();

  // Tab to next element
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Email')).toBeFocused();

  // Tab to next element
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Submit' })).toBeFocused();

  // Tab should wrap to first element
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();

  // Shift+Tab should wrap to last element
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Submit' })).toBeFocused();

  // Escape should close modal and restore focus
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Modal' })).toBeFocused();
});
```

---

**Last Updated:** 2026-01-16
