# WCAG 2.2 Level AA Criteria Reference

Complete guide to Web Content Accessibility Guidelines 2.2 AA requirements.

---

## Principle 1: Perceivable

Information and user interface components must be presentable to users in ways they can perceive.

### 1.1 Text Alternatives

**1.1.1 Non-text Content (Level A)**

All non-text content (images, icons, charts) must have text alternatives:

```tsx
// ✅ Informative image
<img src="chart.png" alt="Revenue increased by 40% in Q4" />

// ✅ Decorative image
<img src="background.jpg" alt="" role="presentation" />

// ✅ Icon button
<button aria-label="Save document">
  <svg aria-hidden="true"><path d="..." /></svg>
</button>

// ❌ Missing alt text
<img src="photo.jpg" />
```

### 1.3 Adaptable

**1.3.1 Info and Relationships (Level A)**

Information structure must be programmatically determined:

```tsx
// ✅ Semantic HTML
<form>
  <fieldset>
    <legend>Shipping Address</legend>
    <label htmlFor="street">Street</label>
    <input id="street" type="text" />
  </fieldset>
</form>

// ❌ Div soup
<div class="form">
  <div class="group">
    <span>Shipping Address</span>
    <span>Street</span>
    <input />
  </div>
</div>
```

**1.3.2 Meaningful Sequence (Level A)**

Reading order must match visual presentation:

```tsx
// ✅ DOM order matches visual order
<header>...</header>
<main>...</main>
<aside>...</aside>

// ❌ Using CSS to reorder without adjusting HTML
<aside style={{ order: -1 }}>...</aside>
<main>...</main>
<header>...</header>
```

**1.3.5 Identify Input Purpose (Level AA)**

Form fields must have autocomplete attributes:

```tsx
<input
  type="email"
  name="email"
  autoComplete="email"
  id="user-email"
/>
<input
  type="tel"
  name="phone"
  autoComplete="tel"
  id="user-phone"
/>
```

### 1.4 Distinguishable

**1.4.3 Contrast (Minimum) (Level AA)**

Text contrast ratios:
- Normal text (< 18pt / < 14pt bold): **4.5:1 minimum**
- Large text (≥ 18pt / ≥ 14pt bold): **3:1 minimum**

```css
/* ✅ High contrast for normal text */
:root {
  --text-on-white: #1a1a1a;    /* 16.1:1 */
  --text-secondary: #595959;   /* 7.0:1 */
}

/* ❌ Insufficient contrast */
:root {
  --text-gray: #b3b3b3;        /* 2.1:1 - FAIL */
}
```

**Tools:** [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/), Chrome DevTools

**1.4.10 Reflow (Level AA)**

Content must reflow without horizontal scrolling at 320px width (400% zoom).

```css
/* ✅ Responsive design */
.card {
  width: 100%;
  max-width: 600px;
}

/* ❌ Fixed width */
.card {
  width: 800px; /* Forces horizontal scroll on small screens */
}
```

**1.4.11 Non-text Contrast (Level AA)**

UI components and graphical objects must have **3:1 contrast** against adjacent colors:

- Form field borders
- Button boundaries
- Focus indicators
- Icons
- Chart elements

```css
/* ✅ Button border 3:1 contrast */
.button {
  background: #ffffff;
  border: 2px solid #757575; /* 4.5:1 on white */
}

/* ✅ Focus indicator 3:1 contrast */
:focus-visible {
  outline: 3px solid #0052cc; /* 7.3:1 on white */
}
```

**1.4.12 Text Spacing (Level AA)**

Content must not lose information when text spacing is adjusted:

- Line height: at least 1.5x font size
- Paragraph spacing: at least 2x font size
- Letter spacing: at least 0.12x font size
- Word spacing: at least 0.16x font size

```css
/* ✅ Accessible text spacing */
body {
  line-height: 1.5;
}
p {
  margin-bottom: 2em;
}
```

**1.4.13 Content on Hover or Focus (Level AA)**

