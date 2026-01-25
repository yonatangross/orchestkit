---
name: view-transitions
description: View Transitions API for smooth page transitions, shared element animations, and SPA/MPA navigation in React applications. Use when adding view transitions or page animations.
tags: [view-transitions, page-transition, shared-element, navigation, react-router, animation, spa, mpa]
context: fork
agent: frontend-ui-developer
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# View Transitions

The View Transitions API provides smooth, native transitions between different views in web applications. Supported in Chrome 126+ and Safari 18.2+.

## Overview

- Page navigation transitions in SPAs
- Cross-document (MPA) transitions
- Shared element animations (image galleries, cards)
- Modal-to-page transitions
- List item to detail view animations
- Tab switching with smooth transitions

## Core Patterns

### 1. React Router 7.x Integration (Simplest)

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

### 2. useViewTransitionState Hook

```tsx
import { useViewTransitionState, Link } from 'react-router';

function ProductCard({ product }: { product: Product }) {
  const isTransitioning = useViewTransitionState(`/products/${product.id}`);

  return (
    <Link to={`/products/${product.id}`} viewTransition>
      <img
        src={product.image}
        alt={product.name}
        style={{
          viewTransitionName: isTransitioning ? 'product-image' : undefined,
        }}
      />
    </Link>
  );
}

// On detail page, match the transition name
function ProductDetail({ product }: { product: Product }) {
  return (
    <img
      src={product.image}
      alt={product.name}
      style={{ viewTransitionName: 'product-image' }}
    />
  );
}
```

### 3. Manual startViewTransition (SPA)

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

// With React state updates
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

### 4. Cross-Document Transitions (MPA)

```css
/* Enable in both source and target documents */
@view-transition {
  navigation: auto;
}

/* Customize the transition */
::view-transition-old(root) {
  animation: fade-out 0.3s ease-out;
}

::view-transition-new(root) {
  animation: fade-in 0.3s ease-in;
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### 5. Shared Element Transitions

```tsx
// Source page (list)
function ImageGallery({ images }: { images: Image[] }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {images.map((image) => (
        <Link
          key={image.id}
          to={`/image/${image.id}`}
          viewTransition
        >
          <img
            src={image.thumbnail}
            alt={image.alt}
            style={{ viewTransitionName: `image-${image.id}` }}
          />
        </Link>
      ))}
    </div>
  );
}

// Target page (detail)
function ImageDetail({ image }: { image: Image }) {
  return (
    <img
      src={image.fullSize}
      alt={image.alt}
      style={{ viewTransitionName: `image-${image.id}` }}
      className="w-full h-auto"
    />
  );
}
```

### 6. Navigation Events (pageswap/pagereveal)

```tsx
// Customize transition based on navigation type
useEffect(() => {
  const handlePageReveal = (event: PageRevealEvent) => {
    const transition = event.viewTransition;
    if (!transition) return;

    // Customize based on navigation direction
    const fromURL = new URL(navigation.activation?.from || '', location.href);
    const toURL = new URL(location.href);

    if (isBackNavigation(fromURL, toURL)) {
      transition.types.add('slide-right');
    } else {
      transition.types.add('slide-left');
    }
  };

  window.addEventListener('pagereveal', handlePageReveal);
  return () => window.removeEventListener('pagereveal', handlePageReveal);
}, []);
```

### 7. Transition Types for CSS Targeting

```tsx
// Add transition types programmatically
document.startViewTransition({
  update: () => navigate(to),
  types: ['slide-left'],
});
```

```css
/* Target specific transition types */
::view-transition-group(root) {
  animation-duration: 0.3s;
}

/* Slide left transition */
html:active-view-transition-type(slide-left) {
  &::view-transition-old(root) {
    animation: slide-out-left 0.3s ease-out;
  }
  &::view-transition-new(root) {
    animation: slide-in-right 0.3s ease-out;
  }
}

/* Slide right transition (back navigation) */
html:active-view-transition-type(slide-right) {
  &::view-transition-old(root) {
    animation: slide-out-right 0.3s ease-out;
  }
  &::view-transition-new(root) {
    animation: slide-in-left 0.3s ease-out;
  }
}

