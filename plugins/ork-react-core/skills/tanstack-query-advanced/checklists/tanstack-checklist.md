# TanStack Query v5 Implementation Checklist

Comprehensive checklist for production-ready TanStack Query integration.

## QueryClient Setup

### Configuration
- [ ] QueryClient created with sensible defaults
- [ ] staleTime configured (not left at 0 for all queries)
- [ ] gcTime configured based on cache requirements
- [ ] retry logic configured (with exponential backoff)
- [ ] retryDelay uses exponential backoff: `Math.min(1000 * 2 ** attemptIndex, 30000)`
- [ ] refetchOnWindowFocus set appropriately (true for real-time, false for static)
- [ ] refetchOnReconnect enabled for network-dependent apps

### Provider Setup
- [ ] QueryClientProvider wraps app at root
- [ ] ReactQueryDevtools added (dev only)
- [ ] QueryClient instance created outside component (no re-creation)

```typescript
// ✅ CORRECT: Created outside component
const queryClient = new QueryClient({ ... });

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}

// ❌ WRONG: Created inside component
function App() {
  const queryClient = new QueryClient(); // Re-created every render!
  return <QueryClientProvider client={queryClient}>...</QueryClientProvider>;
}
```

## Query Keys

### Structure
- [ ] Keys are arrays, not strings
- [ ] Keys follow hierarchy: `[entity, action, params]`
- [ ] Keys include ALL variables that affect the query result
- [ ] Keys use `as const` for type inference

### Query Key Factory
- [ ] Query key factory created for each entity
- [ ] Factory exports used consistently throughout app

```typescript
// ✅ CORRECT: Query key factory
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: Filters) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};
```

## Query Options (v5)

### queryOptions Helper
- [ ] `queryOptions` helper used for reusable query definitions
- [ ] Query options exported for use in hooks, loaders, and prefetch
- [ ] Type inference works correctly with queryOptions

```typescript
// ✅ CORRECT: Reusable query options
export const userQueryOptions = (id: string) =>
  queryOptions({
    queryKey: userKeys.detail(id),
    queryFn: () => fetchUser(id),
    staleTime: 5 * 60 * 1000,
  });

// Use in hook
const { data } = useQuery(userQueryOptions(id));

// Use in prefetch
queryClient.prefetchQuery(userQueryOptions(id));

// Use in loader
await queryClient.ensureQueryData(userQueryOptions(id));
```

## Queries

### Hook Usage
- [ ] `isPending` used for initial loading state (v5, not `isLoading`)
- [ ] `isError` and `error` handled for error states
- [ ] `enabled` option used for dependent queries
- [ ] `placeholderData` used for instant UI feedback
- [ ] `select` used for data transformation when needed

### State Handling
- [ ] Loading skeletons shown during `isPending`
- [ ] Error boundaries or error UI for `isError`
- [ ] Empty state handled when `data` is empty array/null
- [ ] Background refetch indicator for `isFetching && !isPending`

```typescript
// ✅ CORRECT: Complete state handling
function UserProfile({ id }: { id: string }) {
  const { data, isPending, isError, error, isFetching } = useUser(id);

  if (isPending) return <Skeleton />;
  if (isError) return <ErrorMessage error={error} />;
  if (!data) return <NotFound />;

  return (
    <div>
      {isFetching && <RefetchIndicator />}
      <UserCard user={data} />
    </div>
  );
}
```

## Suspense Integration

### useSuspenseQuery
- [ ] `useSuspenseQuery` used with Suspense boundaries
- [ ] Suspense fallback provides appropriate loading UI
- [ ] Error boundary handles query errors
- [ ] Data is guaranteed non-undefined (no `isPending` check needed)

```typescript
// ✅ CORRECT: Suspense integration
function UserProfile({ id }: { id: string }) {
  const { data } = useSuspenseQuery(userQueryOptions(id));
  // data is guaranteed to exist!
  return <UserCard user={data} />;
}

// Parent component
<ErrorBoundary fallback={<ErrorUI />}>
  <Suspense fallback={<Skeleton />}>
    <UserProfile id={id} />
  </Suspense>
</ErrorBoundary>
```

## Mutations

### Basic Setup
- [ ] `useMutation` hook created for each mutation
- [ ] `mutationFn` properly typed
- [ ] `onSuccess` invalidates related queries
- [ ] `onError` handles and displays errors
- [ ] Loading state shown during mutation (`isPending`)

### Optimistic Updates
- [ ] `onMutate` cancels outgoing refetches
- [ ] `onMutate` snapshots previous value
- [ ] `onMutate` applies optimistic update
- [ ] `onMutate` returns context for rollback
- [ ] `onError` rolls back to previous value
- [ ] `onSettled` invalidates to ensure consistency

```typescript
// ✅ CORRECT: Full optimistic update pattern
useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: ['todos', newTodo.id] });
    const previous = queryClient.getQueryData(['todos', newTodo.id]);
    queryClient.setQueryData(['todos', newTodo.id], newTodo);
    return { previous }; // MUST return context!
  },
  onError: (err, newTodo, context) => {
    queryClient.setQueryData(['todos', newTodo.id], context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  },
});
```

