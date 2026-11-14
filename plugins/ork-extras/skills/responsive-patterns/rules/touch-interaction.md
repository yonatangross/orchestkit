---
title: Touch target sizing, thumb zones, and mobile interaction principles (Fitts's Law applied)
impact: HIGH
impactDescription: "Undersized touch targets, top-heavy navigation, and disabled pinch-to-zoom create unusable interfaces for mobile users and violate WCAG 2.5.8 accessibility requirements"
tags: [touch, mobile, touch-targets, thumb-zone, fitts-law, safe-area, pinch-to-zoom, wcag, mobile-first, breakpoints, gestures]
---

## Touch Interaction Principles

Apply Fitts's Law and thumb-zone ergonomics to make mobile interfaces fast, reachable, and accessible.

**Incorrect — blocked zoom and undersized targets:**
```html
<!-- WRONG: user-scalable=no and maximum-scale=1 are both WCAG violations -->
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
```
```css
/* WRONG: 24px icon with no padding — too small to tap reliably */
.icon-btn { width: 24px; height: 24px; }
```

**Correct — proper viewport and 44px minimum tap areas:**
```html
<!-- CORRECT: Never restrict zoom — users with low vision need it -->
<meta name="viewport" content="width=device-width, initial-scale=1">
```
```css
/* CORRECT: visual icon 24px, tappable area expanded to 44px via padding */
.icon-btn {
  width: 24px;
  height: 24px;
  padding: 10px; /* (24 + 20) = 44px tappable */
}

/* Primary buttons: 44px min (iOS HIG) / 48dp min (Material Design) */
.btn { min-height: 44px; padding: 0.75rem 1rem; }

/* WCAG 2.5.8 AA: 24x24px allowed only with 24px spacing buffer to nearest target */
.secondary-action { min-height: 24px; min-width: 24px; margin: 12px; }
```

**Thumb zone — bottom of screen is easy reach; top is hard:**
```tsx
// PRIMARY actions → bottom 1/3 (easy reach)
// SECONDARY actions → middle 1/3 (comfortable)
// STATUS / rarely-used → top 1/3 (hard reach)

// Bottom tab bar preferred over top nav on mobile
// FAB: bottom-right corner for right-handed majority
function BottomNav() {
  return (
    // Tailwind: fixed bottom bar respecting home indicator safe area
    <nav className="fixed bottom-0 inset-x-0 flex bg-background border-t border-border"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <NavItem href="/" icon={<HomeIcon />} label="Home" />
      <NavItem href="/search" icon={<SearchIcon />} label="Search" />
    </nav>
  )
}

function FAB({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg"
            style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
      <PlusIcon className="w-6 h-6" aria-hidden />
      <span className="sr-only">Create new</span>
    </button>
  )
}
```

**Safe areas and mobile-first breakpoints:**
```css
/* Landscape: side cutouts require left/right insets */
.content-area {
  padding-left:  max(1rem, env(safe-area-inset-left));
  padding-right: max(1rem, env(safe-area-inset-right));
}

/* Mobile-first: default styles are mobile, scale up with min-width */
/* 640px (sm) → 768px (md) → 1024px (lg) → 1280px (xl) → 1536px (2xl) */
.card { display: flex; flex-direction: column; }
@media (min-width: 1024px) { .card { flex-direction: row; } }
```

**Gestures — enhance, never require:**
```tsx
// CORRECT: swipe is optional; close button is always present
function BottomSheet({ onClose }: { onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true">
      <button onClick={onClose} className="min-h-11 min-w-11" aria-label="Close">
        <XIcon className="w-5 h-5" />
      </button>
      {/* Swipe-to-dismiss is progressive enhancement, not the only path */}
    </div>
  )
}
```

**Key rules:**
- Minimum touch target: 44x44px (iOS) / 48x48dp (Material) for all primary interactions
- WCAG 2.5.8 minimum: 24x24px when spacing buffer of 24px separates it from adjacent targets
- Icon buttons smaller than 44px must use `padding` or a pseudo-element to expand the tap area
- `user-scalable=no` and `maximum-scale=1` in viewport meta are WCAG accessibility violations — never use them
- Bottom 1/3 of screen = easy reach — primary actions and navigation belong here
- Prefer bottom tab bars over top navigation on mobile; FAB goes bottom-right
- Always pair swipe/long-press gestures with a visible button alternative
- Use `env(safe-area-inset-bottom)` on bottom nav and FABs to clear the home indicator
- Use `env(safe-area-inset-left/right)` in landscape to avoid side cutouts
- Never override native pinch-to-zoom behavior in CSS or JS
