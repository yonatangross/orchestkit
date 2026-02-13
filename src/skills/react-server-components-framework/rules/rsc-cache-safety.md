---
title: "RSC: Cache Safety"
category: rsc
impact: CRITICAL
impactDescription: "Caching user-specific data without proper cache keys leaks private data across users. Accessing runtime APIs (cookies, headers) inside 'use cache' blocks causes build errors or stale data."
tags: [rsc, cache, security, use-cache, data-leak]
---

## RSC: Cache Safety

The `"use cache"` directive in Next.js 16 Cache Components generates cache keys from arguments, closures, and build ID. If user-specific data is fetched inside a cached function without a user-distinguishing key, the first user's response is served to every subsequent user. Runtime APIs (`cookies()`, `headers()`) cannot be called directly inside `"use cache"` blocks.

**Incorrect — runtime API inside cache:**
```tsx
async function CachedDashboard() {
  'use cache'
  const token = cookies().get('token') // Error: cookies() cannot be used inside 'use cache'
  const data = await fetchUserData(token)
  return <Dashboard data={data} />
}
```

**Correct — read runtime values outside, pass as arguments:**
```tsx
async function DashboardPage() {
  const token = (await cookies()).get('token')?.value ?? ''
  return <CachedDashboard token={token} />
}

async function CachedDashboard({ token }: { token: string }) {
  'use cache'
  // token is now part of the cache key — each user gets their own entry
  const data = await fetchUserData(token)
  return <Dashboard data={data} />
}
```

**Incorrect — awaiting dynamic promises inside cache:**
```tsx
async function Cached({ promise }: { promise: Promise<unknown> }) {
  'use cache'
  const data = await promise // Causes build hang — promise is not serializable
  return <div>{data}</div>
}
```

**Correct — resolve outside, pass the value:**
```tsx
async function Parent() {
  const value = await getDynamicValue()
  return <Cached value={value} />
}

async function Cached({ value }: { value: string }) {
  'use cache'
  return <div>{value}</div>
}
```

**Key rules:**
- Never call `cookies()`, `headers()`, or read `searchParams` inside a `"use cache"` block — read them in a parent component and pass as serializable arguments.
- Every argument passed to a cached function becomes part of the cache key. Include user-identifying values (userId, token) to prevent cross-user data leaks.
- Do not `await` dynamic Promises inside `"use cache"` — resolve them outside and pass the result.
- Nested `"use cache"` functions have isolated scopes; `React.cache` values from an outer function are not visible in an inner one. Cache at the appropriate level and compose via `children`.
- Use `cacheTag()` with user-scoped tags (e.g., `user-${userId}`) to enable targeted invalidation.

Reference: `references/cache-components.md` (Constraints, Common Pitfalls)
