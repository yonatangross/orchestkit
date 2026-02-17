---
title: "React Aria: Components"
category: aria
impact: HIGH
impactDescription: "Ensures buttons, dialogs, and menus are fully accessible with keyboard support and ARIA attributes"
tags: react-aria, components, button, dialog, menu
---

# React Aria Components (useButton, useDialog, useMenu)

## useButton - Accessible Button

```tsx
import { useRef } from 'react';
import { useButton, useFocusRing, mergeProps } from 'react-aria';
import type { AriaButtonProps } from 'react-aria';

function Button(props: AriaButtonProps & { className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps, isPressed } = useButton(props, ref);
  const { focusProps, isFocusVisible } = useFocusRing();

  return (
    <button
      {...mergeProps(buttonProps, focusProps)}
      ref={ref}
      className={`
        px-4 py-2 rounded font-medium transition-all
        ${isPressed ? 'scale-95' : ''}
        ${isFocusVisible ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      {props.children}
    </button>
  );
}
```

**Key Props:**
- `onPress` - Triggered on click, tap, Enter, or Space
- `isDisabled` - Disables all interaction
- `elementType` - Custom element type (default: button)

## useDialog - Modal Dialog

```tsx
import { useRef } from 'react';
import { useDialog, useModalOverlay, FocusScope, mergeProps } from 'react-aria';
import { useOverlayTriggerState } from 'react-stately';

function Modal({ state, title, children }) {
  const ref = useRef<HTMLDivElement>(null);
  const { modalProps, underlayProps } = useModalOverlay({}, state, ref);
  const { dialogProps, titleProps } = useDialog({ 'aria-label': title }, ref);

  return (
    <div {...underlayProps} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <FocusScope contain restoreFocus autoFocus>
        <div {...mergeProps(modalProps, dialogProps)} ref={ref} className="bg-white rounded-lg p-6">
          <h2 {...titleProps} className="text-xl font-semibold mb-4">{title}</h2>
          {children}
        </div>
      </FocusScope>
    </div>
  );
}
```

## useMenu - Dropdown Menu

```tsx
import { useRef } from 'react';
import { useButton, useMenuTrigger, useMenu, useMenuItem, mergeProps } from 'react-aria';
import { useMenuTriggerState, useTreeState } from 'react-stately';
import { Item } from 'react-stately';

export function MenuButton(props: { label: string; onAction: (key: string) => void }) {
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
        {props.label}
        <span aria-hidden="true">&#9660;</span>
      </button>
      {state.isOpen && (
        <MenuPopup
          {...menuProps}
          autoFocus={state.focusStrategy}
          onClose={state.close}
          onAction={(key) => {
            props.onAction(key as string);
            state.close();
          }}
        />
      )}
    </div>
  );
}

function MenuPopup(props: any) {
  const ref = useRef<HTMLUListElement>(null);
  const state = useTreeState({ ...props, selectionMode: 'none' });
  const { menuProps } = useMenu(props, state, ref);

  return (
    <ul {...menuProps} ref={ref} className="absolute top-full left-0 mt-1 min-w-[200px] bg-white border rounded shadow-lg py-1 z-50">
      {[...state.collection].map((item) => (
        <MenuItem key={item.key} item={item} state={state} onAction={props.onAction} onClose={props.onClose} />
      ))}
    </ul>
  );
}

function MenuItem({ item, state, onAction, onClose }: any) {
  const ref = useRef<HTMLLIElement>(null);
  const { menuItemProps, isFocused, isPressed } = useMenuItem(
    { key: item.key, onAction, onClose }, state, ref
  );

  return (
    <li {...menuItemProps} ref={ref} className={`px-4 py-2 cursor-pointer ${isFocused ? 'bg-blue-50' : ''} ${isPressed ? 'bg-blue-100' : ''}`}>
      {item.rendered}
    </li>
  );
}
```

## mergeProps Utility

Safely merge multiple prop objects (combines event handlers):

```tsx
import { mergeProps } from 'react-aria';

const combinedProps = mergeProps(
  { onClick: handler1, className: 'base' },
  { onClick: handler2, className: 'extra' }
);
// Result: onClick calls both handlers
```

## Hooks vs Components Decision

| Approach | Use When |
|----------|----------|
| `useButton` hooks | Maximum control over rendering and styling |
| `Button` from react-aria-components | Fast prototyping, less boilerplate |

## Anti-Patterns

```tsx
// NEVER use div with onClick for interactive elements
<div onClick={handleClick}>Click me</div>  // Missing keyboard support!

// ALWAYS use useButton or native button
const { buttonProps } = useButton({ onPress: handleClick }, ref);
<div {...buttonProps} ref={ref}>Click me</div>

// NEVER forget aria-live for dynamic announcements
<div>{errorMessage}</div>  // Screen readers won't announce!

// ALWAYS use aria-live for status updates
<div aria-live="polite" className="sr-only">{errorMessage}</div>
```

**Incorrect — div with onClick, no keyboard support:**
```tsx
<div onClick={handleClick} className="button">
  Click me
</div>
// No keyboard access, no screen reader announcement
```

**Correct — useButton hook provides full accessibility:**
```tsx
const ref = useRef<HTMLButtonElement>(null);
const { buttonProps } = useButton({ onPress: handleClick }, ref);
return <button {...buttonProps} ref={ref}>Click me</button>;
```
