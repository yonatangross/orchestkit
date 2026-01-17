# Memoization Escape Hatches

When to still use useMemo and useCallback with React Compiler.

## Overview

React Compiler handles most memoization automatically. Use manual memoization only as **escape hatches** for specific cases.

## Escape Hatch 1: Effect Dependencies

When a value is used as an effect dependency and you need precise control:

```tsx
// Problem: Effect runs on every render
function UserDashboard({ userId }) {
  const config = {
    userId,
    includeStats: true,
    format: 'detailed',
  }

  useEffect(() => {
    fetchData(config) // Runs every render! config is new object
  }, [config])
}

// Solution: Memoize the config
function UserDashboard({ userId }) {
  const config = useMemo(() => ({
    userId,
    includeStats: true,
    format: 'detailed',
  }), [userId]) // Only changes when userId changes

  useEffect(() => {
    fetchData(config)
  }, [config])
}
```

## Escape Hatch 2: Third-Party Libraries

Libraries without React Compiler support may expect stable references:

```tsx
// Some charting libraries compare references
function Chart({ data }) {
  // Ensure stable reference for library
  const chartOptions = useMemo(() => ({
    animation: true,
    responsive: true,
    data: transformData(data),
  }), [data])

  return <ThirdPartyChart options={chartOptions} />
}
```

## Escape Hatch 3: Expensive Computations

When you know a computation is expensive and want explicit control:

```tsx
function SearchResults({ items, query }) {
  // Explicitly expensive - want to ensure it's memoized
  const filteredItems = useMemo(() => {
    console.log('Filtering...')
    return items
      .filter(item => matchesQuery(item, query))
      .sort(complexSortFn)
      .slice(0, 100)
  }, [items, query])

  return <List items={filteredItems} />
}
```

## Escape Hatch 4: Referential Equality for Children

When passing objects/arrays to components that use referential equality:

```tsx
function Parent() {
  // Child component uses Object.is() comparison
  const contextValue = useMemo(() => ({
    theme: 'dark',
    locale: 'en',
  }), [])

  return (
    <MyContext.Provider value={contextValue}>
      <Children />
    </MyContext.Provider>
  )
}
```

## When NOT to Use Escape Hatches

### Don't Memoize Primitives

```tsx
// ❌ Unnecessary - primitives are already stable
const memoizedId = useMemo(() => props.id, [props.id])

// ✅ Just use it directly
<Child id={props.id} />
```

### Don't Memoize Simple JSX

```tsx
// ❌ Unnecessary with React Compiler
const memoizedButton = useMemo(() => (
  <Button onClick={handleClick}>Click</Button>
), [handleClick])

// ✅ Compiler handles this
<Button onClick={handleClick}>Click</Button>
```

### Don't Memoize Everything "Just in Case"

```tsx
// ❌ Over-memoization
function Component({ user }) {
  const name = useMemo(() => user.name, [user.name])
  const email = useMemo(() => user.email, [user.email])
  const avatar = useMemo(() => user.avatar, [user.avatar])

  return <Profile name={name} email={email} avatar={avatar} />
}

// ✅ Trust the compiler
function Component({ user }) {
  return <Profile name={user.name} email={user.email} avatar={user.avatar} />
}
```

## useCallback Escape Hatches

### Stable Event Handlers for Effects

```tsx
function DataFetcher({ onDataLoaded }) {
  // Need stable reference for effect dependency
  const stableCallback = useCallback(
    (data) => onDataLoaded(data),
    [onDataLoaded]
  )

  useEffect(() => {
    fetchData().then(stableCallback)
  }, [stableCallback])
}
```

### Refs in Callbacks

```tsx
function Form() {
  const inputRef = useRef<HTMLInputElement>(null)

  // Callback that uses ref - may need stability
  const focusInput = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <>
      <input ref={inputRef} />
      <Button onClick={focusInput}>Focus</Button>
    </>
  )
}
```

## Decision Tree

```
Is it an effect dependency?
├─ YES → Does the effect need to run less often?
│        └─ YES → useMemo/useCallback
└─ NO → Is it passed to a third-party library?
        ├─ YES → Check library docs, may need useMemo
        └─ NO → Is it a known expensive computation?
                ├─ YES → Consider useMemo for explicit control
                └─ NO → Trust React Compiler
```

## Verifying Compiler Coverage

```tsx
// In development, check DevTools for Memo badge
// If component doesn't have badge, compiler may have skipped it

// You can also add console logs to verify:
const value = useMemo(() => {
  console.log('Computing...') // Should only log when deps change
  return expensiveComputation()
}, [deps])
```
