---
title: "Focus: Focus Trap"
category: focus
impact: HIGH
impactDescription: "Ensures keyboard focus is trapped within modal dialogs and can be escaped with the Escape key"
tags: focus, trap, modal, keyboard, escape
---

# Focus Trap (WCAG 2.1.1, 2.1.2)

## React Aria FocusScope

The simplest and most reliable approach for modals and dialogs:

```tsx
import { FocusScope } from 'react-aria';

function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;
  return (
    <div role="dialog" aria-modal="true">
      <FocusScope contain restoreFocus autoFocus>
        <div className="modal-content">
          {children}
          <button onClick={onClose}>Close</button>
        </div>
      </FocusScope>
    </div>
  );
}
```

**FocusScope Props:**
- `contain` - Trap focus within children
- `restoreFocus` - Restore focus to trigger on unmount
- `autoFocus` - Auto-focus first focusable element

## Custom useFocusTrap Hook

When you need more control than FocusScope provides:

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

  // Store trigger element
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
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
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

## Escape Key Handler

Every focus trap must have an Escape key handler:

```tsx
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

## Trap vs Contain

| Pattern | Use Case | Behavior |
|---------|----------|----------|
| `FocusTrap` (strict) | Modals, dialogs | Focus cannot escape at all |
| `FocusScope` (soft) | Popovers, dropdowns | Focus contained but can escape |

## Anti-Patterns

```tsx
// NEVER trap focus without Escape key handler
<FocusTrap><div>No way out!</div></FocusTrap>

// NEVER handle focus manually for modals
useEffect(() => { modalRef.current?.focus(); }, []);  // Incomplete!

// ALWAYS use FocusScope for modals/overlays
<FocusScope contain restoreFocus autoFocus>
  <div role="dialog">...</div>
</FocusScope>
```

**Incorrect — Focus trap without escape mechanism:**
```tsx
function Modal({ isOpen, children }) {
  const ref = useFocusTrap(isOpen);
  return isOpen ? (
    <div ref={ref} role="dialog">{children}</div>
  ) : null;
  // No Escape key handler, user is trapped
}
```

**Correct — FocusScope with escape via Escape key:**
```tsx
function Modal({ isOpen, onClose, children }) {
  useEscapeKey(onClose, isOpen);
  return isOpen ? (
    <FocusScope contain restoreFocus autoFocus>
      <div role="dialog">{children}</div>
    </FocusScope>
  ) : null;
}
```
