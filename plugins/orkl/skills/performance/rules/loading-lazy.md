---
title: Lazy Component Loading
impact: HIGH
impactDescription: "React.lazy defers component loading until render time, reducing initial bundle size and improving Time to Interactive"
tags: lazy, suspense, dynamic-import, skeleton, error-boundary, code-splitting
---

# Lazy Component Loading

Use `React.lazy` with `Suspense` to load components on demand and reduce initial bundle size.

## Basic Pattern

```tsx
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));
const Settings = lazy(() => import('./Settings'));

function App() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}
```

## Error Boundary for Failed Imports

```tsx
import { Component, lazy, Suspense } from 'react';

class LazyErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  retry = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return <button onClick={this.retry}>Retry</button>;
    }
    return this.props.children;
  }
}

// Usage
<LazyErrorBoundary fallback={<p>Failed to load</p>}>
  <Suspense fallback={<Skeleton />}>
    <LazyComponent />
  </Suspense>
</LazyErrorBoundary>
```

## Skeleton Fallback

```tsx
function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="h-64 bg-gray-200 rounded" />
    </div>
  );
}
```

**Incorrect — Missing Suspense fallback causes error:**
```tsx
const Dashboard = lazy(() => import('./Dashboard'));

function App() {
  return <Dashboard />; // Error: no Suspense boundary
}
```

**Correct — Suspense with skeleton fallback:**
```tsx
const Dashboard = lazy(() => import('./Dashboard'));

function App() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}
```

**Key rules:**
- **Wrap** every `lazy()` component in a `Suspense` boundary
- **Add** an error boundary around Suspense for network failures
- **Use** skeleton fallbacks that match the loaded component's layout
- **Never** lazy-load above-the-fold or LCP-critical components
- **Group** related lazy components under a single Suspense boundary
