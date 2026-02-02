# Cache Components Reference

Cache Components is the unified caching architecture in Next.js 16 that replaces `experimental_ppr` with a declarative, component-level caching model using the `"use cache"` directive.

## Overview

Cache Components enables:
- **Declarative caching**: Mark functions and components as cacheable with `"use cache"`
- **Fine-grained control**: Set cache lifetimes with `cacheLife()`
- **On-demand invalidation**: Tag and invalidate cache entries with `cacheTag()` and `revalidateTag()`
- **PPR by default**: Partial Prerendering is the default rendering approach

## Configuration

Enable Cache Components in `next.config.ts`:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

---

## The "use cache" Directive

The `"use cache"` directive marks routes, components, or functions as cacheable.

### File Level

```tsx
// app/products/page.tsx
'use cache'

export default async function ProductsPage() {
  const products = await db.product.findMany()
  return <ProductList products={products} />
}
```

### Component Level

```tsx
async function CachedSidebar() {
  'use cache'
  const categories = await getCategories()
  return <Sidebar categories={categories} />
}
```

### Function Level

```tsx
async function getProducts() {
  'use cache'
  const res = await fetch('/api/products')
  return res.json()
}
```

---

## Cache Key Generation

Cache keys are automatically generated from:

1. **Build ID**: Unique per deployment
2. **Function ID**: Hash of function location and signature
3. **Serializable arguments**: Props or function arguments
4. **Closure values**: Variables captured from outer scope

```tsx
async function UserProducts({ userId }: { userId: string }) {
  const getProducts = async (category: string) => {
    'use cache'
    // Cache key includes:
    // - userId (closure)
    // - category (argument)
    return fetch(`/api/users/${userId}/products?cat=${category}`)
  }

  return getProducts('electronics')
}
```

---

## cacheLife() - Cache Duration Control

Control how long cached values remain valid.

### Built-in Profiles

```tsx
import { cacheLife } from 'next/cache'

async function getData() {
  'use cache'
  cacheLife('hours') // Built-in profile
  return fetch('/api/data')
}
```

| Profile | stale | revalidate | expire |
|---------|-------|------------|--------|
| `'seconds'` | 0 | 1s | 60s |
| `'minutes'` | 5m | 1m | 1h |
| `'hours'` | 5m | 1h | 1d |
| `'days'` | 5m | 1d | 1w |
| `'weeks'` | 5m | 1w | 1mo |
| `'max'` | 5m | 1mo | indefinite |

### Custom Profiles (next.config.ts)

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    blog: {
      stale: 3600,      // 1 hour client-side cache
      revalidate: 900,  // 15 min server revalidation
      expire: 86400,    // 1 day max age
    },
    products: {
      stale: 300,       // 5 minutes
      revalidate: 60,   // 1 minute
      expire: 3600,     // 1 hour
    },
  },
}

export default nextConfig
```

```tsx
// app/blog/page.tsx
import { cacheLife } from 'next/cache'

export default async function BlogPage() {
  'use cache'
  cacheLife('blog') // Use custom profile
  // ...
}
```

### Inline Configuration

```tsx
import { cacheLife } from 'next/cache'

async function getAnalytics() {
  'use cache'
  cacheLife({
    stale: 3600,      // 1 hour until considered stale
    revalidate: 7200, // 2 hours until revalidated
    expire: 86400,    // 1 day until expired
  })
  return fetch('/api/analytics')
}
```

### Cache Timing Properties

| Property | Description |
|----------|-------------|
| `stale` | Duration client caches without checking server |
| `revalidate` | Frequency server refreshes cache (serves stale during revalidation) |
| `expire` | Maximum duration before switching to dynamic (must be > revalidate) |

---

## cacheTag() - Cache Tagging and Invalidation

Tag cached data for on-demand invalidation.

### Tagging Cache Entries

```tsx
// app/data.ts
import { cacheTag } from 'next/cache'

async function getProducts() {
  'use cache'
  cacheTag('products')
  return fetch('/api/products')
}

async function getProduct(id: string) {
  'use cache'
  cacheTag('products', `product-${id}`) // Multiple tags
  return fetch(`/api/products/${id}`)
}
```

### Invalidating by Tag

```tsx
// app/actions.ts
'use server'

import { revalidateTag } from 'next/cache'

export async function updateProduct(id: string, data: ProductData) {
  await db.product.update({ where: { id }, data })

  revalidateTag('products')        // Invalidate all products
  revalidateTag(`product-${id}`)   // Invalidate specific product
}
```

### Immediate vs Stale-While-Revalidate

```tsx
import { updateTag, revalidateTag } from 'next/cache'

// Immediate update - cache cleared, next request fetches fresh
updateTag('cart')

// Stale-while-revalidate - serves stale, revalidates in background
revalidateTag('posts')
```

---

## Before and After: Next.js 15 vs 16

### Static Page

```tsx
// BEFORE (Next.js 15) - Route segment config
export const dynamic = 'force-static'
export const revalidate = 3600

