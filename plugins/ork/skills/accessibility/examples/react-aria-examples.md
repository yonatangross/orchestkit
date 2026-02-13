# React Aria Examples

Complete working examples of accessible components built with React Aria.

## Installation

```bash
npm install react-aria react-stately
npm install --save-dev @types/react-aria @types/react-stately
```

---

## Example 1: Accessible Dropdown Menu

Full-featured menu with keyboard navigation and ARIA semantics.

```tsx
// MenuButton.tsx
import { useRef } from 'react';
import { useButton, useMenuTrigger, useMenu, useMenuItem, mergeProps } from 'react-aria';
import { useMenuTriggerState, useTreeState } from 'react-stately';
import { Item } from 'react-stately';

// Menu Trigger Component
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
        <span aria-hidden="true">▼</span>
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

// Menu Popup Component
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

// Menu Item Component
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

// Usage
function App() {
  return (
    <MenuButton
      label="Actions"
      onAction={(key) => {
        if (key === 'edit') console.log('Edit clicked');
        if (key === 'delete') console.log('Delete clicked');
      }}
    >
      <Item key="edit">Edit</Item>
      <Item key="delete">Delete</Item>
      <Item key="duplicate">Duplicate</Item>
    </MenuButton>
  );
}
```

**Features:**
- Keyboard navigation with arrow keys
- Enter/Space activates menu items
- Escape closes menu
- Focus returns to trigger button
- Proper ARIA roles and attributes

---

## Example 2: Modal Dialog with Focus Trap

Accessible modal with focus management and backdrop dismissal.

```tsx
// Modal.tsx
import { useRef } from 'react';
import { useDialog, useModalOverlay, useButton, FocusScope, mergeProps } from 'react-aria';
import { useOverlayTriggerState } from 'react-stately';
import { AnimatePresence, motion } from 'motion/react';
import { modalBackdrop, modalContent } from '@/lib/animations';

// Modal Component
function Modal({
  state,
  title,
  children,
}: {
  state: ReturnType<typeof useOverlayTriggerState>;
  title: string;
  children: React.ReactNode;
}) {
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
            {...modalBackdrop}
            className="fixed inset-0 z-50 bg-black/50"
          />
          {/* Modal Content */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <FocusScope contain restoreFocus autoFocus>
              <motion.div
                {...mergeProps(modalProps, dialogProps)}
                {...modalContent}
                ref={ref}
                className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 pointer-events-auto"
              >
                <h2 {...titleProps} className="text-xl font-semibold mb-4">
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

// Usage
function App() {
  const state = useOverlayTriggerState({});

  return (
    <>
      <button
        onClick={state.open}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Open Modal
      </button>

      <Modal state={state} title="Confirm Action">
        <p className="mb-4 text-gray-700">
          Are you sure you want to proceed with this action?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={state.close}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              console.log('Confirmed');
              state.close();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Confirm
          </button>
        </div>
      </Modal>
    </>
  );
}
```

**Features:**
- Focus trapped within modal
- Escape key closes modal
- Click outside dismisses
- Focus returns to trigger button
- Motion animations for smooth entrance/exit

---

## Example 3: Combobox with Filtering

Autocomplete input with keyboard navigation and filtering.

```tsx
// Combobox.tsx
import { useRef } from 'react';
import { useComboBox, useFilter, useButton } from 'react-aria';
import { useComboBoxState } from 'react-stately';
import { Item } from 'react-stately';

interface ComboBoxProps {
  label: string;
  items: Array<{ id: string; name: string }>;
  onSelectionChange?: (key: string | null) => void;
}

export function ComboBox(props: ComboBoxProps) {
  const { contains } = useFilter({ sensitivity: 'base' });
  const state = useComboBoxState({ ...props, defaultFilter: contains });

  const inputRef = useRef<HTMLInputElement>(null);
  const listBoxRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { inputProps, listBoxProps, labelProps } = useComboBox(
    {
      ...props,
      inputRef,
      listBoxRef,
      buttonRef,
    },
    state
  );

  const { buttonProps } = useButton(
    {
      onPress: () => state.open(),
      isDisabled: state.isDisabled,
    },
    buttonRef
  );

  return (
    <div className="relative inline-flex flex-col gap-1">
      <label {...labelProps} className="font-medium text-sm">
        {props.label}
      </label>
      <div className="flex">
        <input
          {...inputProps}
          ref={inputRef}
          className="flex-1 border rounded-l px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          {...buttonProps}
          ref={buttonRef}
          className="border border-l-0 rounded-r px-3 bg-gray-50 hover:bg-gray-100"
        >
          <span aria-hidden="true">▼</span>
        </button>
      </div>
      {state.isOpen && (
        <ul
          {...listBoxProps}
          ref={listBoxRef}
          className="absolute top-full mt-1 w-full border bg-white rounded shadow-lg max-h-60 overflow-auto z-10"
        >
          {[...state.collection].map((item) => (
            <ComboBoxItem key={item.key} item={item} state={state} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ComboBoxItem({ item, state }: any) {
  const ref = useRef<HTMLLIElement>(null);
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
        ${isFocused ? 'bg-blue-50' : ''}
        ${isSelected ? 'bg-blue-100 font-semibold' : ''}
      `}
    >
      {item.rendered}
    </li>
  );
}

