/**
 * Accessible Component Templates
 *
 * Ready-to-use templates for common React Aria patterns.
 * Copy and customize for your application.
 */

import { useRef, type ReactNode } from 'react';
import {
  useButton,
  useDialog,
  useModalOverlay,
  useMenu,
  useMenuItem,
  useMenuTrigger,
  useFocusRing,
  mergeProps,
  FocusScope,
  type AriaButtonProps,
} from 'react-aria';
import {
  useOverlayTriggerState,
  useMenuTriggerState,
  useTreeState,
  type OverlayTriggerState,
} from 'react-stately';
import { Item } from 'react-stately';
import { AnimatePresence, motion } from 'motion/react';

// ============================================================================
// TEMPLATE 1: Button Component with Focus Ring
// ============================================================================

interface ButtonProps extends AriaButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
}

export function Button({ variant = 'primary', children, ...props }: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps, isPressed } = useButton(props, ref);
  const { focusProps, isFocusVisible } = useFocusRing();

  const variantClasses = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };

  return (
    <button
      {...mergeProps(buttonProps, focusProps)}
      ref={ref}
      className={`
        px-4 py-2 rounded font-medium transition-all
        ${variantClasses[variant]}
        ${isPressed ? 'scale-95' : ''}
        ${isFocusVisible ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      {children}
    </button>
  );
}

// Usage:
// <Button onPress={() => console.log('Clicked')}>Click Me</Button>
// <Button variant="danger" onPress={() => console.log('Delete')}>Delete</Button>

// ============================================================================
// TEMPLATE 2: Dialog Component with Overlay
// ============================================================================

interface DialogProps {
  state: OverlayTriggerState;
  title: string;
  children: ReactNode;
  isDismissable?: boolean;
}

export function Dialog({ state, title, children, isDismissable = true }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { modalProps, underlayProps } = useModalOverlay(
    { isDismissable },
    state,
    ref
  );
  const { dialogProps, titleProps } = useDialog({ 'aria-label': title }, ref);

  return (
    <AnimatePresence>
      {state.isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            {...underlayProps}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50"
          />

          {/* Dialog Container */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <FocusScope contain restoreFocus autoFocus>
              <motion.div
                {...mergeProps(modalProps, dialogProps)}
                ref={ref}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 pointer-events-auto"
              >
                <h2
                  {...titleProps}
                  className="text-xl font-semibold mb-4 text-gray-900"
                >
                  {title}
                </h2>
                {children}
              </motion.div>
            </FocusScope>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// Usage:
// function App() {
//   const state = useOverlayTriggerState({});
//   return (
//     <>
//       <Button onPress={state.open}>Open Dialog</Button>
//       <Dialog state={state} title="Confirm Action">
//         <p>Are you sure?</p>
//         <div className="flex gap-2 mt-4">
//           <Button variant="secondary" onPress={state.close}>Cancel</Button>
//           <Button onPress={state.close}>Confirm</Button>
//         </div>
//       </Dialog>
//     </>
//   );
// }

// ============================================================================
// TEMPLATE 3: Menu Component with Trigger
// ============================================================================

interface MenuButtonProps {
  label: string;
  children: ReactNode;
  onAction: (key: string | number) => void;
}

export function MenuButton({ label, children, onAction }: MenuButtonProps) {
  const state = useMenuTriggerState({});
  const ref = useRef<HTMLButtonElement>(null);
  const { menuTriggerProps, menuProps } = useMenuTrigger({}, state, ref);
  const { buttonProps } = useButton(menuTriggerProps, ref);

  return (
    <div className="relative inline-block">
      <button
        {...buttonProps}
        ref={ref}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
      >
        {label}
        <span aria-hidden="true">▼</span>
      </button>
      {state.isOpen && (
        <MenuPopup
          {...menuProps}
          autoFocus={state.focusStrategy}
          onClose={state.close}
          onAction={(key) => {
            onAction(key);
            state.close();
          }}
        >
          {children}
        </MenuPopup>
      )}
    </div>
  );
}

function MenuPopup(props: any) {
  const ref = useRef<HTMLUListElement>(null);
  const state = useTreeState({ ...props, selectionMode: 'none' });
  const { menuProps } = useMenu(props, state, ref);

  return (
    <ul
      {...menuProps}
      ref={ref}
      className="absolute top-full left-0 mt-1 min-w-[200px] bg-white border border-gray-200 rounded shadow-lg py-1 z-50"
    >
      {[...state.collection].map((item) => (
        <MenuItem
          key={item.key}
          item={item}
          state={state}
          onAction={props.onAction}
          onClose={props.onClose}
        />
      ))}
    </ul>
  );
}

function MenuItem({ item, state, onAction, onClose }: any) {
  const ref = useRef<HTMLLIElement>(null);
  const { menuItemProps, isFocused, isPressed } = useMenuItem(
    { key: item.key, onAction, onClose },
    state,
    ref
  );

  return (
    <li
      {...menuItemProps}
      ref={ref}
      className={`
        px-4 py-2 cursor-pointer
        ${isFocused ? 'bg-blue-50' : ''}
        ${isPressed ? 'bg-blue-100' : ''}
      `}
    >
      {item.rendered}
    </li>
  );
}

// Usage:
// <MenuButton
//   label="Actions"
//   onAction={(key) => {
//     if (key === 'edit') console.log('Edit');
//     if (key === 'delete') console.log('Delete');
//   }}
// >
//   <Item key="edit">Edit</Item>
//   <Item key="delete">Delete</Item>
//   <Item key="duplicate">Duplicate</Item>
// </MenuButton>

// ============================================================================
// TEMPLATE 4: Focus Ring Utility Hook
// ============================================================================

/**
 * Reusable hook for adding keyboard-only focus indicators to any element.
 *
 * @example
 * function CustomComponent() {
 *   const { focusProps, isFocusVisible } = useFocusRingStyles();
 *   return (
 *     <div
 *       {...focusProps}
 *       className={isFocusVisible ? 'ring-2 ring-blue-500' : ''}
 *     >
 *       Focusable content
 *     </div>
 *   );
 * }
 */
export function useFocusRingStyles() {
  const { focusProps, isFocusVisible } = useFocusRing();

  return {
    focusProps,
    isFocusVisible,
    focusClassName: isFocusVisible ? 'ring-2 ring-offset-2 ring-blue-500' : '',
  };
}

// ============================================================================
// COMMON PATTERNS
// ============================================================================

/**
 * Pattern: Loading Button with Disabled State
 * Shows spinner and disables interaction during async operations.
 */
export function LoadingButton({
  isLoading,
  children,
  ...props
}: ButtonProps & { isLoading?: boolean }) {
  return (
    <Button {...props} isDisabled={props.isDisabled || isLoading}>
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="animate-spin">⏳</span>
          Loading...
        </span>
      ) : (
        children
      )}
    </Button>
  );
}

/**
 * Pattern: Confirmation Dialog
 * Pre-built dialog for confirming dangerous actions.
 */
export function ConfirmDialog({
  state,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
}: {
  state: OverlayTriggerState;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog state={state} title={title}>
      <p className="text-gray-700 mb-6">{message}</p>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onPress={state.close}>
          {cancelLabel}
        </Button>
        <Button
          variant="danger"
          onPress={() => {
            onConfirm();
            state.close();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

// Usage:
// function App() {
//   const state = useOverlayTriggerState({});
//   return (
//     <>
//       <Button variant="danger" onPress={state.open}>Delete Item</Button>
//       <ConfirmDialog
//         state={state}
//         title="Delete Item"
//         message="Are you sure you want to delete this item? This action cannot be undone."
//         onConfirm={() => console.log('Item deleted')}
//       />
//     </>
//   );
// }

// ============================================================================
// ACCESSIBILITY UTILITIES
// ============================================================================

/**
 * Screen Reader Only Text
 * Visually hidden but announced by screen readers.
 */
export function ScreenReaderOnly({ children }: { children: ReactNode }) {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
}

/**
 * Live Region for Dynamic Announcements
 * Use for status updates, error messages, success notifications.
 */
export function LiveRegion({
  children,
  priority = 'polite',
}: {
  children: ReactNode;
  priority?: 'polite' | 'assertive';
}) {
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {children}
    </div>
  );
}

// Usage:
// <LiveRegion priority="polite">Item added to cart</LiveRegion>
// <LiveRegion priority="assertive">Error: Form submission failed</LiveRegion>

// ============================================================================
// TYPESCRIPT TYPES FOR COMMON PATTERNS
// ============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface AccessibleComponentProps {
  /** Accessible label for screen readers */
  'aria-label'?: string;
  /** ID of element that labels this component */
  'aria-labelledby'?: string;
  /** ID of element that describes this component */
  'aria-describedby'?: string;
}

export interface InteractiveProps extends AccessibleComponentProps {
  /** Callback when component is pressed/clicked */
  onPress?: () => void;
  /** Whether component is disabled */
  isDisabled?: boolean;
}