export default async function Page() {
  const data = await fetch('/api/data')
  return <div>{data}</div>
}

// AFTER (Next.js 16) - use cache directive
import { cacheLife } from 'next/cache'

export default async function Page() {
  'use cache'
  cacheLife('hours')
  const data = await fetch('/api/data')
  return <div>{data}</div>
}
```

### ISR (Incremental Static Regeneration)

```tsx
// BEFORE (Next.js 15) - fetch options
async function getProducts() {
  const res = await fetch('/api/products', {
    next: { revalidate: 3600, tags: ['products'] }
  })
  return res.json()
}

// AFTER (Next.js 16) - use cache + cacheLife + cacheTag
import { cacheLife, cacheTag } from 'next/cache'

async function getProducts() {
  'use cache'
  cacheLife('hours')
  cacheTag('products')
  const res = await fetch('/api/products')
  return res.json()
}
```

### Partial Prerendering

```tsx
// BEFORE (Next.js 15) - experimental_ppr
export const experimental_ppr = true

export default function Page() {
  return (
    <div>
      <Header /> {/* Static */}
      <Suspense fallback={<Skeleton />}>
        <DynamicContent /> {/* Dynamic */}
      </Suspense>
    </div>
  )
}

// AFTER (Next.js 16) - PPR is default with cacheComponents
// No config needed - PPR is automatic
export default function Page() {
  return (
    <div>
      <Header /> {/* Automatically prerendered */}
      <Suspense fallback={<Skeleton />}>
        <DynamicContent /> {/* Streams at request time */}
      </Suspense>
    </div>
  )
}
```

### Tagged Revalidation

```tsx
// BEFORE (Next.js 15)
await fetch('/api/data', { next: { tags: ['my-tag'] } })

// Server Action
import { revalidateTag } from 'next/cache'
revalidateTag('my-tag')

// AFTER (Next.js 16) - cacheTag inside use cache
import { cacheTag } from 'next/cache'

async function getData() {
  'use cache'
  cacheTag('my-tag')
  return fetch('/api/data')
}

// Server Action (same API)
import { revalidateTag } from 'next/cache'
revalidateTag('my-tag')
```

---

## Integration with PPR

With Cache Components, Partial Prerendering is the default. Content is categorized as:

1. **Automatically prerendered**: Components without network/runtime dependencies
2. **Cached with `use cache`**: Components with external data, included in static shell
3. **Deferred with Suspense**: Runtime-dependent content, streams at request time

### Complete Example

```tsx
// app/blog/page.tsx
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { cacheLife, cacheTag } from 'next/cache'

export default function BlogPage() {
  return (
    <>
      {/* Static - automatically prerendered */}
      <Header />
      <Navigation />

      {/* Cached - included in static shell */}
      <BlogPosts />

      {/* Dynamic - streams at request time */}
      <Suspense fallback={<PreferencesSkeleton />}>
        <UserPreferences />
      </Suspense>
    </>
  )
}

// Cached: Shared by all users, revalidates hourly
async function BlogPosts() {
  'use cache'
  cacheLife('hours')
  cacheTag('posts')

  const posts = await db.post.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return (
    <section>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </section>
  )
}

// Dynamic: Personalized per user
async function UserPreferences() {
  const theme = (await cookies()).get('theme')?.value || 'light'
  const bookmarks = (await cookies()).get('bookmarks')?.value

  return (
    <aside className={`theme-${theme}`}>
      <h3>Your Bookmarks</h3>
      {bookmarks ? <BookmarkList ids={bookmarks} /> : <p>No bookmarks yet</p>}
    </aside>
  )
}
```

---

## Serialization Rules

### Supported Types (Arguments)

- Primitives: `string`, `number`, `boolean`, `null`, `undefined`
- Plain objects: `{ key: value }`
- Arrays: `[1, 2, 3]`
- `Date`, `Map`, `Set`, `TypedArray`, `ArrayBuffer`
- React elements (pass-through only)

### Unsupported Types

- Class instances
- Functions (except pass-through)
- Symbols, `WeakMap`, `WeakSet`
- `URL` instances

### Pass-Through Pattern

For non-serializable values like functions or React elements, pass them through without reading:

```tsx
async function CachedLayout({
  children,
  action
}: {
  children: React.ReactNode
  action: () => Promise<void>
}) {
  'use cache'

  // DO NOT call action() or read children
  // Just pass them through
  return (
    <div className="layout">
      <CachedHeader />
      {children}
      <form action={action}>
        <button type="submit">Submit</button>
      </form>
    </div>
  )
}
```

---

## Constraints

### Runtime APIs

Cannot directly access `cookies()`, `headers()`, or `searchParams` inside `use cache`. Read outside and pass as arguments:

```tsx
// WRONG
async function CachedComponent() {
  'use cache'
  const token = cookies().get('token') // Error!
}

// CORRECT
async function Parent() {
  const token = (await cookies()).get('token')?.value
  return <CachedComponent token={token} />
}