## Infinite Queries

### Setup
- [ ] `useInfiniteQuery` used for paginated data
- [ ] `initialPageParam` provided (required in v5)
- [ ] `getNextPageParam` returns cursor or null when done
- [ ] `getPreviousPageParam` for bi-directional pagination (if needed)

### Usage
- [ ] `hasNextPage` checked before calling `fetchNextPage`
- [ ] `isFetchingNextPage` used for loading indicator
- [ ] Pages flattened for rendering: `data.pages.flatMap(p => p.items)`

```typescript
// ✅ CORRECT: Infinite query with intersection observer
function InfiniteList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['items'],
    queryFn: ({ pageParam }) => fetchItems(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });

    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <>
      {data?.pages.flatMap((page) =>
        page.items.map((item) => <Item key={item.id} item={item} />)
      )}
      <div ref={observerRef}>
        {isFetchingNextPage && <Spinner />}
      </div>
    </>
  );
}
```

## Cache Invalidation

### Strategies
- [ ] `invalidateQueries` used after mutations (not `refetchQueries`)
- [ ] Query key hierarchy leveraged for selective invalidation
- [ ] `exact: true` used when only exact key should be invalidated
- [ ] `predicate` used for complex invalidation logic

### Best Practices
- [ ] No over-invalidation (don't invalidate everything)
- [ ] Related queries invalidated together
- [ ] `removeQueries` used for deleted entities

```typescript
// ✅ CORRECT: Selective invalidation
onSuccess: (_, deletedId) => {
  // Remove the specific item
  queryClient.removeQueries({ queryKey: ['todos', deletedId] });
  // Invalidate lists (but not other details)
  queryClient.invalidateQueries({ queryKey: ['todos', 'list'] });
}

// ❌ WRONG: Over-invalidation
onSuccess: () => {
  queryClient.invalidateQueries(); // Invalidates EVERYTHING!
}
```

## Prefetching

### Hover Prefetch
- [ ] `prefetchQuery` called on mouse enter
- [ ] staleTime set to prevent immediate refetch
- [ ] Prefetch uses same queryOptions as the query

### Route Prefetch
- [ ] React Router loaders use `ensureQueryData`
- [ ] Prefetch happens before navigation
- [ ] Cache is warm when component mounts

```typescript
// ✅ CORRECT: Hover prefetch
function UserLink({ id }: { id: string }) {
  const queryClient = useQueryClient();

  const prefetch = () => {
    queryClient.prefetchQuery(userQueryOptions(id));
  };

  return (
    <Link to={`/users/${id}`} onMouseEnter={prefetch}>
      View User
    </Link>
  );
}
```

## Performance

### Render Optimization
- [ ] Selectors used when only part of data needed
- [ ] `select` option used for derived data
- [ ] Components split to minimize re-renders
- [ ] `notifyOnChangeProps` used if needed (advanced)

### Network Optimization
- [ ] staleTime > 0 for data that doesn't change frequently
- [ ] `refetchOnWindowFocus: false` for static data
- [ ] `refetchInterval` only for truly real-time data
- [ ] Deduplication working (multiple components, one request)

## Testing

### Test Setup
- [ ] New QueryClient created per test (no shared state)
- [ ] Retry disabled in tests: `retry: false`
- [ ] gcTime set to 0 or Infinity based on test needs

### Mocking
- [ ] MSW used for API mocking (recommended)
- [ ] Or: queryFn mocked directly for unit tests
- [ ] `waitFor` used for async assertions

```typescript
// ✅ CORRECT: Test setup
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}
```

## TypeScript

### Type Safety
- [ ] Query return type inferred from queryFn
- [ ] Error type specified: `useQuery<Data, Error>`
- [ ] Mutation variables and context typed
- [ ] `as const` used for query keys

### Generic Patterns
- [ ] Query hooks properly typed
- [ ] No `any` types in query definitions
- [ ] Zod or similar used for runtime validation

## v5 Migration Checklist

### Breaking Changes
- [ ] `cacheTime` renamed to `gcTime`
- [ ] `isLoading` usage reviewed (now means `isPending && isFetching`)
- [ ] `isPending` used for initial load state
- [ ] `useQuery` returns stable object references
- [ ] `status` values: 'pending' | 'error' | 'success' (not 'loading')
- [ ] `initialPageParam` required for infinite queries
- [ ] Callbacks moved from useQuery options to component (if needed)

### Removed Features
- [ ] `onSuccess`/`onError`/`onSettled` removed from useQuery (use useEffect)
- [ ] `isLoading` doesn't exist for initial state (use `isPending`)
- [ ] `remove` method removed (use `removeQueries`)

## Documentation

- [ ] Query key structure documented
- [ ] Cache timing decisions documented
- [ ] Mutation patterns documented
- [ ] Error handling strategy documented
