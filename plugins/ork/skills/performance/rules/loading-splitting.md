---
title: Route-Based Code Splitting
impact: HIGH
impactDescription: "Route-level splitting ensures users only download code for the page they visit, dramatically reducing initial load"
tags: code-splitting, routes, react-router, lazy-routes, chunks, webpack, rollup
---

# Route-Based Code Splitting

Split your bundle at route boundaries so each page loads only its own code.

## React Router 7.x Lazy Routes

```tsx
import { createBrowserRouter } from 'react-router';

const router = createBrowserRouter([
  {
    path: '/',
    lazy: () => import('./pages/Home'),
  },
  {
    path: '/dashboard',
    lazy: () => import('./pages/Dashboard'),
  },
  {
    path: '/settings',
    lazy: () => import('./pages/Settings'),
  },
]);
```

## Named Exports for Lazy Routes

```tsx
// pages/Dashboard.tsx — export Component and loader
export async function loader() {
  return fetchDashboardData();
}

export function Component() {
  const data = useLoaderData();
  return <DashboardView data={data} />;
}

Component.displayName = 'Dashboard';
```

## Chunk Naming

```tsx
// Webpack — webpackChunkName magic comment
const Dashboard = lazy(
  () => import(/* webpackChunkName: "dashboard" */ './pages/Dashboard')
);

// Vite/Rollup — use rollupOptions for manual chunks
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts', 'd3'],
        },
      },
    },
  },
});
```

**Key rules:**
- **Split** at route boundaries as the minimum splitting strategy
- **Use** React Router `lazy` for automatic route-level splitting
- **Export** `Component` and `loader` as named exports for lazy routes
- **Name** chunks for readable build output and caching
- **Group** vendor libraries into shared chunks to avoid duplication