// Usage
function App() {
  const items = [
    { id: '1', name: 'Apple' },
    { id: '2', name: 'Banana' },
    { id: '3', name: 'Cherry' },
    { id: '4', name: 'Date' },
  ];

  return (
    <ComboBox
      label="Select Fruit"
      items={items}
      onSelectionChange={(key) => console.log('Selected:', key)}
    >
      {(item) => <Item key={item.id}>{item.name}</Item>}
    </ComboBox>
  );
}
```

**Features:**
- Type-ahead filtering with `useFilter`
- Keyboard navigation (arrow keys, Enter, Escape)
- Accessible name via label
- Button to open dropdown
- Selected value shown in input

---

## Example 4: Tooltip Component

Accessible tooltip with hover/focus triggers.

```tsx
// Tooltip.tsx
import { useRef } from 'react';
import { useTooltip, useTooltipTrigger } from 'react-aria';
import { useTooltipTriggerState } from 'react-stately';
import { AnimatePresence, motion } from 'motion/react';
import { fadeIn } from '@/lib/animations';

interface TooltipProps {
  children: React.ReactElement;
  content: string;
  delay?: number;
}

export function Tooltip({ children, content, delay = 0 }: TooltipProps) {
  const state = useTooltipTriggerState({ delay });
  const ref = useRef<HTMLButtonElement>(null);

  const { triggerProps, tooltipProps } = useTooltipTrigger(
    { isDisabled: false },
    state,
    ref
  );

  return (
    <>
      {/* Trigger element */}
      <span {...triggerProps} ref={ref}>
        {children}
      </span>

      {/* Tooltip popup */}
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
      {...fadeIn}
      ref={ref}
      className="absolute z-50 px-3 py-1.5 bg-gray-900 text-white text-sm rounded shadow-lg"
      style={{
        top: 'calc(100% + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
      }}
    >
      {props.children}
    </motion.div>
  );
}

// Usage
function App() {
  return (
    <div className="p-8">
      <Tooltip content="This is a helpful tooltip">
        <button className="px-4 py-2 bg-blue-500 text-white rounded">
          Hover Me
        </button>
      </Tooltip>
    </div>
  );
}
```

**Features:**
- Shows on hover and focus
- Accessible via `aria-describedby`
- Delay before showing (configurable)
- Motion animation for smooth entrance

---

## Testing Example

Using `@testing-library/react` and `jest-axe`:

```tsx
// MenuButton.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MenuButton } from './MenuButton';
import { Item } from 'react-stately';

expect.extend(toHaveNoViolations);

describe('MenuButton', () => {
  test('has no accessibility violations', async () => {
    const { container } = render(
      <MenuButton label="Actions" onAction={() => {}}>
        <Item key="edit">Edit</Item>
        <Item key="delete">Delete</Item>
      </MenuButton>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('opens menu on click', async () => {
    const user = userEvent.setup();
    render(
      <MenuButton label="Actions" onAction={() => {}}>
        <Item key="edit">Edit</Item>
      </MenuButton>
    );

    const button = screen.getByRole('button', { name: /actions/i });
    await user.click(button);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
  });

  test('navigates with arrow keys', async () => {
    const user = userEvent.setup();
    render(
      <MenuButton label="Actions" onAction={() => {}}>
        <Item key="edit">Edit</Item>
        <Item key="delete">Delete</Item>
      </MenuButton>
    );

    const button = screen.getByRole('button', { name: /actions/i });
    await user.click(button);

    const editItem = screen.getByRole('menuitem', { name: /edit/i });
    expect(editItem).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    const deleteItem = screen.getByRole('menuitem', { name: /delete/i });
    expect(deleteItem).toHaveFocus();
  });

  test('closes menu on escape', async () => {
    const user = userEvent.setup();
    render(
      <MenuButton label="Actions" onAction={() => {}}>
        <Item key="edit">Edit</Item>
      </MenuButton>
    );

    const button = screen.getByRole('button', { name: /actions/i });
    await user.click(button);

    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
```

---

## Resources

- [React Aria Documentation](https://react-spectrum.adobe.com/react-aria/)
- [Testing Library React Aria Examples](https://testing-library.com/docs/react-testing-library/example-intro)
- [ARIA Authoring Practices Examples](https://www.w3.org/WAI/ARIA/apg/example-index/)
