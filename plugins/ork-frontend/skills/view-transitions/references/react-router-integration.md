# React Router View Transitions

## Basic Usage

```tsx
import { Link, NavLink, Form } from 'react-router';

// Simple viewTransition prop
<Link to="/about" viewTransition>
  About
</Link>

// With NavLink for active states
<NavLink
  to="/dashboard"
  viewTransition
  className={({ isActive }) => isActive ? 'active' : ''}
>
  Dashboard
</NavLink>

// Form submissions
<Form method="post" viewTransition>
  <button type="submit">Save</button>
</Form>
```

## useViewTransitionState Hook

```tsx
import { useViewTransitionState, Link } from 'react-router';

function ProductCard({ product }) {
  // Returns true during transition to this route
  const isTransitioning = useViewTransitionState(`/products/${product.id}`);

  return (
    <Link to={`/products/${product.id}`} viewTransition>
      <img
        src={product.image}
        style={{
          // Only set name during transition
          viewTransitionName: isTransitioning ? 'product-hero' : undefined,
        }}
      />
    </Link>
  );
}
```

## Custom CSS Transitions

```css
/* globals.css */

/* Default cross-fade */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.3s;
}

/* Slide transitions for navigation */
::view-transition-old(root) {
  animation: slide-out 0.3s ease-out;
}

::view-transition-new(root) {
  animation: slide-in 0.3s ease-out;
}

@keyframes slide-out {
  to { transform: translateX(-20px); opacity: 0; }
}

@keyframes slide-in {
  from { transform: translateX(20px); opacity: 0; }
}

/* Shared element transition */
::view-transition-group(product-hero) {
  animation-duration: 0.4s;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

## Progressive Enhancement

```tsx
// Check support before using
const supportsViewTransitions =
  typeof document !== 'undefined' &&
  'startViewTransition' in document;

<Link
  to={to}
  viewTransition={supportsViewTransitions}
>
  Navigate
</Link>
```
