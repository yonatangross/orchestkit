# tRPC Setup and Patterns

Complete guide to building type-safe APIs with tRPC v11+.

## Core Concepts

tRPC provides end-to-end type safety between server and client without code generation:
- **Routers**: Group related procedures
- **Procedures**: Individual API endpoints (query/mutation/subscription)
- **Context**: Shared data across procedures (auth, db, etc.)
- **Middleware**: Logic that runs before procedures

## Server Setup

### Initialize tRPC
```typescript
// server/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server'
import type { CreateNextContextOptions } from '@trpc/server/adapters/next'
import { ZodError } from 'zod'
import superjson from 'superjson'

// Context type
export interface Context {
  userId?: string
  db: PrismaClient
  req: Request
}

// Create context from request
export async function createContext(
  opts: CreateNextContextOptions
): Promise<Context> {
  const token = opts.req.headers.get('authorization')?.replace('Bearer ', '')
  const userId = token ? await verifyToken(token) : undefined

  return {
    userId,
    db: prisma,
    req: opts.req
  }
}

// Initialize tRPC with context type
const t = initTRPC.context<Context>().create({
  transformer: superjson, // Serialize Date, Map, Set, etc.
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    }
  },
})

// Export reusable pieces
export const router = t.router
export const publicProcedure = t.procedure
export const middleware = t.middleware
```

### Middleware for Authentication
```typescript
// server/trpc.ts (continued)

// Auth middleware
const enforceAuth = middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in'
    })
  }

  return next({
    ctx: {
      userId: ctx.userId, // Now guaranteed non-null
    },
  })
})

// Protected procedure (requires auth)
export const protectedProcedure = publicProcedure.use(enforceAuth)

// Rate limiting middleware
const rateLimit = middleware(async ({ ctx, next, path }) => {
  const key = `rate-limit:${ctx.userId || 'anon'}:${path}`
  const count = await redis.incr(key)

  if (count === 1) {
    await redis.expire(key, 60) // 60 second window
  }

  if (count > 100) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded'
    })
  }

  return next()
})

export const rateLimitedProcedure = publicProcedure.use(rateLimit)
```

## Router Structure

### Basic Router
```typescript
// server/routers/_app.ts
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { z } from 'zod'
import { userRouter } from './user'
import { postRouter } from './post'

export const appRouter = router({
  // Inline procedures
  hello: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { greeting: `Hello ${input.name}!` }
    }),

  // Nested routers
  user: userRouter,
  post: postRouter,
})

// Export type for client
export type AppRouter = typeof appRouter
```

### Nested Router Example
```typescript
// server/routers/post.ts
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'

const PostInputSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional(),
  published: z.boolean().default(false),
  tags: z.array(z.string()).max(10)
})

export const postRouter = router({
  // List posts with cursor pagination
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(10),
      cursor: z.string().optional(),
      published: z.boolean().optional()
    }))
    .query(async ({ ctx, input }) => {
      const posts = await ctx.db.post.findMany({
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        where: { published: input.published },
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, name: true }
          }
        }
      })

      let nextCursor: string | undefined
      if (posts.length > input.limit) {
        const nextItem = posts.pop()
        nextCursor = nextItem!.id
      }

      return {
        items: posts,
        nextCursor
      }
    }),

  // Get single post
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.db.post.findUnique({
        where: { id: input.id },
        include: {
          author: true,
          comments: {
            orderBy: { createdAt: 'desc' }
          }
        }
      })

      if (!post) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Post not found'
        })
      }

      return post
    }),

  // Create post (protected)
  create: protectedProcedure
    .input(PostInputSchema)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.post.create({
        data: {
          ...input,
          authorId: ctx.userId
        }
      })
    }),

  // Update post (protected)
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: PostInputSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership
      const post = await ctx.db.post.findUnique({
        where: { id: input.id }
      })

      if (!post || post.authorId !== ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot update this post'
        })
      }

      return await ctx.db.post.update({
        where: { id: input.id },
        data: input.data
      })
    }),

  // Delete post (protected)
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership
      const post = await ctx.db.post.findUnique({
        where: { id: input.id }
      })

      if (!post || post.authorId !== ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot delete this post'
        })
      }

      await ctx.db.post.delete({
        where: { id: input.id }
      })

      return { success: true }
    })
})
```

## Client Setup

### Next.js App Router Setup
```typescript
// app/_trpc/client.ts
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/routers/_app'

export const trpc = createTRPCReact<AppRouter>()

// app/_trpc/Provider.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { useState } from 'react'
import superjson from 'superjson'
import { trpc } from './client'

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 1000, // 5 seconds
        refetchOnWindowFocus: false
      }
    }
  }))

  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        httpBatchLink({
          url: '/api/trpc',
          headers() {
            const token = localStorage.getItem('token')
            return token ? { authorization: `Bearer ${token}` } : {}
          }
        })
      ]
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
}
```

