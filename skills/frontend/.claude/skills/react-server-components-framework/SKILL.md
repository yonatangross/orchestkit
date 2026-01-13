---
name: react-server-components-framework
description: Use when building Next.js 16+ apps with React Server Components. Covers App Router, streaming SSR, Server Actions, and React 19 patterns for server-first architecture.
context: fork
agent: frontend-ui-developer
version: 1.3.0
author: AI Agent Hub
tags: [frontend, react, react-19.2, nextjs-16, server-components, streaming, 2026]
---

# React Server Components Framework

## Overview

React Server Components (RSC) represent a paradigm shift in React architecture, enabling server-first rendering with client-side interactivity. This skill provides comprehensive patterns, templates, and best practices for building modern Next.js 16 applications using the App Router with Server Components, Server Actions, and streaming.

**When to use this skill:**
- Building Next.js 16+ applications with the App Router
- Designing component boundaries (Server vs Client Components)
- Implementing data fetching with caching and revalidation
- Creating mutations with Server Actions
- Optimizing performance with streaming and Suspense
- Implementing Partial Prerendering (PPR)
- Designing advanced routing patterns (parallel, intercepting routes)

---

## Why React Server Components Matter

RSC fundamentally changes how we think about React applications:

- **Server-First Architecture**: Components render on the server by default, reducing client bundle size
- **Zero Client Bundle**: Server Components don't ship JavaScript to the client
- **Direct Backend Access**: Access databases, file systems, and APIs directly from components
- **Automatic Code Splitting**: Only Client Components and their dependencies are bundled
- **Streaming & Suspense**: Progressive rendering for instant perceived performance
- **Type-Safe Data Fetching**: End-to-end TypeScript from database to UI
- **SEO & Performance**: Server rendering improves Core Web Vitals and SEO

---

## Core Concepts

### 1. Server Components vs Client Components

**Server Components** (default):
- Can be `async` and use `await`
- Direct database access
- Cannot use hooks or browser APIs
- Zero client JavaScript

**Client Components** (with `'use client'`):
- Can use hooks (`useState`, `useEffect`, etc.)
- Browser APIs available
- Cannot be `async`
- Ships JavaScript to client

**Key Rule**: Server Components can render Client Components, but Client Components cannot directly import Server Components (use `children` prop instead).

**Detailed Patterns**: See `references/component-patterns.md` for:
- Complete component boundary rules
- Composition patterns
- Props passing strategies
- Common pitfalls and solutions

### 2. Data Fetching

Next.js extends the fetch API with powerful caching and revalidation:

```tsx
// Static (cached indefinitely)
await fetch(url, { cache: 'force-cache' })

// Revalidate every 60 seconds
await fetch(url, { next: { revalidate: 60 } })

// Always fresh
await fetch(url, { cache: 'no-store' })

// Tag-based revalidation
await fetch(url, { next: { tags: ['posts'] } })
```

**Patterns:**
- **Parallel fetching**: `Promise.all([fetch1, fetch2, fetch3])`
- **Sequential fetching**: When data depends on previous results
- **Route segment config**: Control static/dynamic rendering

**Detailed Implementation**: See `references/data-fetching.md` for:
- Complete caching strategies
- Revalidation methods (`revalidatePath`, `revalidateTag`)
- Database queries in Server Components
- generateStaticParams for SSG
- Error handling patterns

### 3. Server Actions

Server Actions enable mutations without API routes:

```tsx
// app/actions.ts
'use server'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  const post = await db.post.create({ data: { title } })

  revalidatePath('/posts')
  redirect("/posts/" + post.id)
}
```

**Progressive Enhancement**: Forms work without JavaScript, then enhance with client-side states.

**Detailed Implementation**: See `references/server-actions.md` for:
- Progressive enhancement patterns
- useFormStatus and useActionState hooks (React 19)
- Optimistic UI with useOptimistic + useTransition
- Validation with Zod
- Inline vs exported Server Actions

### 4. Streaming with Suspense

Stream components independently for better perceived performance:

```tsx
import { Suspense } from 'react'

export default function Dashboard() {
  return (
    <div>
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>

      <Suspense fallback={<InvoicesSkeleton />}>
        <LatestInvoices />
      </Suspense>
    </div>
  )
}
```

**Benefits**:
- Show content as it's ready
- Non-blocking data fetching
- Better Core Web Vitals

**Templates**: Use `templates/ServerComponent.tsx` for streaming patterns