Additional content triggered by hover/focus must be:
- Dismissible (Esc key)
- Hoverable (pointer can move over it)
- Persistent (doesn't disappear until dismissed)

```tsx
// ✅ Tooltip with Radix UI
<Tooltip.Root>
  <Tooltip.Trigger>Hover me</Tooltip.Trigger>
  <Tooltip.Portal>
    <Tooltip.Content>
      Tooltip text
      <Tooltip.Arrow />
    </Tooltip.Content>
  </Tooltip.Portal>
</Tooltip.Root>
```

---

## Principle 2: Operable

User interface components and navigation must be operable.

### 2.1 Keyboard Accessible

**2.1.1 Keyboard (Level A)**

All functionality must be available via keyboard:

```tsx
// ✅ Keyboard accessible
<button onClick={handleClick}>Click me</button>

// ❌ Mouse-only interaction
<div onClick={handleClick}>Click me</div>

// ✅ If using div, add keyboard support
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') handleClick();
  }}
>
  Click me
</div>
```

**2.1.2 No Keyboard Trap (Level A)**

Focus must not get trapped:

```tsx
// ✅ Modal with focus trap (can exit with Esc)
import { Dialog } from '@radix-ui/react-dialog';

<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>
      {/* Focus trapped here, but Esc closes */}
      <Dialog.Close>Close</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

**2.1.4 Character Key Shortcuts (Level A)**

Single-key shortcuts must be remappable or disabled:

```tsx
// ✅ Require modifier key
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

### 2.4 Navigable

**2.4.1 Bypass Blocks (Level A)**

Provide skip links to bypass repeated content:

```tsx
<a href="#main-content" className="skip-link">
  Skip to main content
</a>

<nav>...</nav>

<main id="main-content">
  <h1>Page Title</h1>
  {/* Main content */}
</main>
```

```css
/* ✅ Visible on focus */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

**2.4.3 Focus Order (Level A)**

Tab order must follow logical reading sequence:

```tsx
// ✅ Natural tab order
<form>
  <input tabIndex={0} /> {/* Natural order */}
  <input tabIndex={0} />
  <button type="submit">Submit</button>
</form>

// ❌ Positive tabindex (disrupts natural order)
<button tabIndex={3}>Third</button>
<button tabIndex={1}>First</button>
<button tabIndex={2}>Second</button>
```

**2.4.7 Focus Visible (Level AA)**

Keyboard focus must be clearly visible:

```css
/* ✅ High visibility focus indicator */
:focus-visible {
  outline: 3px solid #0052cc;
  outline-offset: 2px;
}

/* ❌ Removed focus outline */
button:focus {
  outline: none; /* FORBIDDEN without replacement */
}
```

**2.4.11 Focus Not Obscured (Minimum) (Level AA - NEW in WCAG 2.2)**

Focused element must not be entirely hidden by sticky headers/footers:

```css
/* ✅ Ensure scroll margin for sticky header */
:root {
  --header-height: 64px;
}

:focus {
  scroll-margin-top: var(--header-height);
}
```

### 2.5 Input Modalities

**2.5.1 Pointer Gestures (Level A)**

All multipoint/path-based gestures must have single-pointer alternatives:

```tsx
// ✅ Pinch-to-zoom alternative
<button onClick={handleZoomIn}>Zoom In</button>
<button onClick={handleZoomOut}>Zoom Out</button>

// ✅ Swipe alternative
<button onClick={handlePrevious}>Previous</button>
<button onClick={handleNext}>Next</button>
```

**2.5.2 Pointer Cancellation (Level A)**

Actions should complete on `up` event, not `down`:

```tsx
// ✅ Click completes on mouse up
<button onClick={handleClick}>Click me</button>

// ❌ Action on mouse down
<button onMouseDown={handleClick}>Click me</button>
```

**2.5.3 Label in Name (Level A)**

Accessible name must include visible text:

```tsx
// ✅ Aria-label matches visible text
<button aria-label="Save document">Save</button>

// ❌ Aria-label doesn't match visible text
<button aria-label="Submit form">Save</button>
```

**2.5.7 Dragging Movements (Level AA - NEW in WCAG 2.2)**

Dragging functionality must have single-pointer alternative:

```tsx
// ✅ Drag-and-drop with keyboard alternative
<DragDropContext onDragEnd={handleDragEnd}>
  <Droppable droppableId="list">
    {(provided) => (
      <ul {...provided.droppableProps} ref={provided.innerRef}>
        {items.map((item, index) => (
          <Draggable key={item.id} draggableId={item.id} index={index}>
            {/* Item with move up/down buttons */}
            <button onClick={() => moveUp(index)}>↑</button>
            <button onClick={() => moveDown(index)}>↓</button>
          </Draggable>
        ))}
      </ul>
    )}
  </Droppable>
</DragDropContext>
```

**2.5.8 Target Size (Minimum) (Level AA - NEW in WCAG 2.2)**

Interactive elements must be at least **24x24 CSS pixels** (except inline links):

```css
/* ✅ Minimum target size */
button, a[role="button"], input[type="checkbox"] {
  min-width: 24px;
  min-height: 24px;
}

/* ✅ Touch-friendly target size */
@media (hover: none) {
  button {
    min-width: 44px;
    min-height: 44px;
  }
}
```

---

## Principle 3: Understandable

Information and operation of user interface must be understandable.

### 3.1 Readable

**3.1.1 Language of Page (Level A)**

Page language must be specified:

```html
<html lang="en">
```

**3.1.2 Language of Parts (Level AA)**

Changes in language must be marked:

```tsx
<p>The French phrase <span lang="fr">Je ne sais quoi</span> means...</p>
```

### 3.2 Predictable

**3.2.1 On Focus (Level A)**

Focus must not trigger unexpected context changes:

```tsx
// ✅ Submit on button click
<form onSubmit={handleSubmit}>
  <input type="text" />
  <button type="submit">Submit</button>
</form>

// ❌ Submit on focus change
<select onChange={handleSubmit}>...</select>
```

**3.2.2 On Input (Level A)**

User input must not automatically trigger context changes:

```tsx
// ✅ Button to apply filter
<select value={filter} onChange={(e) => setFilter(e.target.value)}>
  ...
</select>
<button onClick={applyFilter}>Apply</button>

// ❌ Auto-submit on select change
<select onChange={(e) => { setFilter(e.target.value); form.submit(); }}>
```

**3.2.3 Consistent Navigation (Level AA)**

Navigation must be consistent across pages:

```tsx
// ✅ Same navigation on every page
<nav>
  <Link to="/">Home</Link>
  <Link to="/about">About</Link>
  <Link to="/contact">Contact</Link>
</nav>
```

**3.2.4 Consistent Identification (Level AA)**

Components with same functionality must be identified consistently:

```tsx
// ✅ Consistent icon and label
<button aria-label="Save document"><SaveIcon /></button>

// ❌ Inconsistent labeling
<button aria-label="Save">...</button>
<button aria-label="Store document">...</button>
```

### 3.3 Input Assistance

**3.3.1 Error Identification (Level A)**

Errors must be identified and described:

```tsx
// ✅ Error message with role="alert"
{error && (
  <p id="email-error" role="alert" className="text-error">
    {error}
  </p>
)}

<input
  id="email"
  type="email"
  aria-invalid={!!error}
  aria-describedby={error ? "email-error" : undefined}
/>
```

**3.3.2 Labels or Instructions (Level A)**

Form fields must have clear labels:

```tsx
// ✅ Associated label
<label htmlFor="username">Username</label>
<input id="username" type="text" />

// ✅ Aria-label when visual label not present
<input type="search" aria-label="Search products" />
```

**3.3.3 Error Suggestion (Level AA)**

Provide correction suggestions when possible:

```tsx
{error === 'EMAIL_INVALID' && (
  <p id="email-error" role="alert">
    Please enter a valid email address (example: user@example.com)
  </p>
)}
```

**3.3.4 Error Prevention (Legal, Financial, Data) (Level AA)**

Provide confirmation before critical actions:

```tsx
<Dialog.Root open={showConfirm} onOpenChange={setShowConfirm}>
  <Dialog.Trigger asChild>
    <button>Delete account</button>
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Content>
      <Dialog.Title>Confirm deletion</Dialog.Title>
      <Dialog.Description>
        This action cannot be undone. Are you sure?
      </Dialog.Description>
      <button onClick={handleDelete}>Yes, delete</button>
      <Dialog.Close>Cancel</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

---

## Principle 4: Robust

Content must be robust enough to be interpreted by assistive technologies.

### 4.1 Compatible

**4.1.2 Name, Role, Value (Level A)**

All UI components must have proper name, role, and value:

```tsx
// ✅ Native button (implicit role)
<button aria-label="Close dialog" onClick={onClose}>
  ×
</button>

// ✅ Custom widget with explicit role
<div
  role="switch"
  aria-checked={isEnabled}
  aria-label="Enable notifications"
  tabIndex={0}
  onClick={handleToggle}
  onKeyDown={(e) => {
    if (e.key === ' ' || e.key === 'Enter') handleToggle();
  }}
/>

// ❌ Missing accessible name
<button onClick={onClose}>×</button>
```

**4.1.3 Status Messages (Level AA)**

Status updates must be programmatically determinable:

```tsx
// ✅ Live region for status updates
<div role="status" aria-live="polite">
  {items.length} items in cart
</div>

// ✅ Alert for errors
<div role="alert" aria-live="assertive">
  {error}
</div>
```

---

## Testing Tools

| Tool | Purpose | Link |
|------|---------|------|
| **axe DevTools** | Automated testing | [Browser extension](https://www.deque.com/axe/devtools/) |
| **WebAIM Contrast Checker** | Color contrast | [webaim.org/resources/contrastchecker](https://webaim.org/resources/contrastchecker/) |
| **WAVE** | Page-level audit | [wave.webaim.org](https://wave.webaim.org/) |
| **NVDA** | Screen reader (Windows) | [nvaccess.org](https://www.nvaccess.org/) |
| **JAWS** | Screen reader (Windows) | [freedomscientific.com](https://www.freedomscientific.com/products/software/jaws/) |
| **VoiceOver** | Screen reader (macOS/iOS) | Built-in |
| **TalkBack** | Screen reader (Android) | Built-in |

---

## Resources

- [WCAG 2.2 Official Spec](https://www.w3.org/TR/WCAG22/)
- [MDN Accessibility Guide](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM Resources](https://webaim.org/resources/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
- [Inclusive Components](https://inclusive-components.design/)

---

**Version**: 1.0.0
**Last Updated**: 2026-01-16
**Based on**: WCAG 2.2 Level AA
