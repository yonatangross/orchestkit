# React Aria Hooks Reference

Comprehensive API reference for Adobe's React Aria hooks with React 19 patterns.

## Installation

```bash
npm install react-aria react-stately
```

**Peer Dependencies:**
- React 19.x
- react-dom 19.x

---

## Button Hooks

### useButton

Creates accessible buttons with keyboard, pointer, and focus support.

```tsx
import { useRef } from 'react';
import { useButton, useFocusRing, mergeProps } from 'react-aria';
import type { AriaButtonProps } from 'react-aria';

function Button(props: AriaButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps, isPressed } = useButton(props, ref);
  const { focusProps, isFocusVisible } = useFocusRing();

  return (
    <button
      {...mergeProps(buttonProps, focusProps)}
      ref={ref}
      className={`
        px-4 py-2 rounded
        ${isPressed ? 'scale-95' : ''}
        ${isFocusVisible ? 'ring-2 ring-blue-500' : ''}
      `}
    >
      {props.children}
    </button>
  );
}
```

**Key Props:**
- `onPress` - Triggered on click or Enter/Space
- `isDisabled` - Disables interaction
- `type` - Button type (button, submit, reset)
- `elementType` - Custom element type (default: button)

**Returns:**
- `buttonProps` - Spread on button element
- `isPressed` - Current press state

---

### useToggleButton

Toggle buttons with on/off states (like icon toggles).

```tsx
import { useRef } from 'react';
import { useToggleButton } from 'react-aria';
import { useToggleState } from 'react-stately';

function ToggleButton(props) {
  const state = useToggleState(props);
  const ref = useRef(null);
  const { buttonProps, isPressed } = useToggleButton(props, state, ref);

  return (
    <button
      {...buttonProps}
      ref={ref}
      className={state.isSelected ? 'bg-blue-500 text-white' : 'bg-gray-200'}
    >
      {props.children}
    </button>
  );
}

// Usage
<ToggleButton onChange={(isSelected) => console.log(isSelected)}>
  Toggle Me
</ToggleButton>
```

---

## Selection Hooks

### useListBox

Accessible list with single/multiple selection, keyboard navigation, and typeahead.

```tsx
import { useRef } from 'react';
import { useListBox, useOption } from 'react-aria';
import { useListState } from 'react-stately';
import { Item } from 'react-stately';

function ListBox(props) {
  const state = useListState(props);
  const ref = useRef(null);
  const { listBoxProps } = useListBox(props, state, ref);

  return (
    <ul {...listBoxProps} ref={ref} className="border rounded">
      {[...state.collection].map((item) => (
        <Option key={item.key} item={item} state={state} />
      ))}
    </ul>
  );
}

function Option({ item, state }) {
  const ref = useRef(null);
  const { optionProps, isSelected, isFocused } = useOption(
    { key: item.key },
    state,
    ref
  );

  return (
    <li
      {...optionProps}
      ref={ref}
      className={`
        px-3 py-2 cursor-pointer
        ${isSelected ? 'bg-blue-500 text-white' : ''}
        ${isFocused ? 'bg-gray-100' : ''}
      `}
    >
      {item.rendered}
    </li>
  );
}

// Usage
<ListBox selectionMode="multiple">
  <Item key="red">Red</Item>
  <Item key="green">Green</Item>
  <Item key="blue">Blue</Item>
</ListBox>
```

**Key Props:**
- `selectionMode` - "single", "multiple", "none"
- `disallowEmptySelection` - Prevent deselecting last item
- `onSelectionChange` - Callback with Set of keys

---

### useSelect

Dropdown select with keyboard navigation and proper ARIA semantics.

```tsx
import { useRef } from 'react';
import { HiddenSelect, useSelect } from 'react-aria';
import { useSelectState } from 'react-stately';
import { Item } from 'react-stately';

function Select(props) {
  const state = useSelectState(props);
  const ref = useRef(null);
  const { triggerProps, valueProps, menuProps } = useSelect(props, state, ref);

  return (
    <div className="relative inline-flex flex-col">
      <HiddenSelect state={state} triggerRef={ref} label={props.label} />
      <button
        {...triggerProps}
        ref={ref}
        className="px-4 py-2 border rounded flex justify-between items-center"
      >
        <span {...valueProps}>
          {state.selectedItem?.rendered || 'Select...'}
        </span>
        <span aria-hidden="true">▼</span>
      </button>
      {state.isOpen && (
        <ListBoxPopup {...menuProps} state={state} />
      )}
    </div>
  );
}
```

