# CSS Scroll Timeline Reference

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

## view() Function

```css
/* Syntax: view(<axis> <inset>) */

/* Default - block axis, no inset */
animation-timeline: view();

/* Inline axis (horizontal scroll) */
animation-timeline: view(inline);

/* With inset (shrink detection area) */
animation-timeline: view(block 100px 50px);

/* Auto inset */
animation-timeline: view(block auto);
```

## Animation Range

```css
/* Named ranges */
animation-range: entry;        /* Element entering viewport */
animation-range: exit;         /* Element exiting viewport */
animation-range: cover;        /* Full cover of viewport */
animation-range: contain;      /* Element fully visible */

/* Percentage within range */
animation-range: entry 0% entry 100%;
animation-range: cover 25% cover 75%;

/* Mixed */
animation-range: entry exit;
animation-range: entry 50% cover 50%;
```

## Named Timelines

```css
/* Define on scroll container */
.scroll-container {
  scroll-timeline-name: --main-scroll;
  scroll-timeline-axis: block;
}

/* Or shorthand */
.scroll-container {
  scroll-timeline: --main-scroll block;
}

/* Use in animation */
.animated-element {
  animation: fade-in linear;
  animation-timeline: --main-scroll;
}

/* Timeline scope for nested elements */
.parent {
  timeline-scope: --child-timeline;
}

.child {
  view-timeline-name: --child-timeline;
}

.sibling {
  animation-timeline: --child-timeline;
}
```

## Common Patterns

### Reading Progress Bar

```css
.progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background: var(--primary);
  transform-origin: left;
  animation: grow linear;
  animation-timeline: scroll(root);
}

@keyframes grow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
```

### Reveal on Scroll

```css
.reveal {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% cover 40%;
}

@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(100px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Parallax Background

```css
.parallax-container {
  position: relative;
  overflow: hidden;
}

.parallax-bg {
  position: absolute;
  inset: -30% 0;
  animation: parallax linear;
  animation-timeline: view();
}

@keyframes parallax {
  from { transform: translateY(0); }
  to { transform: translateY(60%); }
}
```
