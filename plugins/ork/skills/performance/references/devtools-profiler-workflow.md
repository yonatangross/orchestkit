# React DevTools Profiler Workflow

Finding and fixing performance bottlenecks.

## Setup

1. Install React DevTools browser extension
2. Open DevTools (F12)
3. Navigate to **Profiler** tab
4. Ensure React is in development mode

## Basic Profiling Flow

### 1. Start Recording

- Click the blue **Record** button
- Perform the slow interaction
- Click **Stop**

### 2. Analyze the Flamegraph

The flamegraph shows component render times:

```
[App (2ms)]
├── [Header (0.5ms)]
├── [Sidebar (15ms)]  ← Slow!
│   ├── [NavItem (1ms)]
│   ├── [NavItem (1ms)]
│   └── [HeavyWidget (12ms)]  ← Found it!
└── [Content (1ms)]
```

### 3. Key Metrics

| Metric | Meaning |
|--------|---------|
| **Render time** | How long component took to render |
| **Commit time** | Time to apply changes to DOM |
| **Interactions** | What triggered the render |

## Reading the Profiler

### Color Coding

- **Gray**: Did not render
- **Blue/Teal**: Rendered (fast)
- **Yellow**: Rendered (medium)
- **Red/Orange**: Rendered (slow)

### "Why did this render?"

Enable in DevTools settings:
1. Click gear icon in Profiler
2. Check "Record why each component rendered"

Common reasons:
- Props changed
- State changed
- Parent rendered
- Context changed
- Hooks changed

## Identifying Problems

### Problem 1: Component Renders Too Often

Look for components that render on every interaction:

```
Render 1: [List (50ms)] - items changed ✓
Render 2: [List (50ms)] - items same, parent rendered ✗
Render 3: [List (50ms)] - items same, parent rendered ✗
```

**Solution**: Isolate state, use React.memo as escape hatch

### Problem 2: Single Render Too Slow

Look for wide bars in the flamegraph:

```
[SlowComponent (200ms)]
├── [Child1 (5ms)]
├── [Child2 (190ms)]  ← Find the slow child
│   └── [GrandChild (185ms)]  ← Root cause
└── [Child3 (5ms)]
```

**Solution**: Virtualize, lazy load, or optimize computation

### Problem 3: Cascading Re-renders

Many components re-render for one change:

```
[Parent] → [Child1] → [GrandChild1]
        → [Child2] → [GrandChild2]
        → [Child3] → [GrandChild3]
```

**Solution**: Move state down, split context

## Profiler Settings

Click the gear icon for options:

- **Record why each component rendered**: Essential for debugging
- **Hide commits below X ms**: Filter noise
- **Highlight updates**: Visual indicator during interaction

## Ranked View

Switch from Flamegraph to **Ranked** view:

```
1. HeavyWidget      12ms
2. Sidebar          3ms
3. NavItem          1ms
4. Content          1ms
5. Header           0.5ms
```

This shows components sorted by render time.

## Timeline View

Shows renders over time, useful for:
- Finding render cascades
- Identifying what triggered re-renders
- Seeing interaction-to-render timing

## Console Integration

```tsx
// Add profiling in code
import { Profiler } from 'react'

function onRenderCallback(
  id,           // Component tree id
  phase,        // "mount" | "update"
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) {
  console.log(`${id} ${phase}: ${actualDuration.toFixed(2)}ms`)
}

<Profiler id="Navigation" onRender={onRenderCallback}>
  <Navigation />
</Profiler>
```

## Quick Checklist

1. [ ] Record the slow interaction
2. [ ] Find the slowest component (ranked view)
3. [ ] Check why it rendered (DevTools setting)
4. [ ] Verify if render was necessary
5. [ ] Apply targeted fix
6. [ ] Re-profile to confirm improvement

## Common Fixes by Cause

| Why Rendered | Fix |
|--------------|-----|
| Props changed (but same value) | Check prop references |
| Parent rendered | Isolate state, split component |
| Context changed | Split context |
| Hooks changed | Check effect dependencies |
| State changed | Verify state is necessary |
