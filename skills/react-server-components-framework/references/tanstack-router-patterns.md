# React 19 + TanStack Router Patterns

> **SkillForge Supplement** (Dec 2025) - Patterns for React 19 applications using TanStack Router instead of Next.js App Router.

## Overview

While the main skill covers Next.js 15 + React Server Components, **SkillForge uses React 19 with TanStack Router**. This supplement documents the equivalent patterns for client-rendered SPAs with React 19's new features.

## Key Differences from Next.js RSC

| Pattern | Next.js 15 App Router | React 19 + TanStack Router |
|---------|----------------------|---------------------------|
| Data Fetching | Server Components | TanStack Query + route loaders |
| Mutations | Server Actions | React 19 `useActionState` + API calls |
| Optimistic UI | Experimental `useOptimistic` | React 19 `useOptimistic` (stable) |
| Transitions | `useTransition` | Same - `useTransition` |
| Promise Handling | `use()` in Server Components | `use()` in Client Components |
| Prefetching | Route segment prefetching | TanStack Router `defaultPreload: 'intent'` |

---

## Pattern 1: Route-Based Data Fetching

### TanStack Router with Query Integration

```tsx
// router.tsx
import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'

const queryClient = new QueryClient()

const rootRoute = createRootRoute({
  component: RootLayout,
})

const analysisRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'analyze/$analysisId',
  // ★ Prefetch with intent-based preloading
  loader: ({ params }) => {
    queryClient.prefetchQuery({
      queryKey: ['analysis', params.analysisId],
      queryFn: () => fetchAnalysis(params.analysisId),
      staleTime: 5 * 60 * 1000, // 5 minutes
    })
  },
  component: AnalysisPage,
})

export const router = createRouter({
  routeTree: rootRoute.addChildren([analysisRoute]),
  defaultPreload: 'intent',  // Preload on hover
  defaultPreloadDelay: 50,   // 50ms delay before preload
  defaultStaleTime: 5 * 60 * 1000, // 5 minutes
})
```

---

## Pattern 2: React 19 useOptimistic

### Optimistic Updates Without Server Actions

```tsx
import { useOptimistic, useTransition, useState } from 'react'

interface AnalysisCard {
  id: string
  title: string
  status: 'pending' | 'analyzing' | 'complete'
}

export function AnalysisList({ analyses }: { analyses: AnalysisCard[] }) {
  const [optimisticAnalyses, addOptimistic] = useOptimistic(
    analyses,
    (current, newAnalysis: AnalysisCard) => [...current, newAnalysis]
  )
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(url: string) {
    // Create optimistic placeholder
    const optimistic: AnalysisCard = {
      id: `temp-${Date.now()}`,
      title: url,
      status: 'pending',
    }

    startTransition(async () => {
      addOptimistic(optimistic)  // Show immediately

      const result = await createAnalysis({ url })  // Real API call
      // React reconciles automatically when analyses prop updates
    })
  }

  return (
    <div>
      {optimisticAnalyses.map(analysis => (
        <Card key={analysis.id} analysis={analysis} />
      ))}
    </div>
  )
}
```

---

## Pattern 3: useActionState for Form Handling

### React 19 Form Actions (Without Server Actions)

```tsx
import { useActionState, use } from 'react'
import { z } from 'zod'

const UrlSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
})

async function submitUrl(
  prevState: { error: string | null; success: boolean },
  formData: FormData
) {
  const result = UrlSchema.safeParse({ url: formData.get('url') })

  if (!result.success) {
    return { error: result.error.errors[0].message, success: false }
  }

  try {
    await api.post('/api/v1/analyses', { url: result.data.url })
    return { error: null, success: true }
  } catch (error) {
    return { error: 'Failed to start analysis', success: false }
  }
}

export function UrlInputForm() {
  const [state, formAction, isPending] = useActionState(submitUrl, {
    error: null,
    success: false,
  })

  return (
    <form action={formAction}>
      <input
        type="url"
        name="url"
        placeholder="https://example.com/article"
        disabled={isPending}
      />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Analyzing...' : 'Analyze'}
      </button>
      {state.error && <p className="error">{state.error}</p>}
    </form>
  )
}
```

---

## Pattern 4: use() Hook for Promise Handling

### Suspense-Based Data Fetching in Client Components

