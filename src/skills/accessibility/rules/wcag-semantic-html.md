---
title: "WCAG: Semantic HTML"
category: wcag
impact: CRITICAL
impactDescription: "Ensures proper document structure with semantic HTML and ARIA attributes for screen readers"
tags: wcag, semantic, html, aria, structure
---

# Semantic HTML & ARIA (WCAG 1.3.1, 4.1.2)

## Document Structure

```tsx
<main>
  <article>
    <header><h1>Page Title</h1></header>
    <section aria-labelledby="features-heading">
      <h2 id="features-heading">Features</h2>
      <ul><li>Feature 1</li></ul>
    </section>
    <aside aria-label="Related content">...</aside>
  </article>
</main>
```

## Heading Hierarchy

Always follow h1-h6 order without skipping levels:

```tsx
// CORRECT
<h1>Page Title</h1>
  <h2>Section</h2>
    <h3>Subsection</h3>

// FORBIDDEN: Skipping levels
<h1>Page Title</h1>
  <h3>Subsection</h3>  // Skipped h2!
```

## ARIA Labels and States

```tsx
// Icon-only button
<button aria-label="Save document">
  <svg aria-hidden="true">...</svg>
</button>

// Form field with error
<input
  id="email"
  aria-required="true"
  aria-invalid={!!error}
  aria-describedby={error ? "email-error" : "email-hint"}
/>
{error && <p id="email-error" role="alert">{error}</p>}

// Custom widget with explicit role
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
```

## Form Structure

```tsx
<form>
  <fieldset>
    <legend>Shipping Address</legend>
    <label htmlFor="street">Street</label>
    <input id="street" type="text" autoComplete="street-address" />
  </fieldset>
</form>
```

## Live Regions

```tsx
// Polite: status updates (default, avoids interruption)
<div role="status" aria-live="polite" aria-atomic="true">
  {items.length} items in cart
</div>

// Assertive: errors that need immediate announcement
<div role="alert" aria-live="assertive">
  {error}
</div>
```

## Page Language

```html
<html lang="en">
  <body>
    <p>The French phrase <span lang="fr">Je ne sais quoi</span> means...</p>
  </body>
</html>
```

## Skip Links

```tsx
<a href="#main-content" className="skip-link">
  Skip to main content
</a>
<nav>...</nav>
<main id="main-content" tabIndex={-1}>
  {children}
</main>
```

```css
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

## WCAG 2.2 AA Checklist

| Criterion | Requirement | Test |
|-----------|-------------|------|
| 1.1.1 Non-text | Alt text for images | axe-core scan |
| 1.3.1 Info | Semantic HTML, headings | Manual + automated |
| 1.4.3 Contrast | 4.5:1 text, 3:1 large | WebAIM checker |
| 2.1.1 Keyboard | All functionality via keyboard | Tab through |
| 2.4.3 Focus Order | Logical tab sequence | Manual test |
| 2.4.7 Focus Visible | Clear focus indicator | Visual check |
| 2.4.11 Focus Not Obscured | Focus not hidden by sticky elements | scroll-margin-top |
| 2.5.8 Target Size | Min 24x24px interactive | CSS audit |
| 4.1.2 Name/Role/Value | Proper ARIA, labels | Screen reader test |

## Anti-Patterns

- **Div soup**: Using `<div>` where `<nav>`, `<main>`, `<article>` should be used
- **Empty links/buttons**: Interactive elements without accessible names
- **ARIA overuse**: Using ARIA when semantic HTML suffices (prefer `<button>` over `<div role="button">`)
- **Positive tabindex**: Using `tabIndex > 0` disrupts natural tab order
- **Decorative images without alt=""**: Must use `alt=""` or `role="presentation"`

**Incorrect — Skipping heading levels:**
```tsx
<h1>Page Title</h1>
<h3>Subsection</h3>  {/* Skipped h2 */}
// Screen readers rely on heading hierarchy
```

**Correct — Following h1-h6 order without skipping:**
```tsx
<h1>Page Title</h1>
<h2>Section</h2>
<h3>Subsection</h3>
```
