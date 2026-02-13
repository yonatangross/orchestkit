---
title: "Transitions: View API"
category: transitions
impact: MEDIUM
---

# View Transitions API

The View Transitions API provides smooth, native transitions between views. Use `startViewTransition` for SPAs or React Router's `viewTransition` prop.

## React Router 7.x Integration

```tsx
import { Link, NavLink, Form } from 'react-router';

// Enable view transitions on links
<Link to="/about" viewTransition>
  About
</Link>

// NavLink with viewTransition
<NavLink to="/dashboard" viewTransition>
  Dashboard
</NavLink>

// Form with viewTransition
<Form method="post" viewTransition>
  <button type="submit">Save</button>
</Form>
```

## Manual startViewTransition (SPA)

```tsx
function navigateWithTransition(navigate: NavigateFunction, to: string) {
  if (!document.startViewTransition) {
    navigate(to);
    return;
  }

  document.startViewTransition(() => {
    navigate(to);
  });
}
```

## State Updates with flushSync

CRITICAL: Always use `flushSync` when updating React state inside `startViewTransition`:

```tsx
function handleTabChange(newTab: string) {
  if (!document.startViewTransition) {
    setActiveTab(newTab);
    return;
  }

  document.startViewTransition(() => {
    ReactDOM.flushSync(() => {
      setActiveTab(newTab);
    });
  });
}
```

## Progressive Enhancement

```tsx
function ViewTransitionLink({ to, children, ...props }: LinkProps) {
  const supportsViewTransitions =
    typeof document !== 'undefined' &&
    'startViewTransition' in document;

  return (
    <Link
      to={to}
      viewTransition={supportsViewTransitions}
      {...props}
    >
      {children}
    </Link>
  );
}
```

## Accessibility: Reduced Motion

```tsx
function useViewTransition() {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  return (callback: () => void) => {
    if (prefersReducedMotion || !document.startViewTransition) {
      callback();
      return;
    }
    document.startViewTransition(callback);
  };
}
```

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

## Anti-Patterns

```tsx
// NEVER: Missing flushSync with React state updates
document.startViewTransition(() => {
  setState(newValue); // Won't capture correctly
});

// NEVER: Transition during scroll (jank)
window.addEventListener('scroll', () => {
  document.startViewTransition(...); // Performance issue
});

// NEVER: Long animations blocking interaction
::view-transition-group(root) {
  animation-duration: 2s; // Too long, blocks navigation
}

// NEVER: Forgetting progressive enhancement
<Link viewTransition>Go</Link> // Breaks in unsupported browsers
```