```tsx
import { use, Suspense } from 'react'

// Cache the promise at module level or use a query cache
const analysisPromise = fetchAnalysis(analysisId)

function AnalysisDetails({ analysisId }: { analysisId: string }) {
  // ★ use() unwraps promises in render, works with Suspense
  const analysis = use(analysisPromise)

  return (
    <div>
      <h1>{analysis.title}</h1>
      <p>Status: {analysis.status}</p>
    </div>
  )
}

// Usage with Suspense boundary
function AnalysisPage() {
  return (
    <Suspense fallback={<AnalysisSkeleton />}>
      <AnalysisDetails analysisId="123" />
    </Suspense>
  )
}
```

### With TanStack Query (Recommended)

```tsx
import { useSuspenseQuery } from '@tanstack/react-query'

function AnalysisDetails({ analysisId }: { analysisId: string }) {
  // useSuspenseQuery integrates with React 19's Suspense
  const { data: analysis } = useSuspenseQuery({
    queryKey: ['analysis', analysisId],
    queryFn: () => fetchAnalysis(analysisId),
  })

  return <div>{analysis.title}</div>
}
```

---

## Pattern 5: Prefetching Strategy

### Intent-Based Preloading

```tsx
// hooks/usePrefetch.ts
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'

export function usePrefetch() {
  const queryClient = useQueryClient()
  const router = useRouter()

  const prefetchAnalysis = useCallback((analysisId: string) => {
    // Prefetch route data
    router.preloadRoute({
      to: '/analyze/$analysisId',
      params: { analysisId },
    })

    // Prefetch query data
    queryClient.prefetchQuery({
      queryKey: ['analysis', analysisId],
      queryFn: () => fetchAnalysis(analysisId),
      staleTime: 5 * 60 * 1000,
    })
  }, [queryClient, router])

  return { prefetchAnalysis }
}

// Usage in component
function SkillCard({ skill }) {
  const { prefetchAnalysis } = usePrefetch()

  return (
    <Link
      to="/analyze/$analysisId"
      params={{ analysisId: skill.id }}
      onMouseEnter={() => prefetchAnalysis(skill.id)}
    >
      {skill.title}
    </Link>
  )
}
```

---

## Pattern 6: Exhaustive Type Checking

### assertNever for Type-Safe Switch Statements

```tsx
// lib/utils.ts
export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${JSON.stringify(value)}`)
}

// Usage in component
type AnalysisStatus = 'pending' | 'analyzing' | 'complete' | 'failed'

function StatusBadge({ status }: { status: AnalysisStatus }) {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>
    case 'analyzing':
      return <Badge variant="info">Analyzing</Badge>
    case 'complete':
      return <Badge variant="success">Complete</Badge>
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>
    default:
      // TypeScript error if new status added but not handled
      return assertNever(status, `Unhandled status: ${status}`)
  }
}
```

---

## SkillForge-Specific Patterns

### 1. SSE Event Handling with Zustand

```tsx
// stores/sseStore.ts
import { create } from 'zustand'

interface SSEEvent {
  event_id: string
  type: string
  data: unknown
}

interface SSEStore {
  events: Map<string, SSEEvent>  // O(1) deduplication
  addEvent: (event: SSEEvent) => void
}

export const useSSEStore = create<SSEStore>((set) => ({
  events: new Map(),
  addEvent: (event) => set((state) => {
    // O(1) lookup for deduplication
    if (state.events.has(event.event_id)) {
      return state  // Already processed
    }
    const newEvents = new Map(state.events)
    newEvents.set(event.event_id, event)
    return { events: newEvents }
  }),
}))
```

### 2. List Virtualization

```tsx
// components/VirtualizedGrid.tsx
import { useVirtualizer } from '@tanstack/react-virtual'

export function VirtualizedGrid<T>({ items, renderItem }: Props<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,  // Estimated row height
    overscan: 5,  // Render 5 extra items above/below viewport
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: virtualItem.start,
              width: '100%',
            }}
          >
            {renderItem(items[virtualItem.index])}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Migration Checklist

When migrating Next.js patterns to TanStack Router:

- [ ] Replace `use server` with client-side API calls + `useActionState`
- [ ] Replace `generateStaticParams` with route loader prefetching
- [ ] Replace `revalidatePath` with TanStack Query `invalidateQueries`
- [ ] Replace Next.js `Image` with native `<img>` + loading="lazy"
- [ ] Replace `cookies()`/`headers()` with browser APIs or API calls
- [ ] Replace `Metadata` exports with `document.title` or react-helmet

---

## References

- [React 19 Release Notes](https://react.dev/blog/2024/12/05/react-19)
- [TanStack Router Docs](https://tanstack.com/router/latest)
- [TanStack Query with Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense)
- [Zod Validation](https://zod.dev/)
