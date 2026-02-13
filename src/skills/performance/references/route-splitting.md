# Route-Based Code Splitting

## React Router 7.x Lazy Routes

```tsx
import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';

// Define lazy routes
const routes = [
  {
    path: '/',
    lazy: () => import('./pages/Home'),
  },
  {
    path: '/dashboard',
    lazy: () => import('./pages/Dashboard'),
    children: [
      {
        path: 'analytics',
        lazy: () => import('./pages/Analytics'),
      },
      {
        path: 'settings',
        lazy: () => import('./pages/Settings'),
      },
    ],
  },
];

const router = createBrowserRouter(routes);
```

## Vite Manual Chunks

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router'],
          'query-vendor': ['@tanstack/react-query'],

          // Feature chunks (match route structure)
          'dashboard': [
            './src/pages/Dashboard',
            './src/pages/Analytics',
          ],
          'settings': [
            './src/pages/Settings',
            './src/pages/Profile',
          ],
        },
      },
    },
  },
});
```

## Prefetch on Route Hover

```tsx
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const prefetch = () => {
    // Prefetch route data
    queryClient.prefetchQuery({
      queryKey: ['route', to],
      queryFn: () => fetchRouteData(to),
    });
  };

  return (
    <Link
      to={to}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      preload="intent"
    >
      {children}
    </Link>
  );
}
```

## Bundle Size Monitoring

```bash
# After build, check chunk sizes
npx vite build
# Output shows chunk sizes

# For detailed analysis
npx vite-bundle-visualizer
```