---

## Menu Hooks

### useMenu / useMenuItem

Dropdown menus with keyboard navigation and submenus.

```tsx
import { useRef } from 'react';
import { useMenu, useMenuItem, useMenuTrigger } from 'react-aria';
import { useMenuTriggerState } from 'react-stately';

function MenuButton(props) {
  const state = useMenuTriggerState(props);
  const ref = useRef(null);
  const { menuTriggerProps, menuProps } = useMenuTrigger({}, state, ref);

  return (
    <div className="relative">
      <button {...menuTriggerProps} ref={ref}>
        Actions ▼
      </button>
      {state.isOpen && (
        <Menu {...menuProps} onAction={props.onAction} onClose={state.close} />
      )}
    </div>
  );
}

function Menu(props) {
  const ref = useRef(null);
  const state = useTreeState(props);
  const { menuProps } = useMenu(props, state, ref);

  return (
    <ul {...menuProps} ref={ref} className="absolute mt-1 border bg-white rounded shadow">
      {[...state.collection].map((item) => (
        <MenuItem key={item.key} item={item} state={state} onAction={props.onAction} onClose={props.onClose} />
      ))}
    </ul>
  );
}

function MenuItem({ item, state, onAction, onClose }) {
  const ref = useRef(null);
  const { menuItemProps } = useMenuItem(
    { key: item.key, onAction, onClose },
    state,
    ref
  );

  return (
    <li {...menuItemProps} ref={ref} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
      {item.rendered}
    </li>
  );
}
```

---

## Overlay Hooks

### useDialog

Modal dialogs with proper ARIA semantics.

```tsx
import { useRef } from 'react';
import { useDialog } from 'react-aria';

function Dialog({ title, children, ...props }) {
  const ref = useRef(null);
  const { dialogProps, titleProps } = useDialog(props, ref);

  return (
    <div {...dialogProps} ref={ref} className="bg-white rounded-lg p-6">
      <h2 {...titleProps} className="text-xl font-semibold mb-4">
        {title}
      </h2>
      {children}
    </div>
  );
}
```

---

### useModalOverlay

Full-screen overlay with focus management and dismissal.

```tsx
import { useRef } from 'react';
import { useModalOverlay, FocusScope } from 'react-aria';
import { useOverlayTriggerState } from 'react-stately';

function Modal({ state, title, children }) {
  const ref = useRef(null);
  const { modalProps, underlayProps } = useModalOverlay(
    { isDismissable: true },
    state,
    ref
  );

  return (
    <div
      {...underlayProps}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
    >
      <FocusScope contain restoreFocus autoFocus>
        <div {...modalProps} ref={ref}>
          <Dialog title={title}>{children}</Dialog>
        </div>
      </FocusScope>
    </div>
  );
}

// Usage with state management
function App() {
  const state = useOverlayTriggerState({});

  return (
    <>
      <button onClick={state.open}>Open Modal</button>
      {state.isOpen && (
        <Modal state={state} title="Example">
          <p>Modal content here</p>
          <button onClick={state.close}>Close</button>
        </Modal>
      )}
    </>
  );
}
```

---

### useTooltip / useTooltipTrigger

Accessible tooltips with hover/focus triggers.

```tsx
import { useRef } from 'react';
import { useTooltip, useTooltipTrigger } from 'react-aria';
import { useTooltipTriggerState } from 'react-stately';

function TooltipTrigger({ children, tooltip, ...props }) {
  const state = useTooltipTriggerState(props);
  const ref = useRef(null);
  const { triggerProps, tooltipProps } = useTooltipTrigger({}, state, ref);

  return (
    <>
      <button {...triggerProps} ref={ref}>
        {children}
      </button>
      {state.isOpen && (
        <Tooltip {...tooltipProps}>{tooltip}</Tooltip>
      )}
    </>
  );
}

function Tooltip(props) {
  const ref = useRef(null);
  const { tooltipProps } = useTooltip(props, ref);

  return (
    <div
      {...tooltipProps}
      ref={ref}
      className="absolute z-50 px-2 py-1 bg-gray-900 text-white text-sm rounded"
    >
      {props.children}
    </div>
  );
}
```

