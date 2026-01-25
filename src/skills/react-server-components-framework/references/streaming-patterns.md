# Streaming Patterns Reference

Streaming enables progressive rendering in React Server Components, showing content as it becomes available rather than waiting for the entire page.

## Why Streaming?

- **Faster Time to First Byte (TTFB)**: Start sending HTML immediately
- **Improved Largest Contentful Paint (LCP)**: Critical content appears sooner
- **Non-Blocking**: Slow data fetches don't block the entire page
- **Better User Experience**: Progressive loading feels faster

## Suspense Boundaries

Suspense defines loading boundaries for async operations:

```tsx
import { Suspense } from 'react'

export default function DashboardPage() {
  return (
    <div className="dashboard">
      {/* Immediate: Static content renders right away */}
      <Header />

      {/* Streamed: Each section loads independently */}
      <Suspense fallback={<MetricsSkeleton />}>
        <MetricsCards />
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <RecentOrders />
      </Suspense>
    </div>
  )
}
```

## Streaming Timeline

```
Time →
|----[Header renders]----------------------------------------->
|         |----[MetricsCards streams in]---------------------->
|              |----[RevenueChart streams in]----------------->
|                        |----[RecentOrders streams in]------->

User sees:
1. Header immediately
2. Skeletons for metrics, chart, orders
3. Each component replaces skeleton as data arrives
```

## Loading UI with loading.tsx

Next.js automatically wraps page content with Suspense using `loading.tsx`:

```tsx
// app/dashboard/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
      <div className="grid grid-cols-3 gap-4">
        <div className="h-32 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-200 rounded" />
      </div>
    </div>
  )
}

// app/dashboard/page.tsx
// This page will show loading.tsx while data fetches
export default async function DashboardPage() {
  const data = await fetchDashboardData()
  return <Dashboard data={data} />
}
```

## Skeleton Components

Create consistent loading states:

```tsx
// components/skeletons.tsx
export function CardSkeleton() {
  return (
    <div className="rounded-xl bg-gray-100 p-4 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-8 bg-gray-200 rounded w-3/4" />
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <tr>
      <td className="py-3"><div className="h-4 bg-gray-200 rounded w-24" /></td>
      <td className="py-3"><div className="h-4 bg-gray-200 rounded w-32" /></td>
      <td className="py-3"><div className="h-4 bg-gray-200 rounded w-16" /></td>
    </tr>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} />
        ))}
      </tbody>
    </table>
  )
}
```

## Nested Suspense Boundaries

Create granular loading experiences:

```tsx
export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <div>
      {/* Product info loads first */}
      <Suspense fallback={<ProductSkeleton />}>
        <ProductDetails id={params.id} />
      </Suspense>

      {/* Reviews can load later */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <ProductReviews productId={params.id} />
      </Suspense>

      {/* Recommendations load last (less critical) */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <RelatedProducts productId={params.id} />
      </Suspense>
    </div>
  )
}
```

## Streaming SSR Architecture

```
Browser Request
       ↓
┌──────────────────────────────────┐
│         Next.js Server           │
│                                  │
│  1. Start HTML stream            │
│  2. Send <head> and shell        │
│  3. Send Suspense fallbacks      │
│  4. As data resolves:            │
│     - Stream component HTML      │
│     - Include hydration script   │
│  5. Close HTML stream            │
│                                  │
└──────────────────────────────────┘
       ↓
Browser receives progressive HTML
```

## Parallel Streaming

Fetch data in parallel, stream as each resolves:

```tsx
// Async components for parallel data fetching
async function UserProfile({ userId }: { userId: string }) {
  const user = await getUser(userId)  // 200ms
  return <ProfileCard user={user} />
}

async function UserPosts({ userId }: { userId: string }) {
  const posts = await getPosts(userId)  // 500ms
  return <PostList posts={posts} />
}

async function UserAnalytics({ userId }: { userId: string }) {
  const analytics = await getAnalytics(userId)  // 1000ms
  return <AnalyticsChart data={analytics} />
}

// Page streams each component as it resolves
export default function UserPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <Suspense fallback={<ProfileSkeleton />}>
        <UserProfile userId={params.id} />  {/* Streams at ~200ms */}
      </Suspense>

      <Suspense fallback={<PostsSkeleton />}>
        <UserPosts userId={params.id} />  {/* Streams at ~500ms */}
      </Suspense>

      <Suspense fallback={<AnalyticsSkeleton />}>
        <UserAnalytics userId={params.id} />  {/* Streams at ~1000ms */}
      </Suspense>
    </div>
  )
}
```

