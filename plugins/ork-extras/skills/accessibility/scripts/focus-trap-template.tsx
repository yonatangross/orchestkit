/**
 * Focus Management Templates
 *
 * Ready-to-use components and hooks for focus management in React 19 applications.
 * Copy and adapt these templates to your project.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { modalBackdrop, modalContent } from '@/lib/animations';

// ============================================================================
// FOCUSABLE SELECTOR CONSTANT
// ============================================================================

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

// ============================================================================
// HOOK: useFocusTrap
// ============================================================================

/**
 * Focus trap hook for modals and dialogs.
 *
 * @param isActive - Whether the focus trap is active
 * @returns Ref to attach to the container element
 *
 * @example
 * const containerRef = useFocusTrap(isOpen);
 * <div ref={containerRef} role="dialog" aria-modal="true">
 *   {content}
 * </div>
 */
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

// ============================================================================
// HOOK: useRovingTabindex
// ============================================================================

type Orientation = 'horizontal' | 'vertical';

/**
 * Roving tabindex hook for toolbars, menus, and lists.
 *
 * @param itemCount - Number of items in the group
 * @param orientation - Navigation orientation (default: 'vertical')
 * @returns Object with activeIndex, handleKeyDown, and getItemProps
 *
 * @example
 * const { getItemProps, handleKeyDown } = useRovingTabindex(3, 'horizontal');
 * <div role="toolbar" onKeyDown={handleKeyDown}>
 *   <button {...getItemProps(0)}>Bold</button>
 *   <button {...getItemProps(1)}>Italic</button>
 *   <button {...getItemProps(2)}>Underline</button>
 * </div>
 */
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

// ============================================================================
// HOOK: useFocusRestore
// ============================================================================

/**
 * Restore focus to the previously focused element when component unmounts.
 *
 * @param shouldRestore - Whether to restore focus on unmount
 *
 * @example
 * function ConfirmationModal({ isOpen, onClose }) {
 *   useFocusRestore(isOpen);
 *   return <Modal isOpen={isOpen} onClose={onClose}>...</Modal>;
 * }
 */
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

// ============================================================================
// HOOK: useEscapeKey
// ============================================================================

/**
 * Close component when Escape key is pressed.
 *
 * @param onEscape - Callback function to call when Escape is pressed
 * @param isActive - Whether the hook is active
 *
 * @example
 * useEscapeKey(onClose, isOpen);
 */
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

// ============================================================================
// HOOK: useFocusWithin
// ============================================================================

/**
 * Detect when focus is within a component.
 *
 * @returns Object with ref and isFocusWithin boolean
 *
 * @example
 * const { ref, isFocusWithin } = useFocusWithin<HTMLDivElement>();
 * <div ref={ref} className={isFocusWithin ? 'focused' : ''}>
 *   {children}
 * </div>
 */
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

// ============================================================================
// HOOK: useFocusFirstError
// ============================================================================

/**
 * Focus the first error field in a form.
 *
 * @param errors - Record of field names to error messages
 * @returns Ref to attach to the form element
 *
 * @example
 * const [errors, setErrors] = useState({});
 * const formRef = useFocusFirstError(errors);
 * <form ref={formRef}>...</form>
 */
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

// ============================================================================
// COMPONENT: FocusTrap
// ============================================================================

interface FocusTrapProps {
  isActive: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Focus trap component that wraps content with focus trapping.
 *
 * @example
 * <FocusTrap isActive={isOpen}>
 *   <div role="dialog" aria-modal="true">
 *     {content}
 *   </div>
 * </FocusTrap>
 */
export function FocusTrap({ isActive, children, className }: FocusTrapProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(isActive);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

// ============================================================================
// COMPONENT: Modal with Focus Trap
// ============================================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * Modal component with built-in focus trap and animations.
 *
 * @example
 * <Modal isOpen={isOpen} onClose={onClose} title="Confirmation">
 *   <p>Are you sure?</p>
 *   <button onClick={onClose}>Cancel</button>
 *   <button onClick={handleConfirm}>Confirm</button>
 * </Modal>
 */
export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen);
  useEscapeKey(onClose, isOpen);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            {...modalBackdrop}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            {...modalContent}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              ref={containerRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              className="bg-white rounded-2xl p-6 max-w-md w-full pointer-events-auto"
            >
              <h2 id="modal-title" className="text-xl font-semibold mb-4">
                {title}
              </h2>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// COMPONENT: SkipLink
// ============================================================================

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
}

/**
 * Skip link component for keyboard accessibility.
 *
 * @example
 * <SkipLink href="#main-content">Skip to main content</SkipLink>
 */
export function SkipLink({ href, children }: SkipLinkProps) {
  return (
    <a
      href={href}
      className="fixed top-0 left-0 z-[9999] bg-primary text-white px-4 py-2 transform -translate-y-full focus:translate-y-0 transition-transform"
    >
      {children}
    </a>
  );
}

// ============================================================================
// COMPONENT: SkipLinks
// ============================================================================

/**
 * Skip links group component.
 *
 * @example
 * <SkipLinks />
 */
export function SkipLinks() {
  return (
    <nav aria-label="Skip links">
      <SkipLink href="#main-content">Skip to main content</SkipLink>
      <SkipLink href="#navigation">Skip to navigation</SkipLink>
    </nav>
  );
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get all focusable elements within a container.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
}

/**
 * Focus the first focusable element in a container.
 */
export function focusFirstElement(container: HTMLElement): void {
  const elements = getFocusableElements(container);
  if (elements.length > 0) {
    elements[0].focus();
  }
}

/**
 * Focus the last focusable element in a container.
 */
export function focusLastElement(container: HTMLElement): void {
  const elements = getFocusableElements(container);
  if (elements.length > 0) {
    elements[elements.length - 1].focus();
  }
}
