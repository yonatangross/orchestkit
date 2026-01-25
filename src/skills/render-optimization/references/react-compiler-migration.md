# React Compiler Migration Guide

Adopting React 19's automatic memoization.

## What is React Compiler?

React Compiler automatically memoizes components and values, eliminating the need for manual `useMemo`, `useCallback`, and `React.memo` in most cases.

## Prerequisites

- React 19+
- Compatible framework (Next.js 16+, Expo SDK 54+)
- Code follows Rules of React

## Quick Setup

### Next.js 16+

```javascript
// next.config.js
const nextConfig = {
  reactCompiler: true,
}

module.exports = nextConfig
```

### Expo SDK 54+

Enabled by default in new projects.

### Babel (Manual)

```bash
npm install -D babel-plugin-react-compiler
```

```javascript
// babel.config.js
module.exports = {
  plugins: [
    ['babel-plugin-react-compiler', {
      // Optional: sources to compile
      sources: (filename) => {
        return filename.indexOf('src') !== -1
      },
    }],
  ],
}
```

## Verification

1. Open React DevTools in browser
2. Go to Components tab
3. Look for **"Memo ✨"** badge next to component names
4. If you see the sparkle emoji, compiler is working

## What Gets Optimized

The compiler automatically memoizes:

| Before (Manual) | After (Compiler) |
|-----------------|------------------|
| `React.memo(Component)` | Component re-renders only when needed |
| `useMemo(() => value, [deps])` | Intermediate values cached |
| `useCallback(() => fn, [deps])` | Callback references stable |
| Conditional JSX | JSX elements memoized |

## Rules of React (Must Follow)

For the compiler to work correctly:

### 1. Components Must Be Idempotent
```tsx
// ✅ Same input → same output
function Profile({ user }) {
  return <h1>{user.name}</h1>
}

// ❌ Non-deterministic
function Profile({ user }) {
  return <h1>{user.name} at {Date.now()}</h1>
}
```

### 2. Props and State Are Immutable
```tsx
// ✅ Create new object
setUser({ ...user, name: 'New Name' })

// ❌ Mutate existing
user.name = 'New Name'
setUser(user)
```

### 3. Side Effects Outside Render
```tsx
// ✅ In useEffect
useEffect(() => {
  analytics.track('view')
}, [])

// ❌ During render
function Component() {
  analytics.track('view') // BAD
  return <div>...</div>
}
```

### 4. Hooks at Top Level
```tsx
// ✅ Always at top
function Component() {
  const [state, setState] = useState()
  // ...
}

// ❌ Conditional hooks
function Component({ show }) {
  if (show) {
    const [state, setState] = useState() // BAD
  }
}
```

## Migration Strategy

### New Projects
Enable compiler immediately. No reason not to.

### Existing Projects

1. **Enable compiler** in config
2. **Run tests** to catch issues
3. **Check DevTools** for Memo badges
4. **Gradually remove** manual memoization

```tsx
// Before (manual)
const MemoizedChild = React.memo(Child)
const memoizedValue = useMemo(() => compute(data), [data])
const handleClick = useCallback(() => onClick(id), [id, onClick])

// After (compiler handles it)
// Just use Child, compute(data), and onClick directly
// Compiler determines what needs memoization
```

## When Manual Memoization Still Needed

Keep `useMemo`/`useCallback` for:

```tsx
// 1. Effect dependencies that shouldn't trigger re-runs
const stableConfig = useMemo(() => ({
  apiUrl: process.env.API_URL,
  timeout: 5000,
}), [])

useEffect(() => {
  initSDK(stableConfig) // Should only run once
}, [stableConfig])

// 2. Third-party libraries without compiler support
const memoizedData = useMemo(() =>
  thirdPartyLib.transform(data), [data])

// 3. Precise control over boundaries
const handleSubmit = useCallback(async () => {
  // Complex async logic that must be stable
}, [criticalDep])
```

## Debugging Issues

### Component Not Getting Memo Badge

1. Check if file is in compiler's sources
2. Look for Rules of React violations
3. Check for unsupported patterns

### Performance Regression

1. Profile with React DevTools
2. Check if compiler skipped problematic code
3. Add manual memoization as escape hatch

## Compatibility Notes

- Works with existing `useMemo`/`useCallback` (won't double-memoize)
- Safe to leave existing memoization during migration
- Compiler output is equivalent to manual optimization
