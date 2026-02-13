import { lazy, Suspense, ComponentType, ReactNode, ComponentProps } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { motion } from 'motion/react';
import { pulse } from '@/lib/animations';

/**
 * Create a lazy-loaded component with Suspense boundary
 * @param importFn - Dynamic import function
 * @param fallback - Optional custom fallback component
 */
export function createLazyComponent<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: ReactNode
) {
  const LazyComponent = lazy(importFn);

  return function LazyWrapper(props: ComponentProps<T>) {
    return (
      <Suspense fallback={fallback || <DefaultSkeleton />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

/**
 * Default skeleton loading component
 */
function DefaultSkeleton() {
  return (
    <motion.div
      variants={pulse}
      initial="initial"
      animate="animate"
      className="h-32 w-full rounded-lg bg-muted"
      aria-label="Loading..."
    />
  );
}

/**
 * Lazy component with error boundary
 */
export function LazyWithErrorBoundary<T extends ComponentType<unknown>>({
  importFn,
  fallback,
  errorFallback,
  ...props
}: {
  importFn: () => Promise<{ default: T }>;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
} & ComponentProps<T>) {
  const LazyComponent = lazy(importFn);

  return (
    <ErrorBoundary fallback={errorFallback || <ErrorFallback />}>
      <Suspense fallback={fallback || <DefaultSkeleton />}>
        <LazyComponent {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

function ErrorFallback() {
  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
      <p className="text-sm text-destructive">Failed to load component</p>
    </div>
  );
}

// Example usage:
// const LazyChart = createLazyComponent(() => import('./Chart'), <ChartSkeleton />);
// <LazyChart data={data} />