---

### usePopover

Non-modal popovers for dropdowns, color pickers, etc.

```tsx
import { useRef } from 'react';
import { usePopover, DismissButton, Overlay } from 'react-aria';
import { useOverlayTriggerState } from 'react-stately';

function Popover({ state, children, ...props }) {
  const popoverRef = useRef(null);
  const { popoverProps, underlayProps } = usePopover(
    {
      ...props,
      popoverRef,
    },
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

// Usage
function App() {
  const state = useOverlayTriggerState({});

  return (
    <>
      <button onClick={state.open}>Open Popover</button>
      {state.isOpen && (
        <Popover state={state}>
          <p>Popover content</p>
        </Popover>
      )}
    </>
  );
}
```

---

## Form Hooks

### useTextField

Accessible text inputs with label association.

```tsx
import { useRef } from 'react';
import { useTextField } from 'react-aria';

function TextField(props) {
  const ref = useRef(null);
  const { labelProps, inputProps, descriptionProps, errorMessageProps } = useTextField(props, ref);

  return (
    <div className="flex flex-col gap-1">
      <label {...labelProps} className="font-medium">
        {props.label}
      </label>
      <input
        {...inputProps}
        ref={ref}
        className="border rounded px-3 py-2"
      />
      {props.description && (
        <div {...descriptionProps} className="text-sm text-gray-600">
          {props.description}
        </div>
      )}
      {props.errorMessage && (
        <div {...errorMessageProps} className="text-sm text-red-600">
          {props.errorMessage}
        </div>
      )}
    </div>
  );
}
```

---

## Focus Management

### FocusScope

Manages focus containment and restoration for overlays.

**Props:**
- `contain` - Trap focus within children
- `restoreFocus` - Restore focus to trigger on unmount
- `autoFocus` - Auto-focus first focusable element

```tsx
import { FocusScope } from 'react-aria';

<FocusScope contain restoreFocus autoFocus>
  <div role="dialog">
    <button>First focusable</button>
    <button>Second focusable</button>
  </div>
</FocusScope>
```

---

### useFocusRing

Detects keyboard focus for styling focus indicators.

```tsx
import { useFocusRing } from 'react-aria';

function Component() {
  const { focusProps, isFocusVisible } = useFocusRing();

  return (
    <button
      {...focusProps}
      className={isFocusVisible ? 'ring-2 ring-blue-500' : ''}
    >
      Focusable
    </button>
  );
}
```

---

## Utility Functions

### mergeProps

Safely merges multiple prop objects (handles event handlers, className, etc.).

```tsx
import { mergeProps } from 'react-aria';

const combinedProps = mergeProps(
  { onClick: handler1, className: 'base' },
  { onClick: handler2, className: 'extra' }
);
// Result: onClick calls both handlers, className="base extra"
```

---

## Integration with react-stately

React Aria hooks require state management from `react-stately`:

| Hook | State Hook |
|------|------------|
| useSelect | useSelectState |
| useListBox | useListState |
| useComboBox | useComboBoxState |
| useMenu | useTreeState |
| useModalOverlay | useOverlayTriggerState |

```tsx
import { useListBox } from 'react-aria';
import { useListState } from 'react-stately';

const state = useListState(props);
const { listBoxProps } = useListBox(props, state, ref);
```

---

## TypeScript Support

All hooks include TypeScript types from `@types/react-aria`:

```tsx
import type { AriaButtonProps, AriaDialogProps } from 'react-aria';

function MyButton(props: AriaButtonProps) {
  // Full type safety
}
```

---

## Resources

- [React Aria Documentation](https://react-spectrum.adobe.com/react-aria/)
- [React Stately Documentation](https://react-spectrum.adobe.com/react-stately/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
