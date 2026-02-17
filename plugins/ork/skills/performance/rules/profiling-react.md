---
title: React DevTools Profiler
impact: MEDIUM
impactDescription: "The React Profiler reveals exactly which components re-render, why, and how long they take — essential for targeted optimization"
tags: profiler, devtools, flamegraph, render, wdyr, why-did-you-render, react
---

# React DevTools Profiler

Use the React DevTools Profiler to identify and fix unnecessary re-renders.

## Flamegraph Workflow

```
1. Open React DevTools → Profiler tab
2. Click "Record" → Interact with the UI → Click "Stop"
3. Read the flamegraph:
   - Yellow/red bars = slow renders (> 16ms)
   - Gray bars = did not render
   - Click a bar → see "Why did this render?"
4. Focus on components that render often AND take long
```

## Programmatic Profiler

```tsx
import { Profiler } from 'react';

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
) {
  if (actualDuration > 16) {
    console.warn(`Slow render: ${id} (${phase}) took ${actualDuration.toFixed(1)}ms`);
  }
}

<Profiler id="Dashboard" onRender={onRenderCallback}>
  <Dashboard />
</Profiler>
```

## Why Did You Render Setup

```tsx
// wdyr.ts — import BEFORE React in development
import React from 'react';

if (process.env.NODE_ENV === 'development') {
  const { default: whyDidYouRender } = await import(
    '@welldone-software/why-did-you-render'
  );
  whyDidYouRender(React, {
    trackAllPureComponents: true,
    logOnDifferentValues: true,
  });
}

// Mark specific components for tracking
MyComponent.whyDidYouRender = true;
```

## Interpreting Render Reasons

```
"Props changed"       → Check which prop, was it a new object/array?
"State changed"       → Expected, verify state is colocated
"Parent rendered"     → Parent re-renders, child doesn't memo
"Context changed"     → Split context or use selectors
"Hooks changed"       → useMemo/useCallback dependency changed
```

**Incorrect — Blind memoization without profiling:**
```tsx
const MemoizedComponent = memo(Component);
const memoizedValue = useMemo(() => value, []);
const callback = useCallback(() => {}, []);
// Added optimization without measurement
```

**Correct — Profile first, then optimize actual bottlenecks:**
```tsx
// 1. Open React DevTools Profiler
// 2. Record interaction
// 3. Identify slow renders (yellow/red bars > 16ms)
// 4. Check "Why did this render?"
// 5. Apply targeted fix only where needed
```

**Key rules:**
- **Profile first** before adding any memoization
- **Focus** on components that are both frequent AND slow (> 16ms)
- **Use** "Why did this render?" to find the root cause
- **Use** Why Did You Render in development for automatic detection
- **Ignore** gray (not rendered) components in the flamegraph