### Next.js API Handler
```typescript
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/routers/_app'
import { createContext } from '@/server/trpc'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  })

export { handler as GET, handler as POST }
```

## Client Usage Patterns

### Queries
```typescript
'use client'

import { trpc } from '@/app/_trpc/client'

export function PostList() {
  // Basic query
  const { data, isLoading, error } = trpc.post.list.useQuery({
    limit: 10,
    published: true
  })

  // Query with options
  const { data: post } = trpc.post.byId.useQuery(
    { id: postId },
    {
      enabled: !!postId, // Only run when postId exists
      refetchInterval: 5000, // Refetch every 5s
      retry: 3
    }
  )

  // Infinite query (cursor pagination)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = trpc.post.list.useInfiniteQuery(
    { limit: 10 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor
    }
  )

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      {data?.items.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  )
}
```

### Mutations
```typescript
'use client'

import { trpc } from '@/app/_trpc/client'

export function CreatePostForm() {
  const utils = trpc.useUtils()

  const createPost = trpc.post.create.useMutation({
    // Optimistic update
    onMutate: async (newPost) => {
      await utils.post.list.cancel()

      const previous = utils.post.list.getData()

      utils.post.list.setData(
        { limit: 10 },
        (old) => old ? {
          ...old,
          items: [newPost as any, ...old.items]
        } : old
      )

      return { previous }
    },

    // Revert on error
    onError: (err, newPost, context) => {
      utils.post.list.setData({ limit: 10 }, context?.previous)
    },

    // Refetch on success
    onSuccess: () => {
      utils.post.list.invalidate()
    }
  })

  const handleSubmit = (data: FormData) => {
    createPost.mutate({
      title: data.get('title') as string,
      content: data.get('content') as string,
      published: false,
      tags: []
    })
  }

  return (
    <form action={handleSubmit}>
      <input name="title" required />
      <textarea name="content" />
      <button type="submit" disabled={createPost.isPending}>
        {createPost.isPending ? 'Creating...' : 'Create Post'}
      </button>
      {createPost.error && (
        <div>Error: {createPost.error.message}</div>
      )}
    </form>
  )
}
```

### Server Components (Next.js)
```typescript
// app/posts/page.tsx
import { createCaller } from '@/server/routers/_app'
import { createContext } from '@/server/trpc'

export default async function PostsPage() {
  // Create server-side caller
  const caller = createCaller(await createContext({
    req: new Request('http://localhost:3000')
  } as any))

  // Directly call procedures
  const posts = await caller.post.list({ limit: 10 })

  return (
    <div>
      {posts.items.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  )
}
```

## Advanced Patterns

### Subscriptions (WebSocket)
```typescript
// Server
export const postRouter = router({
  onNewPost: publicProcedure
    .subscription(() => {
      return observable<Post>((emit) => {
        const listener = (post: Post) => emit.next(post)

        eventEmitter.on('post:created', listener)

        return () => {
          eventEmitter.off('post:created', listener)
        }
      })
    })
})

// Client
const { data } = trpc.post.onNewPost.useSubscription(undefined, {
  onData(post) {
    console.log('New post:', post)
  }
})
```

### Batching
```typescript
// Automatic request batching
const [user, posts, comments] = await Promise.all([
  trpc.user.byId.query({ id: '1' }),
  trpc.post.list.query({ limit: 10 }),
  trpc.comment.recent.query({ limit: 5 })
])
// Sent as single HTTP request!
```

### Prefetching
```typescript
// Prefetch in server component
export default async function Page() {
  const caller = createCaller(await createContext(...))

  await Promise.all([
    caller.post.list.prefetch({ limit: 10 }),
    caller.user.me.prefetch()
  ])

  return <HydrateClient><ClientComponent /></HydrateClient>
}
```

## Error Handling

```typescript
// Custom error types
class CustomTRPCError extends TRPCError {
  constructor(message: string, code: TRPC_ERROR_CODE_KEY = 'INTERNAL_SERVER_ERROR') {
    super({ code, message })
  }
}

// Client-side error handling
const { error } = trpc.post.create.useMutation()

if (error) {
  if (error.data?.code === 'UNAUTHORIZED') {
    router.push('/login')
  } else if (error.data?.zodError) {
    // Handle validation errors
    const fieldErrors = error.data.zodError.fieldErrors
  } else {
    toast.error(error.message)
  }
}
```

## Best Practices

1. **Use nested routers** - Organize by domain (user, post, comment)
2. **Validate all inputs** - Use Zod schemas for type safety + runtime validation
3. **Use middleware** - DRY auth, logging, rate limiting
4. **Enable batching** - Combine multiple requests into one
5. **Use superjson** - Serialize Date, Map, Set automatically
6. **Type-safe errors** - Format Zod errors in errorFormatter
7. **Optimistic updates** - Better UX with immediate feedback
8. **Prefetch data** - Faster navigation with server prefetching
