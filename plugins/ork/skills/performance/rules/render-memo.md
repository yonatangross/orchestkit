---
title: Manual Memoization Escape Hatches
impact: HIGH
impactDescription: "When React Compiler can't handle a case, targeted useMemo/useCallback and state colocation prevent unnecessary re-renders"
tags: usememo, usecallback, memo, state-colocation, escape-hatch
---

# Manual Memoization Escape Hatches

Use `useMemo`/`useCallback` as escape hatches when React Compiler is insufficient.

## When Manual Memoization Is Needed

```tsx
// 1. Effect dependencies that shouldn't trigger re-runs
const stableConfig = useMemo(() => ({
  apiUrl: process.env.API_URL
}), [])

useEffect(() => {
  initializeSDK(stableConfig)
}, [stableConfig])

// 2. Third-party libraries without compiler support
const memoizedValue = useMemo(() =>
  expensiveThirdPartyComputation(data), [data])

// 3. Precise control over memoization boundaries
const handleClick = useCallback(() => {
  // Critical callback that must be stable
}, [dependency])
```

## State Colocation

Move state as close to where it's used as possible:

```tsx
// BAD: State too high - causes unnecessary re-renders
function App() {
  const [filter, setFilter] = useState('')
  return (
    <Header />  {/* Re-renders on filter change! */}
    <FilterInput value={filter} onChange={setFilter} />
    <List filter={filter} />
  )
}

// GOOD: State colocated - minimal re-renders
function App() {
  return (
    <Header />
    <FilterableList />  {/* State inside */}
  )
}
```

## Profiling Workflow

1. **React DevTools Profiler**: Record, interact, analyze
2. **Identify**: Components with high render counts or duration
3. **Verify**: Is the re-render actually causing perf issues?
4. **Fix**: Apply targeted optimization
5. **Measure**: Confirm improvement

**Incorrect — State too high causes unnecessary re-renders:**
```tsx
function App() {
  const [filter, setFilter] = useState('');
  return (
    <>
      <Header />  {/* Re-renders on filter change! */}
      <FilterInput value={filter} onChange={setFilter} />
      <List filter={filter} />
    </>
  );
}
```

**Correct — State colocated minimizes re-renders:**
```tsx
function App() {
  return (
    <>
      <Header />
      <FilterableList />  {/* State inside, Header unaffected */}
    </>
  );
}
```

## Key Rules

1. **Profile first** — never optimize without measurement
2. **Colocate state** as close to usage as possible
3. **Use** `useMemo` for effect dependencies that must be stable
4. **Use** `useCallback` for callbacks passed to memoized children
5. **Split** context into state and dispatch providers
