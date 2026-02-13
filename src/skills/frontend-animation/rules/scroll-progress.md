---
title: "Scroll: Progress & View Timeline"
category: scroll
impact: MEDIUM
---

# Scroll Progress with View Timeline

CSS `view()` function for animations triggered by element visibility in the viewport.

## view() Function

```css
/* Syntax: view(<axis> <inset>) */

/* Default -- block axis, no inset */
animation-timeline: view();

/* Inline axis (horizontal scroll) */
animation-timeline: view(inline);

/* With inset (shrink detection area) */
animation-timeline: view(block 100px 50px);
```

## Reveal on Scroll

```css
.reveal-on-scroll {
  animation: fade-slide-up linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}

@keyframes fade-slide-up {
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

## Animation Range Control

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
animation-range: entry 50% cover 50%;
```

```css
/* Fine-tune when animation runs */
.card {
  animation: scale-up linear both;
  animation-timeline: view();
  animation-range: entry 25% entry 75%;
}
```

## Named View Timelines with Scope

```css
/* Parent sets up the timeline scope */
.gallery {
  timeline-scope: --card-timeline;
}

/* Each card defines its view timeline */
.gallery-card {
  view-timeline-name: --card-timeline;
  view-timeline-axis: block;
}

/* Animate based on card visibility */
.gallery-card .image {
  animation: zoom-in linear both;
  animation-timeline: --card-timeline;
  animation-range: entry 0% cover 50%;
}

@keyframes zoom-in {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
```

## JavaScript ViewTimeline API

```typescript
const viewTimeline = new ViewTimeline({
  subject: element,
  axis: 'block',
  inset: [CSS.px(0), CSS.px(0)],
});

element.animate(
  [
    { opacity: 0, transform: 'scale(0.8)' },
    { opacity: 1, transform: 'scale(1)' },
  ],
  {
    timeline: viewTimeline,
    fill: 'both',
    rangeStart: 'entry 0%',
    rangeEnd: 'cover 50%',
  }
);
```

## React Integration

```tsx
import { useRef, useEffect } from 'react';

function useScrollAnimation(
  keyframes: Keyframe[],
  options: { timeline?: 'scroll' | 'view'; range?: string } = {}
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !('ScrollTimeline' in window)) return;

    const timeline = options.timeline === 'view'
      ? new ViewTimeline({ subject: element, axis: 'block' })
      : new ScrollTimeline({ source: document.documentElement, axis: 'block' });

    const animation = element.animate(keyframes, {
      timeline,
      fill: 'both',
      ...(options.range && {
        rangeStart: options.range.split(' ')[0],
        rangeEnd: options.range.split(' ')[1],
      }),
    });

    return () => animation.cancel();
  }, [keyframes, options.timeline, options.range]);

  return ref;
}

function RevealCard({ children }: { children: React.ReactNode }) {
  const ref = useScrollAnimation(
    [
      { opacity: 0, transform: 'translateY(50px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    { timeline: 'view', range: 'entry cover' }
  );

  return <div ref={ref}>{children}</div>;
}
```

## Anti-Patterns

```css
/* NEVER: Overly complex animation chains */
.element {
  animation: anim1, anim2, anim3, anim4, anim5;
  animation-timeline: view(), scroll(), view(), scroll(), view();
}

/* NEVER: Animate layout properties */
@keyframes bad {
  from { margin-top: 100px; height: 0; }
  to { margin-top: 0; height: auto; }
}
```
