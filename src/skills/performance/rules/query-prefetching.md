---
title: TanStack Query Prefetching
impact: HIGH
impactDescription: "Users waiting for data on navigation causes perceived slowness — prefetching on hover or in route loaders enables instant page transitions"
tags: tanstack-query, prefetch, ensureQueryData, loader, hover-prefetch
---

## TanStack Query Prefetching

Prefetch data before navigation for instant page transitions using TanStack Query v5.

**Incorrect — fetching data only when component mounts:**
```tsx
// WRONG: User clicks link, waits for data to load
function UserProfile({ userId }: { userId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  if (isPending) return <Skeleton />; // User sees skeleton every time
  return <div>{data.name}</div>;
}
```

**Correct — prefetch on hover and in route loaders:**
```typescript
// 1. Define reusable query options (v5 pattern)
const userQueryOptions = (id: string) => queryOptions({
  queryKey: ['user', id] as const,
  queryFn: () => fetchUser(id),
  staleTime: 5 * 60 * 1000, // Fresh for 5 min
});

// 2. Prefetch on hover
function UserLink({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const prefetchUser = () => {
    queryClient.prefetchQuery(userQueryOptions(userId));
  };

  return (
    <Link
      to={`/users/${userId}`}
      onMouseEnter={prefetchUser}
      onFocus={prefetchUser}
    >
      View User
    </Link>
  );
}

// 3. Prefetch in route loader (React Router 7.x)
export const loader = (queryClient: QueryClient) =>
  async ({ params }: { params: { id: string } }) => {
    await queryClient.ensureQueryData(userQueryOptions(params.id));
    return null;
  };

// 4. Use with Suspense for instant render
function UserProfile({ userId }: { userId: string }) {
  // Data already loaded by prefetch — no loading state!
  const { data } = useSuspenseQuery(userQueryOptions(userId));
  return <div>{data.name}</div>;
}
```

**QueryClient configuration:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,       // 1 min fresh
      gcTime: 1000 * 60 * 5,      // 5 min in cache (formerly cacheTime)
      refetchOnWindowFocus: true,  // Refetch on tab focus
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

**Key rules:**
- Use `queryOptions()` helper for reusable query definitions across prefetch/useQuery/loader
- Prefetch on `onMouseEnter` AND `onFocus` for keyboard users
- Use `ensureQueryData` in loaders (waits for data), `prefetchQuery` for fire-and-forget
- `useSuspenseQuery` for components where data is guaranteed by loader
- `gcTime` (v5) replaces `cacheTime` (v4) — controls how long unused data stays in memory
- `isPending` (v5) replaces `isLoading` for initial load state
