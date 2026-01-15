# Server Components Reference

React Server Components (RSC) represent a paradigm shift in React architecture, enabling server-first rendering with zero client JavaScript overhead.

## Why Server Components?

- **Server-First Architecture**: Components render on the server by default, reducing client bundle size
- **Zero Client Bundle**: Server Components don't ship JavaScript to the client
- **Direct Backend Access**: Access databases, file systems, and APIs directly from components
- **Automatic Code Splitting**: Only Client Components and their dependencies are bundled
- **Type-Safe Data Fetching**: End-to-end TypeScript from database to UI
- **SEO & Performance**: Server rendering improves Core Web Vitals and SEO

## Server Component Characteristics

Server Components (default in App Router):
- Can be `async` and use `await`
- Direct database/file system access
- Cannot use hooks (`useState`, `useEffect`, etc.)
- Cannot use browser APIs
- Zero client JavaScript
- Can import and render Client Components

## Async Server Components

```tsx
// app/posts/page.tsx
import { db } from '@/lib/db'

export default async function PostsPage() {
  // Direct database access - no API layer needed
  const posts = await db.post.findMany({
    orderBy: { createdAt: 'desc' },
    include: { author: true }
  })

  return (
    <div className="posts-grid">
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

## Data Fetching Patterns

### Basic Fetch with Caching

```tsx
// Static (cached indefinitely) - default in production
async function getProducts() {
  const res = await fetch('https://api.example.com/products')
  return res.json()
}

// Revalidate every 60 seconds (ISR)
async function getProducts() {
  const res = await fetch('https://api.example.com/products', {
    next: { revalidate: 60 }
  })
  return res.json()
}

// Always fresh (dynamic)
async function getProducts() {
  const res = await fetch('https://api.example.com/products', {
    cache: 'no-store'
  })
  return res.json()
}

// Tag-based revalidation
async function getProducts() {
  const res = await fetch('https://api.example.com/products', {
    next: { tags: ['products'] }
  })
  return res.json()
}
```

### Parallel Data Fetching

```tsx
// app/dashboard/page.tsx
export default async function DashboardPage() {
  // Parallel fetching - all requests start simultaneously
  const [user, posts, analytics] = await Promise.all([
    getUser(),
    getUserPosts(),
    getAnalytics()
  ])

  return (
    <Dashboard
      user={user}
      posts={posts}
      analytics={analytics}
    />
  )
}
```

### Sequential Data Fetching

```tsx
// When data depends on previous results
export default async function UserPostPage({ params }: { params: { userId: string } }) {
  // First fetch - get user
  const user = await getUser(params.userId)

  // Second fetch - depends on user data
  const posts = await getPostsByAuthor(user.id)

  // Third fetch - depends on posts
  const comments = await getCommentsForPosts(posts.map(p => p.id))

  return <UserPosts user={user} posts={posts} comments={comments} />
}
```

## Database Access from Server Components

```tsx
// Direct Prisma/Drizzle access
import { prisma } from '@/lib/prisma'

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      reviews: {
        take: 5,
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!product) {
    notFound()
  }

  return <ProductDetail product={product} />
}
```

## Route Segment Config

Control rendering mode at the route level:

```tsx
// app/products/page.tsx

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Force static rendering
export const dynamic = 'force-static'

// Set revalidation period
export const revalidate = 3600 // 1 hour

// Enable Partial Prerendering
export const experimental_ppr = true

export default async function ProductsPage() {
  const products = await getProducts()
  return <ProductList products={products} />
}
```

## generateStaticParams for SSG

Pre-render dynamic routes at build time:

```tsx
// app/posts/[slug]/page.tsx

export async function generateStaticParams() {
  const posts = await getAllPosts()

  return posts.map((post) => ({
    slug: post.slug,
  }))
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPostBySlug(params.slug)
  return <PostContent post={post} />
}
```

## Server Component Composition

### Passing Data Down

```tsx
// app/layout.tsx (Server Component)
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <html>
      <body>
        <Header user={user} />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
```

### Server Components with Client Children

```tsx
// app/dashboard/page.tsx (Server Component)
import { InteractiveChart } from './InteractiveChart' // Client Component

export default async function DashboardPage() {
  const data = await getChartData() // Server-side fetch

  return (
    <div>
      <h1>Dashboard</h1>
      {/* Pass server-fetched data to Client Component */}
      <InteractiveChart data={data} />
    </div>
  )
}
```

## Error Handling

```tsx
// app/posts/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}
```

## Best Practices

1. **Fetch data where it's used**: Colocate data fetching with components that need it
2. **Use parallel fetching**: When data is independent, use `Promise.all()`
3. **Set appropriate caching**: Match cache strategy to data freshness needs
4. **Handle errors gracefully**: Implement error.tsx at appropriate levels
5. **Use generateStaticParams**: Pre-render known dynamic routes
6. **Keep Server Components default**: Only use Client Components when necessary

## Common Pitfalls

### Avoid Client-Side Data Fetching

```tsx
// BAD: useEffect in Client Component
'use client'
export function Products() {
  const [products, setProducts] = useState([])
  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setProducts)
  }, [])
  return <ProductList products={products} />
}

// GOOD: Server Component
export default async function Products() {
  const products = await getProducts()
  return <ProductList products={products} />
}
```

### Don't Mix Async with Hooks

```tsx
// BAD: This won't work
export default async function Page() {
  const [state, setState] = useState() // Error!
  const data = await fetchData()
  return <div>{data}</div>
}

// GOOD: Separate concerns
export default async function Page() {
  const data = await fetchData()
  return <InteractiveWrapper data={data} /> // Client Component handles state
}
```