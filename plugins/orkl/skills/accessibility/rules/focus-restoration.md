---
title: "Focus: Focus Restoration"
category: focus
impact: HIGH
impactDescription: "Ensures focus returns to the correct element after closing overlays or submitting forms"
tags: focus, restoration, modal, form, error
---

# Focus Restoration (WCAG 2.4.3)

## Basic Focus Restore

Return focus to the trigger element when an overlay closes:

```tsx
function useRestoreFocus(isOpen: boolean) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [isOpen]);
}
```

## Reusable useFocusRestore Hook

```tsx
import { useEffect, useRef } from 'react';

export function useFocusRestore(shouldRestore: boolean) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;

    return () => {
      if (shouldRestore && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [shouldRestore]);
}

// Usage
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

## Focus First Error

After form validation failure, focus the first field with an error:

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

// Usage
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
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Focus Confirmation Message

After a successful action, focus a confirmation for screen readers:

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

## Restoration Strategies

| Strategy | When to Use | Implementation |
|----------|------------|----------------|
| Trigger element | Closing modals/menus | Store `document.activeElement` before open |
| First error | Form validation failure | Query `[name="firstErrorField"]` |
| Confirmation message | Successful submission | Focus `tabIndex={-1}` status element |
| Session storage | Page navigation | Save/restore via `data-focus-id` |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Not storing trigger ref before open | Capture `document.activeElement` immediately on open |
| Trigger element removed from DOM | Check element exists before calling `.focus()` |
| Not clearing ref after restore | Set `triggerRef.current = null` after focus |
| Forgetting `tabIndex={-1}` on non-interactive targets | Required for programmatic focus on divs |

**Incorrect — Not restoring focus after modal closes:**
```tsx
function Modal({ isOpen, onClose }) {
  return isOpen ? (
    <div role="dialog">
      <button onClick={onClose}>Close</button>
    </div>
  ) : null;
  // Focus doesn't return to trigger button
}
```

**Correct — Using useFocusRestore hook:**
```tsx
function Modal({ isOpen, onClose }) {
  useFocusRestore(isOpen);
  return isOpen ? (
    <div role="dialog">
      <button onClick={onClose}>Close</button>
    </div>
  ) : null;
}
```
