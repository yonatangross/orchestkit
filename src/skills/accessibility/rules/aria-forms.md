---
title: "React Aria: Forms"
category: aria
impact: HIGH
impactDescription: "Ensures form controls like comboboxes, text fields, and listboxes have proper labels and keyboard navigation"
tags: react-aria, forms, combobox, textfield, listbox
---

# React Aria Forms (useComboBox, useTextField, useListBox)

## useComboBox - Accessible Autocomplete

```tsx
import { useRef } from 'react';
import { useComboBox, useFilter } from 'react-aria';
import { useComboBoxState } from 'react-stately';

function ComboBox(props) {
  const { contains } = useFilter({ sensitivity: 'base' });
  const state = useComboBoxState({ ...props, defaultFilter: contains });
  const inputRef = useRef(null), buttonRef = useRef(null), listBoxRef = useRef(null);

  const { buttonProps, inputProps, listBoxProps, labelProps } = useComboBox(
    { ...props, inputRef, buttonRef, listBoxRef }, state
  );

  return (
    <div className="relative inline-flex flex-col">
      <label {...labelProps}>{props.label}</label>
      <div className="flex">
        <input {...inputProps} ref={inputRef} className="border rounded-l px-3 py-2" />
        <button {...buttonProps} ref={buttonRef} className="border rounded-r px-2">&#9660;</button>
      </div>
      {state.isOpen && (
        <ul {...listBoxProps} ref={listBoxRef} className="absolute top-full w-full border bg-white">
          {[...state.collection].map((item) => (
            <li key={item.key} className="px-3 py-2 hover:bg-gray-100">{item.rendered}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Features:**
- Type-ahead filtering with `useFilter`
- Arrow keys navigate options, Enter selects, Escape closes
- Label associated with input via `labelProps`
- `aria-expanded` indicates dropdown state

## useTextField - Accessible Text Input

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

**Key Props:**
- `label` - Accessible label text
- `description` - Helper text (linked via `aria-describedby`)
- `errorMessage` - Error text (linked via `aria-describedby`)
- `isRequired` - Adds `aria-required="true"`
- `isInvalid` - Adds `aria-invalid="true"`

## useListBox - Accessible List with Selection

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
    { key: item.key }, state, ref
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

**Selection Modes:**
- `"single"` - Select one item
- `"multiple"` - Select multiple items
- `"none"` - No selection (display only)

## useSelect - Dropdown Select

```tsx
import { useRef } from 'react';
import { HiddenSelect, useSelect } from 'react-aria';
import { useSelectState } from 'react-stately';

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
        <span aria-hidden="true">&#9660;</span>
      </button>
      {state.isOpen && (
        <ListBoxPopup {...menuProps} state={state} />
      )}
    </div>
  );
}
```

## react-stately Integration

| React Aria Hook | State Hook |
|----------------|------------|
| useComboBox | useComboBoxState |
| useListBox | useListState |
| useSelect | useSelectState |
| useMenu | useTreeState |
| useCheckbox | useToggleState |

## Anti-Patterns

```tsx
// NEVER omit label associations
<input type="text" placeholder="Email" />  // No accessible name!

// ALWAYS associate labels properly
<label {...labelProps}>Email</label>
<input {...inputProps} />

// NEVER use placeholder as label
<input placeholder="Enter email" />  // Disappears on focus!

// ALWAYS provide visible label + optional placeholder
<label htmlFor="email">Email</label>
<input id="email" placeholder="user@example.com" />
```

**Incorrect — Placeholder as label, no explicit association:**
```tsx
<input type="text" placeholder="Enter your email" />
// Screen readers can't identify field purpose reliably
```

**Correct — useTextField with proper label association:**
```tsx
const { labelProps, inputProps } = useTextField({ label: 'Email' }, ref);
return (
  <>
    <label {...labelProps}>Email</label>
    <input {...inputProps} ref={ref} />
  </>
);
```