### 5. Advanced Routing

**Parallel Routes**: Render multiple pages simultaneously
```
app/
  @team/page.tsx
  @analytics/page.tsx
  layout.tsx  # Receives both as props
```

**Intercepting Routes**: Show modals while preserving URLs
```
app/
  photos/[id]/page.tsx      # Direct route
  (..)photos/[id]/page.tsx  # Intercepted (modal)
```

**Partial Prerendering (PPR)**: Mix static and dynamic content
```tsx
export const experimental_ppr = true

// Static shell + dynamic Suspense boundaries
```

**Detailed Implementation**: See `references/routing-patterns.md` for:
- Parallel routes layout implementation
- Intercepting routes for modals
- PPR configuration and patterns
- Route groups for organization
- Dynamic, catch-all, and optional catch-all routes

---

## Searching References

Use grep to find specific patterns in references:

```bash
# Find component patterns
grep -r "Server Component" references/

# Search for data fetching strategies
grep -A 10 "Caching Strategies" references/data-fetching.md

# Find Server Actions examples
grep -B 5 "Progressive Enhancement" references/server-actions.md

# Locate routing patterns
grep -n "Parallel Routes" references/routing-patterns.md

# Search migration guide
grep -i "pages router\|getServerSideProps" references/migration-guide.md
```

---

## React 19.2 Patterns (2026+)

React 19.2 introduces significant changes to component patterns. This section covers the modernization requirements including new Activity component, useEffectEvent hook, and Partial Pre-rendering.

**Detailed Implementation**: See `references/react-19-patterns.md` for:
- Complete migration guide from React 18
- Code transformation examples
- Testing patterns for React 19 hooks

### 1. Function Declarations over React.FC

**React 19 deprecates `React.FC`** because it no longer includes `children` in props by default. Always use function declarations:

```tsx
// ❌ DEPRECATED (React 18 pattern)
export const Button: React.FC<ButtonProps> = ({ children, onClick }) => {
  return <button onClick={onClick}>{children}</button>
}

// ✅ RECOMMENDED (React 19 pattern)
export function Button({ children, onClick }: ButtonProps): React.ReactNode {
  return <button onClick={onClick}>{children}</button>
}

// ✅ ALSO VALID (arrow function without React.FC)
export const Button = ({ children, onClick }: ButtonProps): React.ReactNode => {
  return <button onClick={onClick}>{children}</button>
}
```

**Benefits**:
- Simpler type inference
- Explicit `children` in props when needed
- Better tree-shaking
- Clearer component signatures

### 2. Ref as Prop (Removal of forwardRef)

**React 19 removes the need for `forwardRef`**. Refs are now passed as regular props:

```tsx
// ❌ DEPRECATED (React 18 pattern)
import { forwardRef } from 'react'

const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <input ref={ref} {...props} />
})

// ✅ RECOMMENDED (React 19 pattern)
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement>
}

export function Input({ ref, ...props }: InputProps): React.ReactNode {
  return <input ref={ref} {...props} />
}
```

**Note**: For backwards compatibility during migration, you can support both patterns temporarily.

### 3. useActionState (replaces useFormState)

**`useActionState`** is the new API for form state management:

```tsx
'use client'

import { useActionState } from 'react'

interface FormState {
  message: string
  success: boolean
}

async function submitForm(prevState: FormState, formData: FormData): Promise<FormState> {
  const email = formData.get('email')
  // Process form...
  return { message: 'Submitted!', success: true }
}

export function ContactForm(): React.ReactNode {
  const [state, formAction, isPending] = useActionState(submitForm, {
    message: '',
    success: false
  })

  return (
    <form action={formAction}>
      <input name="email" type="email" disabled={isPending} />
      <SubmitButton />
      {state.message && <p>{state.message}</p>}
    </form>
  )
}
```

### 4. useFormStatus for Submit Buttons

```tsx
'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton(): React.ReactNode {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? 'Submitting...' : 'Submit'}
    </button>
  )
}
```

### 5. useOptimistic for Optimistic Updates

```tsx
'use client'

import { useOptimistic, useTransition } from 'react'

interface Item { id: string; name: string }

export function ItemList({ items }: { items: Item[] }): React.ReactNode {
  const [optimisticItems, addOptimisticItem] = useOptimistic(
    items,
    (state, newItem: Item) => [...state, newItem]
  )
  const [, startTransition] = useTransition()

  const handleAdd = async (item: Item) => {
    startTransition(() => {
      addOptimisticItem(item) // Immediate UI update
    })
    await saveItem(item) // Server mutation (auto-rollback on error)
  }

  return <ul>{optimisticItems.map(i => <li key={i.id}>{i.name}</li>)}</ul>
}
```