@keyframes slide-out-left {
  to { transform: translateX(-100%); opacity: 0; }
}
@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
}
@keyframes slide-out-right {
  to { transform: translateX(100%); opacity: 0; }
}
@keyframes slide-in-left {
  from { transform: translateX(-100%); opacity: 0; }
}
```

## CSS View Transition Pseudo-Elements

```css
/* Structure of view transition pseudo-elements */
::view-transition
├── ::view-transition-group(root)
│   └── ::view-transition-image-pair(root)
│       ├── ::view-transition-old(root)
│       └── ::view-transition-new(root)
└── ::view-transition-group(header)
    └── ::view-transition-image-pair(header)
        ├── ::view-transition-old(header)
        └── ::view-transition-new(header)
```

```css
/* Customize specific elements */
::view-transition-group(product-image) {
  animation-duration: 0.4s;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

::view-transition-old(product-image),
::view-transition-new(product-image) {
  /* Prevent default crossfade, use only movement */
  animation: none;
  mix-blend-mode: normal;
}
```

## Progressive Enhancement

```tsx
// Feature detection wrapper
function ViewTransitionLink({
  to,
  children,
  ...props
}: LinkProps) {
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

// CSS feature detection
@supports (view-transition-name: none) {
  .card-image {
    view-transition-name: var(--transition-name);
  }
}
```

## Accessibility Considerations

```css
/* Respect reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

```tsx
// Skip transitions for reduced motion
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

## Anti-Patterns (FORBIDDEN)

```tsx
// ❌ NEVER: Duplicate view-transition-name (must be unique)
<img style={{ viewTransitionName: 'image' }} />
<img style={{ viewTransitionName: 'image' }} /> // Breaks transition!

// ❌ NEVER: viewTransitionName on hidden elements
<div style={{ display: 'none', viewTransitionName: 'card' }} />

// ❌ NEVER: Missing flushSync with React state updates
document.startViewTransition(() => {
  setState(newValue); // ❌ Won't capture correctly
});
// ✅ CORRECT:
document.startViewTransition(() => {
  ReactDOM.flushSync(() => setState(newValue));
});

// ❌ NEVER: Transition during scroll (jank)
window.addEventListener('scroll', () => {
  document.startViewTransition(...); // ❌ Performance issue
});

// ❌ NEVER: Long animations blocking interaction
::view-transition-group(root) {
  animation-duration: 2s; // ❌ Too long, blocks navigation
}

// ❌ NEVER: Forgetting progressive enhancement
<Link viewTransition>Go</Link> // Breaks in unsupported browsers
```

## Browser Support

| Browser | Same-Document | Cross-Document |
|---------|---------------|----------------|
| Chrome 111+ | ✅ | ✅ (126+) |
| Safari 18+ | ✅ | ✅ (18.2+) |
| Firefox | ❌ (in development) | ❌ |
| Edge 111+ | ✅ | ✅ (126+) |

## Key Decisions

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Transition trigger | Auto (MPA) | Manual (SPA) | **Manual** for SPAs, auto for MPAs |
| Animation duration | < 200ms | 200-400ms | **200-300ms** balance of UX and speed |
| Shared elements | CSS names | JS dynamic | **CSS** for static, **JS** for dynamic lists |
| Fallback | No animation | CSS fallback | **CSS fallback** animations |
| Reduced motion | Instant | Shorter animation | **Instant** (skip entirely) |

## Related Skills

- `motion-animation-patterns` - Framer Motion for complex animations
- `react-server-components-framework` - RSC navigation patterns
- `core-web-vitals` - Performance impact of transitions
- `a11y-testing` - Testing reduced motion support

## Capability Details

### same-document-transitions
**Keywords**: SPA, startViewTransition, React Router, viewTransition
**Solves**: Smooth page transitions in single-page apps

### cross-document-transitions
**Keywords**: MPA, @view-transition, pageswap, pagereveal
**Solves**: Transitions between separate HTML pages

### shared-element
**Keywords**: view-transition-name, morph, hero, image gallery
**Solves**: Shared element animations between pages

### navigation-api
**Keywords**: Navigation API, back/forward, intercept
**Solves**: Customize transitions based on navigation type

### fallback-patterns
**Keywords**: progressive enhancement, feature detection, @supports
**Solves**: Graceful degradation in unsupported browsers

## References

- `references/react-router-integration.md` - React Router 7.x patterns
- `references/mpa-transitions.md` - Cross-document transitions
- `scripts/view-transition-wrapper.tsx` - Transition wrapper component
