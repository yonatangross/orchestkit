# WCAG Compliance Code Examples

Complete, production-ready examples of accessible patterns.

---

## 1. Accessible Form with Validation

Full form with labels, error handling, and live region announcements.

```tsx
import { useState } from 'react';
import { z } from 'zod';

const FormSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms',
  }),
});

type FormData = z.infer<typeof FormSchema>;

export function AccessibleForm() {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    agreeToTerms: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitStatus, setSubmitStatus] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = FormSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof FormData, string>> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof FormData;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      setSubmitStatus('Please correct the errors below');
      return;
    }

    setErrors({});
    setSubmitStatus('Form submitted successfully!');
    // Submit form...
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1>Create Account</h1>

      {/* Status message - announced by screen readers */}
      {submitStatus && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mb-4 p-3 rounded bg-blue-50 text-blue-900"
        >
          {submitStatus}
        </div>
      )}

      {/* Email field */}
      <div className="mb-4">
        <label htmlFor="email" className="block mb-1 font-medium">
          Email <span aria-label="required">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          autoComplete="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : 'email-hint'}
          className={`w-full px-3 py-2 border rounded ${
            errors.email ? 'border-red-600' : 'border-gray-300'
          }`}
        />
        <p id="email-hint" className="text-sm text-gray-600 mt-1">
          We'll never share your email
        </p>
        {errors.email && (
          <p id="email-error" role="alert" className="text-red-600 text-sm mt-1">
            {errors.email}
          </p>
        )}
      </div>

      {/* Password field */}
      <div className="mb-4">
        <label htmlFor="password" className="block mb-1 font-medium">
          Password <span aria-label="required">*</span>
        </label>
        <input
          type="password"
          id="password"
          name="password"
          autoComplete="new-password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          aria-required="true"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : 'password-hint'}
          className={`w-full px-3 py-2 border rounded ${
            errors.password ? 'border-red-600' : 'border-gray-300'
          }`}
        />
        <p id="password-hint" className="text-sm text-gray-600 mt-1">
          Must be at least 8 characters
        </p>
        {errors.password && (
          <p id="password-error" role="alert" className="text-red-600 text-sm mt-1">
            {errors.password}
          </p>
        )}
      </div>

      {/* Checkbox */}
      <div className="mb-4">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={formData.agreeToTerms}
            onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
            aria-required="true"
            aria-invalid={!!errors.agreeToTerms}
            aria-describedby={errors.agreeToTerms ? 'terms-error' : undefined}
            className="mt-1 w-5 h-5"
          />
          <span>
            I agree to the <a href="/terms" className="text-blue-600 underline">terms and conditions</a>
            <span aria-label="required"> *</span>
          </span>
        </label>
        {errors.agreeToTerms && (
          <p id="terms-error" role="alert" className="text-red-600 text-sm mt-1">
            {errors.agreeToTerms}
          </p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Create Account
      </button>
    </form>
  );
}
```

**Key accessibility features:**
- All inputs have associated labels with `htmlFor`
- Required fields marked with `aria-required="true"`
- Invalid fields marked with `aria-invalid="true"`
- Error messages use `role="alert"` for immediate announcement
- Error messages linked with `aria-describedby`
- Hint text linked with `aria-describedby`
- Status message uses `role="status"` with `aria-live="polite"`
- Visible focus indicators
- AutoComplete attributes for password managers

---

## 2. Accessible Modal Dialog

Modal with focus trap, Esc to close, and backdrop click handling.

```tsx
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { modalBackdrop, modalContent } from '@/lib/animations';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function AccessibleModal({ isOpen, onClose, title, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  // Store the element that opened the modal
  useEffect(() => {
    if (isOpen) {
      triggerElementRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  // Focus trap and Esc key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const modal = modalRef.current;
        if (!modal) return;

        const focusableElements = modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus first element when modal opens
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const firstFocusable = modalRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  }, [isOpen]);

  // Return focus to trigger element when modal closes
  useEffect(() => {
    if (!isOpen && triggerElementRef.current) {
      triggerElementRef.current.focus();
      triggerElementRef.current = null;
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            {...modalBackdrop}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              {...modalContent}
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            >
              {/* Title */}
              <h2 id="modal-title" className="text-xl font-semibold mb-4">
                {title}
              </h2>

              {/* Content */}
              <div className="mb-6">{children}</div>

              {/* Close button */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Close
                </button>
              </div>

              {/* Close icon button */}
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="absolute top-4 right-4 p-2 rounded hover:bg-gray-100 focus-visible:outline focus-visible:outline-2"
              >
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Key accessibility features:**
- `role="dialog"` and `aria-modal="true"`
- Title linked with `aria-labelledby`
- Focus trapped within modal
- Esc key closes modal
- Focus returns to trigger element on close
- Close button has `aria-label`
- Backdrop click closes modal
- First focusable element receives focus on open

---

## 3. Skip Navigation Link

Allow keyboard users to bypass repeated navigation.

```tsx
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="skip-link"
    >
      Skip to main content
    </a>
  );
}

// In your layout component:
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <header>
        <nav>
          {/* Navigation links */}
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
```

```css
/* styles/globals.css */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

---

## 4. Accessible Tab Component

Tabs with keyboard navigation (arrow keys, Home, End).