### 6. Activity Component (React 19.2 - NEW)

The `Activity` component enables preloading UI that users are likely to navigate to, improving perceived performance:

```tsx
'use client'

import { Activity, useState } from 'react'

export function TabPanel({ tabs }: { tabs: Tab[] }): React.ReactNode {
  const [activeTab, setActiveTab] = useState(tabs[0].id)

  return (
    <div>
      <nav>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {tabs.map(tab => (
        <Activity key={tab.id} mode={activeTab === tab.id ? 'visible' : 'hidden'}>
          <TabContent tab={tab} />
        </Activity>
      ))}
    </div>
  )
}
```

**Activity Modes:**
- `visible`: Shows children, mounts effects, processes updates normally
- `hidden`: Hides children, unmounts effects, defers updates until idle

**Use Cases:**
- Pre-render tabs user is likely to click
- Preserve form state when navigating away
- Background loading for faster perceived navigation

### 7. useEffectEvent Hook (React 19.2 - NEW)

Resolves dependency array complexity by defining callbacks outside Effect dependency tracking:

```tsx
'use client'

import { useEffect, useEffectEvent } from 'react'

export function ChatRoom({ roomId, theme }: { roomId: string; theme: string }): React.ReactNode {
  // This callback always reads fresh props/state but isn't a dependency
  const onMessage = useEffectEvent((message: Message) => {
    showNotification(message, theme) // Always uses current theme
  })

  useEffect(() => {
    const connection = createConnection(roomId)
    connection.on('message', onMessage)
    return () => connection.disconnect()
  }, [roomId]) // No need to include onMessage or theme!

  return <div>Chat Room: {roomId}</div>
}
```

**Benefits:**
- Cleaner useEffect dependencies
- No stale closure issues
- Functions always access fresh props/state

---

## Best Practices

### Component Boundary Design

- ✅ Keep Client Components at the edges (leaves) of the component tree
- ✅ Use Server Components by default
- ✅ Extract minimal interactive parts to Client Components
- ✅ Pass Server Components as `children` to Client Components
- ❌ Avoid making entire pages Client Components

### Data Fetching

- ✅ Fetch data in Server Components close to where it's used
- ✅ Use parallel fetching for independent data
- ✅ Set appropriate cache and revalidate options
- ✅ Use `generateStaticParams` for static routes
- ❌ Don't fetch data in Client Components with useEffect (use Server Components)

### Performance

- ✅ Use Suspense boundaries for streaming
- ✅ Implement loading.tsx for instant loading states
- ✅ Enable PPR for static/dynamic mix
- ✅ Optimize images with next/image
- ✅ Use route segment config to control rendering mode

### Error Handling

- ✅ Implement error.tsx for error boundaries
- ✅ Use not-found.tsx for 404 pages
- ✅ Handle fetch errors gracefully
- ✅ Validate Server Action inputs

---

## Templates

Use provided templates for common patterns:

- **`templates/ServerComponent.tsx`** - Basic async Server Component with data fetching
- **`templates/ClientComponent.tsx`** - Interactive Client Component with hooks
- **`templates/ServerAction.tsx`** - Server Action with validation and revalidation

---

## Examples

### Complete Blog App

See `examples/blog-app/` for a full implementation:
- Server Components for post listing and details
- Client Components for comments and likes
- Server Actions for creating/editing posts
- Streaming with Suspense
- Parallel routes for dashboard

---

## Checklists

### RSC Implementation Checklist

See `checklists/rsc-implementation.md` for comprehensive validation covering:
- [ ] Component boundaries properly defined (Server vs Client)
- [ ] Data fetching with appropriate caching strategy
- [ ] Server Actions for mutations
- [ ] Streaming with Suspense for slow components
- [ ] Error handling (error.tsx, not-found.tsx)
- [ ] Loading states (loading.tsx)
- [ ] Metadata API for SEO
- [ ] Route segment config optimized

---

## Common Patterns

### Search with URL State

```tsx
// app/search/page.tsx
export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const query = searchParams.q || ''
  const results = query ? await searchProducts(query) : []

  return (
    <div>
      <SearchForm initialQuery={query} />
      <SearchResults results={results} />
    </div>
  )
}
```

