---
title: "Scroll: Timeline"
category: scroll
impact: MEDIUM
---

# Scroll Timeline

CSS `scroll()` function and named scroll timelines for animations tied to scroll container position.

## scroll() Function

```css
/* Syntax: scroll(<scroller> <axis>) */

/* Root scroller, block axis (vertical) */
animation-timeline: scroll(root block);

/* Nearest scrollable ancestor */
animation-timeline: scroll(nearest inline);

/* Self (element is the scroller) */
animation-timeline: scroll(self);

/* Shorthand - defaults to nearest block */
animation-timeline: scroll();
```

## Reading Progress Bar

```css
.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 4px;
  background: var(--color-primary);
  transform-origin: left;

  animation: grow-progress linear;
  animation-timeline: scroll(root block);
}

@keyframes grow-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
```

## Named Scroll Timelines

```css
/* Define timeline on scroll container */
.scroll-container {
  overflow-y: auto;
  scroll-timeline-name: --container-scroll;
  scroll-timeline-axis: block;
}

/* Or shorthand */
.scroll-container {
  scroll-timeline: --container-scroll block;
}

/* Use timeline in descendant */
.progress-indicator {
  animation: progress linear;
  animation-timeline: --container-scroll;
}

@keyframes progress {
  from { width: 0%; }
  to { width: 100%; }
}
```

## Sticky Header Animation

```css
.header {
  position: sticky;
  top: 0;

  animation: shrink-header linear both;
  animation-timeline: scroll(root);
  animation-range: 0px 200px;
}

@keyframes shrink-header {
  from {
    padding-block: 2rem;
    background: transparent;
  }
  to {
    padding-block: 0.5rem;
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
  }
}
```

## JavaScript ScrollTimeline API

```typescript
const scrollTimeline = new ScrollTimeline({
  source: document.documentElement,
  axis: 'block',
});

element.animate(
  [
    { transform: 'translateY(100px)', opacity: 0 },
    { transform: 'translateY(0)', opacity: 1 },
  ],
  {
    timeline: scrollTimeline,
    fill: 'both',
  }
);
```

## Anti-Patterns

```css
/* NEVER: Scroll animations on non-scrollable containers */
.no-overflow {
  overflow: hidden;
  scroll-timeline-name: --timeline; /* Won't work! */
}

/* NEVER: Animate layout-triggering properties */
@keyframes bad {
  from { width: 0; margin-left: 100px; }
  to { width: 100%; margin-left: 0; }
}

/* NEVER: Use without progressive enhancement fallback */
.element {
  animation-timeline: scroll(); /* Breaks in Firefox! */
}
```
