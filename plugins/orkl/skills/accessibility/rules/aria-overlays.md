---
title: "React Aria: Overlays"
category: aria
impact: HIGH
impactDescription: "Ensures modals, tooltips, and popovers trap focus correctly and restore focus on close"
tags: react-aria, modal, tooltip, popover, overlay
---

# React Aria Overlays (useModalOverlay, useTooltip, usePopover)

## useModalOverlay - Full Modal Dialog

```tsx
import { useRef } from 'react';
import { useDialog, useModalOverlay, FocusScope, mergeProps } from 'react-aria';
import { useOverlayTriggerState } from 'react-stately';
import { AnimatePresence, motion } from 'motion/react';

function Modal({ state, title, children }) {
  const ref = useRef<HTMLDivElement>(null);
  const { modalProps, underlayProps } = useModalOverlay(
    { isDismissable: true },
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
            className="fixed inset-0 z-50 bg-black/50"
          />
          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <FocusScope contain restoreFocus autoFocus>
              <motion.div
                {...mergeProps(modalProps, dialogProps)}
                ref={ref}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 pointer-events-auto"
              >
                <h2 {...titleProps} className="text-xl font-semibold mb-4">{title}</h2>
                {children}
              </motion.div>
            </FocusScope>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// Usage
function App() {
  const state = useOverlayTriggerState({});

  return (
    <>
      <button onClick={state.open} className="px-4 py-2 bg-blue-500 text-white rounded">
        Open Modal
      </button>
      <Modal state={state} title="Confirm Action">
        <p className="mb-4 text-gray-700">Are you sure you want to proceed?</p>
        <div className="flex gap-2 justify-end">
          <button onClick={state.close} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={() => { console.log('Confirmed'); state.close(); }} className="px-4 py-2 bg-blue-500 text-white rounded">
            Confirm
          </button>
        </div>
      </Modal>
    </>
  );
}
```

**Features:**
- Focus trapped within modal via `FocusScope contain`
- Escape key closes modal
- Click outside dismisses (if `isDismissable`)
- Focus returns to trigger button via `restoreFocus`
- Motion animations for smooth entrance/exit

## useTooltip - Accessible Tooltip

```tsx
import { useRef } from 'react';
import { useTooltip, useTooltipTrigger } from 'react-aria';
import { useTooltipTriggerState } from 'react-stately';
import { AnimatePresence, motion } from 'motion/react';

function Tooltip({ children, content, delay = 0 }) {
  const state = useTooltipTriggerState({ delay });
  const ref = useRef<HTMLButtonElement>(null);
  const { triggerProps, tooltipProps } = useTooltipTrigger({}, state, ref);

  return (
    <>
      <span {...triggerProps} ref={ref}>
        {children}
      </span>
      <AnimatePresence>
        {state.isOpen && (
          <TooltipPopup {...tooltipProps}>{content}</TooltipPopup>
        )}
      </AnimatePresence>
    </>
  );
}

function TooltipPopup(props: any) {
  const ref = useRef<HTMLDivElement>(null);
  const { tooltipProps } = useTooltip(props, ref);

  return (
    <motion.div
      {...tooltipProps}
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute z-50 px-3 py-1.5 bg-gray-900 text-white text-sm rounded shadow-lg"
    >
      {props.children}
    </motion.div>
  );
}
```

**Features:**
- Shows on hover and focus
- Accessible via `aria-describedby`
- Configurable delay before showing
- Content on Hover/Focus (WCAG 1.4.13): dismissible, hoverable, persistent

## usePopover - Non-Modal Overlay

```tsx
import { useRef } from 'react';
import { usePopover, DismissButton, Overlay } from 'react-aria';
import { useOverlayTriggerState } from 'react-stately';

function Popover({ state, children, ...props }) {
  const popoverRef = useRef(null);
  const { popoverProps, underlayProps } = usePopover(
    { ...props, popoverRef },
    state
  );

  return (
    <Overlay>
      <div {...underlayProps} className="fixed inset-0" />
      <div
        {...popoverProps}
        ref={popoverRef}
        className="absolute z-10 bg-white border rounded shadow-lg p-4"
      >
        <DismissButton onDismiss={state.close} />
        {children}
        <DismissButton onDismiss={state.close} />
      </div>
    </Overlay>
  );
}
```

**Popover vs Modal:**

| Feature | Popover | Modal |
|---------|---------|-------|
| Focus containment | Soft (can escape) | Strict (trapped) |
| Backdrop | Invisible dismiss layer | Visible overlay |
| Use case | Dropdowns, color pickers | Confirmations, forms |
| Escape key | Closes | Closes |
| Click outside | Dismisses | Dismisses if `isDismissable` |

## Overlay State Management

All overlays use `useOverlayTriggerState`:

```tsx
import { useOverlayTriggerState } from 'react-stately';

const state = useOverlayTriggerState({});

// Properties
state.isOpen    // boolean
state.open()    // open overlay
state.close()   // close overlay
state.toggle()  // toggle
```

## Confirmation Dialog Pattern

Pre-built pattern for confirming destructive actions:

```tsx
function ConfirmDialog({ state, title, message, onConfirm }) {
  return (
    <Modal state={state} title={title}>
      <p className="text-gray-700 mb-6">{message}</p>
      <div className="flex gap-2 justify-end">
        <button onClick={state.close} className="px-4 py-2 border rounded">
          Cancel
        </button>
        <button
          onClick={() => { onConfirm(); state.close(); }}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Confirm
        </button>
      </div>
    </Modal>
  );
}
```

## Anti-Patterns

```tsx
// NEVER handle focus manually for modals
useEffect(() => { modalRef.current?.focus(); }, []);  // Incomplete!

// ALWAYS use FocusScope for modals/overlays
<FocusScope contain restoreFocus autoFocus>
  <div role="dialog">...</div>
</FocusScope>

// NEVER forget to restore focus on close
// useOverlayTriggerState + FocusScope restoreFocus handles this automatically
```

**Incorrect — Modal without focus management:**
```tsx
{isOpen && (
  <div role="dialog" className="modal">
    <h2>Confirm Action</h2>
    <button onClick={onClose}>Close</button>
  </div>
)}
// No focus trap, no focus restoration
```

**Correct — useModalOverlay with FocusScope:**
```tsx
<FocusScope contain restoreFocus autoFocus>
  <div {...mergeProps(modalProps, dialogProps)} ref={ref}>
    <h2 {...titleProps}>Confirm Action</h2>
    <button onClick={state.close}>Close</button>
  </div>
</FocusScope>
```
