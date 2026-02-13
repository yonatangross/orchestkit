---
title: "Transitions: Cross-Document"
category: transitions
impact: MEDIUM
---

# Cross-Document View Transitions

View transitions between separate HTML pages (MPA) using `@view-transition` rule, navigation events, and transition types.

## Enable Cross-Document Transitions

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

## Transition Types for Directional Navigation

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

/* Slide left transition (forward navigation) */
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

## Navigation Events (pageswap/pagereveal)

```tsx
useEffect(() => {
  const handlePageReveal = (event: PageRevealEvent) => {
    const transition = event.viewTransition;
    if (!transition) return;

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

## Custom CSS Transitions

```css
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

/* Shared element transition for product images */
::view-transition-group(product-hero) {
  animation-duration: 0.4s;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

## Browser Support

| Browser | Same-Document | Cross-Document |
|---------|---------------|----------------|
| Chrome 111+ | Yes | Yes (126+) |
| Safari 18+ | Yes | Yes (18.2+) |
| Firefox | In development | In development |
| Edge 111+ | Yes | Yes (126+) |

## Key Decisions

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Transition trigger | Auto (MPA) | Manual (SPA) | **Manual** for SPAs, **auto** for MPAs |
| Animation duration | < 200ms | 200-400ms | **200-300ms** for balance |
| Direction detection | CSS only | JS pagereveal | **JS pagereveal** for dynamic direction |

## Anti-Patterns

```css
/* NEVER: Excessively long cross-document transitions */
@view-transition {
  navigation: auto;
}
::view-transition-group(root) {
  animation-duration: 3s; /* Way too long for navigation */
}

/* NEVER: Missing @view-transition rule on target page */
/* Both source AND target pages need the rule */
```
