---
title: "View Transitions API"
impact: "HIGH"
impactDescription: "Without View Transitions API, page navigations cause full-page repaints with no visual continuity between states"
tags: [view-transitions, startViewTransition, viewTransitionName, react-router, cross-document]
---

## View Transitions API

The View Transitions API provides browser-native animated transitions between DOM states. It creates snapshots of old and new states, then crossfades between them using CSS animations.

**Incorrect:**
```tsx
// Manual DOM manipulation for page transitions — fragile, no browser optimization
function navigate(url: string) {
  const content = document.getElementById("content")!
  content.style.opacity = "0"
  setTimeout(async () => {
    const html = await fetch(url).then((r) => r.text())
    content.innerHTML = html
    content.style.opacity = "1"
  }, 300)
}
```

**Correct:**
```tsx
// View Transitions API — browser-optimized snapshots and CSS animations
async function navigate(url: string) {
  if (!document.startViewTransition) {
    // Fallback for unsupported browsers
    await updateDOM(url)
    return
  }

  const transition = document.startViewTransition(async () => {
    await updateDOM(url)
  })

  await transition.finished
}
```

### React Router Integration

```tsx
// React Router v7+ has built-in View Transitions support
import { Link, NavLink } from "react-router"

// Add viewTransition prop to enable transitions
<Link to="/about" viewTransition>About</Link>

// NavLink with viewTransition for navigation menus
<NavLink to="/dashboard" viewTransition className={({ isActive }) =>
  isActive ? "text-primary" : "text-muted"
}>
  Dashboard
</NavLink>
```

### Shared Element Transitions with CSS

```css
/* Name elements to create shared transitions across pages */
.product-image {
  view-transition-name: product-hero;
}

/* Customize the transition animation */
::view-transition-old(product-hero) {
  animation: fade-and-scale-out 250ms ease-out;
}

::view-transition-new(product-hero) {
  animation: fade-and-scale-in 250ms ease-in;
}

@keyframes fade-and-scale-out {
  to { opacity: 0; transform: scale(0.95); }
}

@keyframes fade-and-scale-in {
  from { opacity: 0; transform: scale(1.05); }
}
```

### Feature Detection

```tsx
function safeViewTransition(callback: () => void | Promise<void>) {
  if ("startViewTransition" in document) {
    document.startViewTransition(callback)
  } else {
    callback()
  }
}
```

**Key rules:**
- Always feature-detect `document.startViewTransition` before using it
- `viewTransitionName` values must be unique on the page at transition time
- View Transitions cannot be interrupted — once started, they run to completion
- Use CSS `::view-transition-old()` and `::view-transition-new()` for custom animations
- Keep transition animations under 300ms for navigation; users expect instant page loads
- Prefer React Router's `viewTransition` prop over manual `startViewTransition` calls

Reference: https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