async function CachedComponent({ token }: { token: string }) {
  'use cache'
  // token is now part of cache key
  return <div>...</div>
}
```

### React.cache Isolation

Values from `React.cache` outside `use cache` are not visible inside:

```tsx
import { cache } from 'react'

const store = cache(() => ({ value: null as string | null }))

function Parent() {
  store().value = 'from parent'
  return <Child />
}

async function Child() {
  'use cache'
  // store().value is null - isolated scope
  return <div>{store().value}</div>
}
```

---

## Migration Checklist

| Old Pattern | New Pattern |
|-------------|-------------|
| `export const dynamic = 'force-static'` | `'use cache'` + `cacheLife('max')` |
| `export const dynamic = 'force-dynamic'` | Remove (default behavior) |
| `export const revalidate = 3600` | `cacheLife('hours')` or custom profile |
| `export const experimental_ppr = true` | Remove (PPR is default) |
| `fetch(..., { next: { revalidate } })` | `'use cache'` + `cacheLife()` |
| `fetch(..., { next: { tags } })` | `'use cache'` + `cacheTag()` |
| `export const fetchCache = '...'` | Remove (automatic with `use cache`) |

---

## Best Practices

### 1. Cache at the Right Level

```tsx
// Cache the data-fetching component, not the entire page
export default function Page() {
  return (
    <div>
      <StaticHeader />
      <CachedProductList /> {/* Cache here */}
      <Suspense fallback={<CartSkeleton />}>
        <DynamicCart /> {/* Runtime */}
      </Suspense>
    </div>
  )
}

async function CachedProductList() {
  'use cache'
  cacheLife('hours')
  const products = await getProducts()
  return <ProductGrid products={products} />
}
```

### 2. Use Appropriate Cache Profiles

```tsx
// Frequently changing data
cacheLife('seconds')  // API status, live scores

// Moderately changing data
cacheLife('minutes')  // Social feeds, news

// Slowly changing data
cacheLife('hours')    // Product catalogs, blog posts

// Rarely changing data
cacheLife('days')     // Documentation, legal pages

// Almost never changing
cacheLife('max')      // Static assets, archived content
```

### 3. Tag Strategically

```tsx
async function getProduct(id: string) {
  'use cache'
  cacheTag('products', `product-${id}`, `category-${product.categoryId}`)
  // Enables invalidation at multiple granularities
}

// Invalidate all products
revalidateTag('products')

// Invalidate one product
revalidateTag('product-123')

// Invalidate by category
revalidateTag('category-electronics')
```

### 4. Combine with Suspense for Mixed Content

```tsx
export default function Dashboard() {
  return (
    <>
      {/* Static shell */}
      <DashboardLayout>
        {/* Cached shared data */}
        <CachedMetrics />

        {/* User-specific, streams in */}
        <Suspense fallback={<NotificationsSkeleton />}>
          <UserNotifications />
        </Suspense>

        {/* Real-time, streams in */}
        <Suspense fallback={<ActivitySkeleton />}>
          <LiveActivity />
        </Suspense>
      </DashboardLayout>
    </>
  )
}
```

---

## Debugging

Enable verbose cache logging:

```bash
NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev
# or
NEXT_PRIVATE_DEBUG_CACHE=1 npm run start
```

In development, cached function console logs appear with `[Cache]` prefix.

---

## Platform Support

| Platform | Supported |
|----------|-----------|
| Node.js server | Yes |
| Docker container | Yes |
| Static export | No |
| Edge runtime | No |
| Vercel | Yes |
| Self-hosted | Yes |

---

## Common Pitfalls

### Build Hangs with Dynamic Promises

```tsx
// WRONG - Causes build hang
async function Cached({ promise }: { promise: Promise<unknown> }) {
  'use cache'
  const data = await promise // Waits forever during build
}

// CORRECT - Resolve outside, pass value
async function Parent() {
  const value = await getDynamicValue()
  return <Cached value={value} />
}

async function Cached({ value }: { value: string }) {
  'use cache'
  return <div>{value}</div>
}
```

### Mixing Cache Levels

```tsx
// WRONG - Nested use cache doesn't work as expected
async function Outer() {
  'use cache'
  return <Inner /> // Inner's cache is separate
}

async function Inner() {
  'use cache'
  // This has its own cache entry
}

// CORRECT - Cache at the appropriate level
async function Page() {
  return (
    <OuterCached>
      <InnerCached />
    </OuterCached>
  )
}
```

---

## Summary

| Feature | Purpose |
|---------|---------|
| `cacheComponents: true` | Enable Cache Components |
| `'use cache'` | Mark as cacheable |
| `cacheLife()` | Control cache duration |
| `cacheTag()` | Tag for invalidation |
| `revalidateTag()` | Invalidate by tag (stale-while-revalidate) |
| `updateTag()` | Invalidate by tag (immediate) |

Cache Components provides a declarative, component-level caching model that makes it easy to build fast, dynamic applications with fine-grained control over what gets cached and when.
