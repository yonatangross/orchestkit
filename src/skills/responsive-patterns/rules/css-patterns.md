---
title: CSS Responsive Patterns
impact: HIGH
impactDescription: Container queries, fluid typography, and modern CSS layout patterns for responsive design
tags: [css, responsive, container-queries, fluid-typography]
---

# CSS Responsive Patterns

## 1. Container Query Basics

```css
/* Define a query container */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* Style based on container width */
@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}

@container card (max-width: 399px) {
  .card {
    display: flex;
    flex-direction: column;
  }
}
```

## 2. Container Query Units (cqi, cqb)

```css
/* Use cqi (container query inline) over cqw */
.card-title {
  /* 5% of container's inline size */
  font-size: clamp(1rem, 5cqi, 2rem);
}

.card-content {
  /* Responsive padding based on container */
  padding: 2cqi;
}

/* cqb for block dimension (height-aware containers) */
.sidebar-item {
  height: 10cqb;
}
```

## 3. Fluid Typography with clamp()

```css
/* Accessible fluid typography */
:root {
  /* Base font respects user preferences (rem) */
  --font-size-base: 1rem;

  /* Fluid scale with min/max bounds */
  --font-size-sm: clamp(0.875rem, 0.8rem + 0.25vw, 1rem);
  --font-size-md: clamp(1rem, 0.9rem + 0.5vw, 1.25rem);
  --font-size-lg: clamp(1.25rem, 1rem + 1vw, 2rem);
  --font-size-xl: clamp(1.5rem, 1rem + 2vw, 3rem);
  --font-size-2xl: clamp(2rem, 1rem + 3vw, 4rem);
}

h1 { font-size: var(--font-size-2xl); }
h2 { font-size: var(--font-size-xl); }
h3 { font-size: var(--font-size-lg); }
p { font-size: var(--font-size-md); }
small { font-size: var(--font-size-sm); }
```

## 4. Container-Based Fluid Typography

```css
/* For component-scoped fluid text */
.widget {
  container-type: inline-size;
}

.widget-title {
  /* Fluid within container, respecting user rem */
  font-size: clamp(1rem, 0.5rem + 5cqi, 2rem);
}

.widget-body {
  font-size: clamp(0.875rem, 0.5rem + 3cqi, 1.125rem);
}
```

## 5. Mobile-First Breakpoints

```css
/* Mobile-first: start small, add complexity */
.layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Tablet and up */
@media (min-width: 768px) {
  .layout {
    flex-direction: row;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .layout {
    max-width: 1200px;
    margin-inline: auto;
  }
}
```

## 6. CSS Grid Responsive Patterns

```css
/* Auto-fit grid (fills available space) */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

/* Auto-fill grid (maintains minimum columns) */
.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 1rem;
}

/* Subgrid for nested alignment */
.card {
  display: grid;
  grid-template-rows: subgrid;
  grid-row: span 3;
}
```

## 7. Container Scroll-Queries (Chrome 126+)

```css
/* Query based on scroll state */
.scroll-container {
  container-type: scroll-state;
  container-name: scroller;
}

@container scroller scroll-state(scrollable: top) {
  .scroll-indicator-top {
    opacity: 0;
  }
}

@container scroller scroll-state(scrollable: bottom) {
  .scroll-indicator-bottom {
    opacity: 0;
  }
}
```