## Partial Prerendering (PPR)

Mix static and dynamic content in a single route:

```tsx
// app/product/[id]/page.tsx
export const experimental_ppr = true

export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <div>
      {/* Static: Prerendered at build time */}
      <Header />
      <ProductNav />

      {/* Dynamic: Streamed at request time */}
      <Suspense fallback={<ProductSkeleton />}>
        <ProductDetails id={params.id} />
      </Suspense>

      {/* Dynamic: Personalized content */}
      <Suspense fallback={<CartSkeleton />}>
        <CartPreview />
      </Suspense>

      {/* Static: Footer prerendered */}
      <Footer />
    </div>
  )
}
```

### PPR Benefits

- Static shell serves instantly from CDN
- Dynamic content streams in Suspense boundaries
- Best of both static and dynamic rendering

## Error Boundaries with Streaming

Handle errors gracefully within streaming:

```tsx
// app/dashboard/error.tsx
'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="error-container">
      <h2>Dashboard failed to load</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

### Component-Level Error Handling

```tsx
import { ErrorBoundary } from 'react-error-boundary'

export default function DashboardPage() {
  return (
    <div>
      <Header />

      <ErrorBoundary fallback={<MetricsError />}>
        <Suspense fallback={<MetricsSkeleton />}>
          <MetricsCards />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary fallback={<ChartError />}>
        <Suspense fallback={<ChartSkeleton />}>
          <RevenueChart />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
```

## Loading State Best Practices

### Do: Match Loading State to Content Shape

```tsx
// GOOD: Skeleton matches actual content layout
function ArticleSkeleton() {
  return (
    <article className="space-y-4">
      <div className="h-8 bg-gray-200 rounded w-3/4" />  {/* Title */}
      <div className="h-4 bg-gray-200 rounded w-1/4" />  {/* Date */}
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded" />
        <div className="h-4 bg-gray-200 rounded" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
      </div>
    </article>
  )
}
```

### Do: Use Appropriate Granularity

```tsx
// TOO COARSE: One giant skeleton
<Suspense fallback={<FullPageSkeleton />}>
  <EntirePage />
</Suspense>

// TOO FINE: Too many skeletons (jarring)
<Suspense fallback={<TitleSkeleton />}>
  <Title />
</Suspense>
<Suspense fallback={<SubtitleSkeleton />}>
  <Subtitle />
</Suspense>

// JUST RIGHT: Logical content groups
<Suspense fallback={<HeaderSkeleton />}>
  <HeaderSection />
</Suspense>
<Suspense fallback={<ContentSkeleton />}>
  <MainContent />
</Suspense>
```

### Don't: Cause Layout Shift

```tsx
// BAD: Skeleton different size than content
function BadSkeleton() {
  return <div className="h-20" />  // Fixed height
}

// GOOD: Skeleton matches content dimensions
function GoodSkeleton() {
  return (
    <div className="min-h-[200px]">  // Matches content min-height
      <div className="animate-pulse">...</div>
    </div>
  )
}
```

## Streaming with Route Groups

Organize streaming boundaries by feature:

```
app/
  (marketing)/
    page.tsx          # Static, no streaming needed
    about/page.tsx
  (dashboard)/
    layout.tsx        # Shared dashboard shell
    loading.tsx       # Dashboard-wide loading
    analytics/
      page.tsx
      loading.tsx     # Analytics-specific loading
    settings/
      page.tsx
```

## Performance Tips

1. **Stream critical content first**: Place important content in early Suspense boundaries
2. **Use appropriate fallbacks**: Match skeleton to final content shape
3. **Avoid waterfall**: Use parallel data fetching within Suspense boundaries
4. **Consider PPR**: Use Partial Prerendering for mixed static/dynamic pages
5. **Test on slow connections**: Verify streaming works well on 3G networks