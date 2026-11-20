---
title: Support foldable and multi-screen devices with safe area insets and viewport segment queries
impact: MEDIUM
impactDescription: "Ignoring safe areas and foldable hinges causes content to be hidden behind notches, camera cutouts, or fold seams on modern devices"
tags: [foldable, dual-screen, safe-area, viewport-segments, multi-screen, notch]
---

## Foldable & Multi-Screen Devices

Use `env(safe-area-inset-*)` for notches/cutouts and viewport segment media queries for foldable-aware layouts.

**Incorrect — ignoring safe areas and foldable considerations:**
```css
/* WRONG: Content hidden behind notch or fold hinge */
.app-header {
  padding: 1rem;
  /* No safe area consideration — text hidden behind notch */
}

.main-content {
  display: flex;
  /* No awareness of fold seam — content split across hinge */
}
```

**Correct — safe area insets for notches and cutouts:**
```css
/* Respect device safe areas (notch, rounded corners, home indicator) */
.app-header {
  padding: 1rem;
  padding-top: max(1rem, env(safe-area-inset-top));
  padding-left: max(1rem, env(safe-area-inset-left));
  padding-right: max(1rem, env(safe-area-inset-right));
}

.app-footer {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}

/* Required: viewport-fit=cover in meta tag */
/* <meta name="viewport" content="..., viewport-fit=cover"> */
```

**Foldable dual-screen layouts with viewport segments:**
```css
/* Detect dual-screen horizontal fold (e.g., Surface Duo landscape) */
@media (horizontal-viewport-segments: 2) {
  .app-layout {
    display: grid;
    grid-template-columns:
      env(viewport-segment-width 0 0)
      calc(env(viewport-segment-left 1 0) - env(viewport-segment-right 0 0))
      env(viewport-segment-width 1 0);
  }

  .panel-left  { grid-column: 1; }
  .fold-gap    { grid-column: 2; } /* Hinge area — keep empty */
  .panel-right { grid-column: 3; }
}

/* Detect dual-screen vertical fold (e.g., Surface Duo portrait) */
@media (vertical-viewport-segments: 2) {
  .app-layout {
    display: grid;
    grid-template-rows:
      env(viewport-segment-height 0 0)
      calc(env(viewport-segment-top 0 1) - env(viewport-segment-bottom 0 0))
      env(viewport-segment-height 0 1);
  }

  .panel-top    { grid-row: 1; }
  .fold-gap     { grid-row: 2; }
  .panel-bottom { grid-row: 3; }
}
```

**Progressive enhancement for foldable support:**
```css
/* Base layout — works on all devices */
.app-layout {
  display: flex;
  flex-direction: column;
}

/* Enhanced: dual-screen aware only when supported */
@media (horizontal-viewport-segments: 2) {
  .app-layout {
    display: grid;
    /* ... dual-screen grid ... */
  }
}
```

**Testing foldable layouts:**
```
Chrome DevTools → Device toolbar → Select "Surface Duo" or "Galaxy Fold"
- Toggle fold posture (continuous / folded)
- Test both landscape and portrait orientations
- Verify content avoids the hinge/fold seam area
```

**Key rules:**
- Always use `env(safe-area-inset-*)` with `max()` to handle notches and cutouts
- Add `viewport-fit=cover` to the viewport meta tag to enable safe area insets
- Use `@media (horizontal-viewport-segments: 2)` for side-by-side foldable layouts
- Use `@media (vertical-viewport-segments: 2)` for top-bottom foldable layouts
- Keep the hinge/fold area empty — never place interactive content on the seam
- Test on Chrome DevTools foldable emulators (Surface Duo, Galaxy Fold)
- Use progressive enhancement — foldable styles layer on top of base layout