### Authentication

```tsx
import { cookies } from 'next/headers'

export default async function DashboardPage() {
  const token = cookies().get('token')?.value
  const user = await verifyToken(token)

  if (!user) {
    redirect('/login')
  }

  return <Dashboard user={user} />
}
```

### Optimistic UI

```tsx
'use client'

import { useOptimistic } from 'react'

export function TodoList({ todos }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo) => [...state, newTodo]
  )

  return <ul>{/* render optimisticTodos */}</ul>
}
```

---

## Migration from Pages Router

**Incremental Adoption**: Both `pages/` and `app/` can coexist

**Key Changes**:
- `getServerSideProps` → async Server Component
- `getStaticProps` → async Server Component with caching
- API routes → Server Actions
- `_app.tsx` → `layout.tsx`
- `<Head>` → `generateMetadata` function

**Detailed Migration**: See `references/migration-guide.md` for:
- Step-by-step migration guide
- Before/after code examples
- Common migration pitfalls
- Layout and metadata migration patterns

---

## Troubleshooting

**Error: "You're importing a component that needs useState"**
- **Fix**: Add `'use client'` directive to the component

**Error: "async/await is not valid in non-async Server Components"**
- **Fix**: Add `async` to function declaration

**Error: "Cannot use Server Component inside Client Component"**
- **Fix**: Pass Server Component as `children` prop instead of importing

**Error: "Hydration mismatch"**
- **Fix**: Use `'use client'` for components using `Date.now()`, `Math.random()`, or browser APIs

---

## Resources

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [React 19.2 Blog Post](https://react.dev/blog/2025/10/01/react-19-2)
- [React Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)
- [App Router Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
- [Server Actions Documentation](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)

---

## Next Steps

After mastering React Server Components:
1. Explore **Streaming API Patterns** skill for real-time data
2. Use **Type Safety & Validation** skill for tRPC integration
3. Apply **Edge Computing Patterns** skill for global deployment
4. Reference **Performance Optimization** skill for Core Web Vitals

## Capability Details

### react-19-patterns
**Keywords:** react 19, React.FC, forwardRef, useActionState, useFormStatus, useOptimistic, function declaration
**Solves:**
- How do I replace React.FC in React 19?
- forwardRef replacement pattern
- useActionState vs useFormState
- React 19 component declaration best practices
- Modernize React components for 2025

### use-hook-suspense
**Keywords:** use(), use hook, suspense, promise, data fetching, promise cache, cachePromise
**Solves:**
- How do I use the use() hook in React 19?
- Suspense-native data fetching pattern
- Promise caching to prevent infinite loops
- When to use use() vs TanStack Query
- use() hook infinite loop fix

### optimistic-updates-async
**Keywords:** useOptimistic, useTransition, optimistic update, instant ui, auto rollback, chat, messages
**Solves:**
- How to show instant UI updates before API responds?
- useOptimistic with useTransition pattern
- Optimistic updates for chat/messaging
- Auto-rollback on API failure
- Temp ID pattern for optimistic items

### rsc-patterns
**Keywords:** rsc, server component, client component, use client, use server
**Solves:**
- When to use server vs client components?
- RSC boundaries and patterns
- Server component best practices

### server-actions
**Keywords:** server action, form action, use server, mutation
**Solves:**
- How do I create a server action?
- Form handling with server actions
- Mutations in Next.js

### data-fetching
**Keywords:** fetch, data fetching, async component, loading, suspense
**Solves:**
- How do I fetch data in RSC?
- Async server components
- Suspense and loading states

### streaming-ssr
**Keywords:** streaming, ssr, suspense boundary, loading ui
**Solves:**
- How do I stream server content?
- Progressive loading patterns
- Streaming SSR setup

### caching
**Keywords:** cache, revalidate, static, dynamic, isr
**Solves:**
- How do I cache in Next.js 15?
- Revalidation strategies
- Static vs dynamic rendering

### tanstack-router-patterns
**Keywords:** tanstack router, react router, vite, spa, client rendering, prefetch, route loader, zustand, virtualization
**Solves:**
- How do I use React 19 features without Next.js?
- TanStack Router prefetching setup
- useOptimistic in client-rendered apps
- useActionState without server actions
- Route-based data fetching with TanStack Query
- SSE event handling with Zustand
- List virtualization with @tanstack/react-virtual
- assertNever exhaustive type checking