```tsx
import { useState, useRef, useEffect } from 'react';

interface TabProps {
  tabs: { id: string; label: string; content: React.ReactNode }[];
}

export function AccessibleTabs({ tabs }: TabProps) {
  const [activeTab, setActiveTab] = useState(0);
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let newIndex = index;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        newIndex = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    setActiveTab(newIndex);

    // Focus the new tab
    const newTab = tabListRef.current?.children[newIndex] as HTMLElement;
    newTab?.focus();
  };

  return (
    <div>
      {/* Tab list */}
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Content sections"
        className="flex border-b border-gray-300"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === index}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === index ? 0 : -1}
            onClick={() => setActiveTab(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`px-4 py-2 font-medium focus-visible:outline focus-visible:outline-2 ${
              activeTab === index
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeTab !== index}
          className="p-4"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
```

**Key accessibility features:**
- `role="tablist"`, `role="tab"`, `role="tabpanel"`
- `aria-selected` indicates active tab
- `aria-controls` links tab to panel
- Only active tab is focusable (`tabIndex={0}`)
- Arrow keys navigate between tabs
- Home/End keys jump to first/last tab
- Panels hidden with `hidden` attribute (not CSS display:none)

---

## 5. Focus Management in Complex Widgets

Custom dropdown with roving tabindex.

```tsx
import { useState, useRef, useEffect } from 'react';

interface DropdownProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export function AccessibleDropdown({ label, options, value, onChange }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex((prev) => (prev + 1) % options.length);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex((prev) => (prev - 1 + options.length) % options.length);
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen) {
          onChange(options[focusedIndex]);
          setIsOpen(false);
          buttonRef.current?.focus();
        } else {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
    }
  };

  // Focus first option when opening
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(options.indexOf(value));
    }
  }, [isOpen, value, options]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby="dropdown-label"
        className="w-full px-4 py-2 text-left bg-white border border-gray-300 rounded focus-visible:outline focus-visible:outline-2"
      >
        <span id="dropdown-label" className="sr-only">{label}</span>
        {value}
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          aria-labelledby="dropdown-label"
          onKeyDown={handleKeyDown}
          className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-auto"
        >
          {options.map((option, index) => (
            <li
              key={option}
              role="option"
              aria-selected={option === value}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
                buttonRef.current?.focus();
              }}
              className={`px-4 py-2 cursor-pointer ${
                index === focusedIndex ? 'bg-blue-100' : ''
              } ${option === value ? 'bg-blue-50 font-semibold' : ''}`}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Key accessibility features:**
- `role="listbox"` and `role="option"`
- `aria-haspopup="listbox"` on trigger
- `aria-expanded` indicates open/closed state
- `aria-selected` on current option
- Arrow keys navigate options
- Enter/Space selects option
- Esc closes dropdown and returns focus
- Focus returns to trigger on close

---

## 6. Live Region for Dynamic Updates

Announce changes to screen reader users without interrupting.

```tsx
import { useState, useEffect } from 'react';

export function ShoppingCart() {
  const [items, setItems] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('');

  const addItem = (item: string) => {
    setItems([...items, item]);
    setStatusMessage(`${item} added to cart. ${items.length + 1} items total.`);
  };

  const removeItem = (index: number) => {
    const removedItem = items[index];
    setItems(items.filter((_, i) => i !== index));
    setStatusMessage(`${removedItem} removed from cart. ${items.length - 1} items total.`);
  };

  return (
    <div>
      <h2>Shopping Cart</h2>

      {/* Live region for status updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusMessage}
      </div>

      {/* Visible cart count */}
      <p aria-hidden="true">
        {items.length} {items.length === 1 ? 'item' : 'items'} in cart
      </p>

      <ul>
        {items.map((item, index) => (
          <li key={index} className="flex justify-between items-center py-2">
            <span>{item}</span>
            <button
              onClick={() => removeItem(index)}
              aria-label={`Remove ${item} from cart`}
              className="px-3 py-1 bg-red-600 text-white rounded"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={() => addItem('Product ' + (items.length + 1))}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Add Item
      </button>
    </div>
  );
}
```

**Key accessibility features:**
- `role="status"` with `aria-live="polite"` announces changes
- `aria-atomic="true"` ensures entire message is read
- `.sr-only` class hides visual duplicate
- Remove buttons have descriptive `aria-label`

---

## 7. Accessible Error Summary

Error summary at top of form that links to fields with errors.

```tsx
interface ErrorSummaryProps {
  errors: Record<string, string>;
}

export function ErrorSummary({ errors }: ErrorSummaryProps) {
  const errorEntries = Object.entries(errors);

  if (errorEntries.length === 0) return null;

  return (
    <div
      role="alert"
      aria-labelledby="error-summary-title"
      className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 rounded"
    >
      <h2 id="error-summary-title" className="text-lg font-semibold text-red-900 mb-2">
        There {errorEntries.length === 1 ? 'is' : 'are'} {errorEntries.length}{' '}
        {errorEntries.length === 1 ? 'error' : 'errors'} in this form
      </h2>
      <ul className="list-disc list-inside space-y-1">
        {errorEntries.map(([field, message]) => (
          <li key={field}>
            <a
              href={`#${field}`}
              className="text-red-900 underline hover:text-red-700"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(field)?.focus();
              }}
            >
              {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Key accessibility features:**
- `role="alert"` announces errors immediately
- Links to fields with errors
- Clicking link focuses the field
- Descriptive error count

---

## Resources

- [WCAG 2.2 Spec](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Radix UI Primitives](https://www.radix-ui.com/) - Accessible components
- [Inclusive Components](https://inclusive-components.design/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

---

**Version**: 1.0.0
**Last Updated**: 2026-01-16
