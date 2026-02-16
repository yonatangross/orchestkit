---
title: INP Optimization
impact: CRITICAL
impactDescription: "Interaction to Next Paint measures responsiveness — poor INP causes sluggish button clicks and interactions"
tags: inp, interaction, responsiveness, long-task, transition, yield, scheduler
---

# INP Optimization

Optimize Interaction to Next Paint for the 2026 threshold of <= 150ms.

## Break Up Long Tasks

```typescript
// BAD: Long synchronous task (blocks main thread)
function processLargeArray(items: Item[]) {
  items.forEach(processItem); // Blocks for entire duration
}

// GOOD: Yield to main thread
async function processLargeArray(items: Item[]) {
  for (const item of items) {
    processItem(item);
    if (performance.now() % 50 < 1) {
      await scheduler.yield?.() ?? new Promise(r => setTimeout(r, 0));
    }
  }
}
```

## Use Transitions for Non-Urgent Updates

```typescript
import { useTransition, useDeferredValue } from 'react';

function SearchResults() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    // Urgent: Update input immediately
    setQuery(e.target.value);

    // Non-urgent: Defer expensive filter
    startTransition(() => {
      setFilteredResults(filterResults(e.target.value));
    });
  };

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending && <Spinner />}
      <ResultsList results={filteredResults} />
    </>
  );
}
```

## Optimize Event Handlers

```typescript
// BAD: Heavy computation in click handler
<button onClick={() => {
  const result = heavyComputation(); // Blocks paint
  setResult(result);
}}>Calculate</button>

// GOOD: Defer heavy work
<button onClick={() => {
  setLoading(true);
  requestIdleCallback(() => {
    const result = heavyComputation();
    setResult(result);
    setLoading(false);
  });
}}>Calculate</button>
```

**Incorrect — Blocking click handler delays visual feedback:**
```tsx
<button onClick={() => {
  const result = heavyComputation(); // Blocks paint
  setResult(result);
}}>Calculate</button>
```

**Correct — Deferred work keeps UI responsive:**
```tsx
<button onClick={() => {
  setLoading(true);
  requestIdleCallback(() => {
    const result = heavyComputation();
    setResult(result);
    setLoading(false);
  });
}}>Calculate</button>
```

## Key Rules

1. **Break** long tasks > 50ms with `scheduler.yield()`
2. **Use** `useTransition` for non-urgent state updates
3. **Defer** heavy computation with `requestIdleCallback`
4. **Never** block the main thread in event handlers
5. **Use** `useDeferredValue` for expensive derived values
6. Target **<= 150ms** for 2026 thresholds
