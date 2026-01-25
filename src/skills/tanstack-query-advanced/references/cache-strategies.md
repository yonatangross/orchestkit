# Cache Strategies & Invalidation Patterns

Comprehensive guide to TanStack Query v5 caching, invalidation, and data synchronization.

## Cache Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Query Cache Lifecycle                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    staleTime    ┌──────────┐    gcTime     ┌──────────────┐  │
│  │  FRESH   │ ──────────────► │  STALE   │ ────────────► │   GARBAGE    │  │
│  │          │    (no refetch) │          │  (if unused)  │  COLLECTED   │  │
│  └──────────┘                 └──────────┘               └──────────────┘  │
│       │                            │                                        │
│       │ Component mounts           │ Component mounts                       │
│       ▼                            ▼                                        │
│  Return cached data           Return cached data                            │
│  (no network request)         + background refetch                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## staleTime vs gcTime

| Setting | Purpose | Default | When to Adjust |
|---------|---------|---------|----------------|
| `staleTime` | How long data is considered "fresh" | 0 (always stale) | Increase for rarely-changing data |
| `gcTime` | How long unused data stays in memory | 5 minutes | Increase for frequently revisited pages |

### staleTime Configuration

```typescript
// Real-time data (stock prices, notifications)
useQuery({
  queryKey: ['stock', symbol],
  queryFn: () => fetchStock(symbol),
  staleTime: 0,              // Always refetch
  refetchInterval: 5000,     // Poll every 5s
});

// User profile (changes occasionally)
useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
  staleTime: 5 * 60 * 1000,  // Fresh for 5 minutes
});

// Static configuration (rarely changes)
useQuery({
  queryKey: ['config'],
  queryFn: fetchConfig,
  staleTime: 60 * 60 * 1000, // Fresh for 1 hour
});

// Truly static data (never changes)
useQuery({
  queryKey: ['countries'],
  queryFn: fetchCountries,
  staleTime: Infinity,       // Never refetch
});
```

### gcTime Configuration

```typescript
// Frequently revisited pages (keep in memory longer)
useQuery({
  queryKey: ['dashboard'],
  queryFn: fetchDashboard,
  gcTime: 30 * 60 * 1000,    // Keep 30 minutes after unmount
});

// Large data that shouldn't linger
useQuery({
  queryKey: ['reports', year],
  queryFn: () => fetchReports(year),
  gcTime: 60 * 1000,         // Clear 1 minute after unmount
});

// Critical data (keep indefinitely)
useQuery({
  queryKey: ['currentUser'],
  queryFn: fetchCurrentUser,
  gcTime: Infinity,          // Never garbage collect
});
```

## Query Key Hierarchy

Query keys form a hierarchy. Invalidating a parent invalidates all children.

```typescript
// Key hierarchy:
// ['todos']
//   └── ['todos', 'list']
//         └── ['todos', 'list', { filter: 'active' }]
//         └── ['todos', 'list', { filter: 'completed' }]
//   └── ['todos', 'detail', '1']
//   └── ['todos', 'detail', '2']

// Invalidate ALL todo queries (list + all details)
queryClient.invalidateQueries({ queryKey: ['todos'] });

// Invalidate only list queries (not details)
queryClient.invalidateQueries({ queryKey: ['todos', 'list'] });

// Invalidate specific filter
queryClient.invalidateQueries({
  queryKey: ['todos', 'list', { filter: 'active' }]
});

// Invalidate exact key only (not children)
queryClient.invalidateQueries({
  queryKey: ['todos', 'list'],
  exact: true
});
```

## Invalidation Strategies

### 1. Mutation-Based Invalidation

```typescript
// ✅ RECOMMENDED: Invalidate related queries after mutation
const createTodo = useMutation({
  mutationFn: api.createTodo,
  onSuccess: () => {
    // Invalidate list to include new item
    queryClient.invalidateQueries({ queryKey: ['todos', 'list'] });
  },
});

const updateTodo = useMutation({
  mutationFn: api.updateTodo,
  onSuccess: (data, variables) => {
    // Invalidate specific item + list
    queryClient.invalidateQueries({ queryKey: ['todos', 'detail', variables.id] });
    queryClient.invalidateQueries({ queryKey: ['todos', 'list'] });
  },
});

const deleteTodo = useMutation({
  mutationFn: api.deleteTodo,
  onSuccess: (_, id) => {
    // Remove from cache entirely
    queryClient.removeQueries({ queryKey: ['todos', 'detail', id] });
    // Invalidate list
    queryClient.invalidateQueries({ queryKey: ['todos', 'list'] });
  },
});
```

### 2. Optimistic Updates with Reconciliation

```typescript
const updateTodo = useMutation({
  mutationFn: ({ id, ...data }) => api.updateTodo(id, data),

  // Step 1: Cancel any outgoing refetches
  onMutate: async ({ id, ...updates }) => {
    await queryClient.cancelQueries({ queryKey: ['todos', 'detail', id] });
    await queryClient.cancelQueries({ queryKey: ['todos', 'list'] });

    // Step 2: Snapshot current state
    const previousTodo = queryClient.getQueryData(['todos', 'detail', id]);
    const previousList = queryClient.getQueryData(['todos', 'list']);

    // Step 3: Optimistically update both caches
    queryClient.setQueryData(['todos', 'detail', id], (old) =>
      old ? { ...old, ...updates } : undefined
    );

    queryClient.setQueryData(['todos', 'list'], (old) =>
      old?.map((todo) =>
        todo.id === id ? { ...todo, ...updates } : todo
      )
    );

    // Step 4: Return context for rollback
    return { previousTodo, previousList, id };
  },

  // Step 5: Rollback on error
  onError: (err, variables, context) => {
    if (context) {
      queryClient.setQueryData(['todos', 'detail', context.id], context.previousTodo);
      queryClient.setQueryData(['todos', 'list'], context.previousList);
    }
  },

  // Step 6: Always reconcile with server
  onSettled: (data, error, { id }) => {
    queryClient.invalidateQueries({ queryKey: ['todos', 'detail', id] });
    queryClient.invalidateQueries({ queryKey: ['todos', 'list'] });
  },
});
```

### 3. Predicate-Based Invalidation

```typescript
// Invalidate todos by status
queryClient.invalidateQueries({
  predicate: (query) => {
    const key = query.queryKey;
    return (
      key[0] === 'todos' &&
      key[1] === 'list' &&
      (key[2] as { filter?: string })?.filter === 'completed'
    );
  },
});

// Invalidate all queries older than 10 minutes
queryClient.invalidateQueries({
  predicate: (query) => {
    const dataUpdatedAt = query.state.dataUpdatedAt;
    return Date.now() - dataUpdatedAt > 10 * 60 * 1000;
  },
});

// Invalidate queries with errors
queryClient.invalidateQueries({
  predicate: (query) => query.state.status === 'error',
});
```

### 4. Type-Based Invalidation

```typescript
// Invalidate only active queries (currently rendered)
queryClient.invalidateQueries({ type: 'active' });

// Invalidate inactive queries (not rendered but in cache)
queryClient.invalidateQueries({ type: 'inactive' });

// Invalidate all queries
queryClient.invalidateQueries({ type: 'all' }); // Default
```

### 5. Refetch vs Invalidate

```typescript
// invalidateQueries: Mark as stale, refetch if active
queryClient.invalidateQueries({ queryKey: ['todos'] });
// - Marks all matching queries as stale
// - Active queries refetch immediately
// - Inactive queries refetch on next mount

// refetchQueries: Force immediate refetch
queryClient.refetchQueries({ queryKey: ['todos'], type: 'active' });
// - Forces refetch regardless of stale state
// - Only refetches specified type

// When to use each:
// invalidateQueries: After mutations (let React Query decide when to refetch)
// refetchQueries: When you need guaranteed fresh data NOW
```

## Direct Cache Manipulation

### setQueryData

```typescript
// Update single item
queryClient.setQueryData(['user', userId], (old) =>
  old ? { ...old, name: 'New Name' } : undefined
);

// Add item to list
queryClient.setQueryData(['todos', 'list'], (old) =>
  old ? [...old, newTodo] : [newTodo]
);

// Update item in list
queryClient.setQueryData(['todos', 'list'], (old) =>
  old?.map((todo) =>
    todo.id === updatedTodo.id ? updatedTodo : todo
  )
);

// Remove item from list
queryClient.setQueryData(['todos', 'list'], (old) =>
  old?.filter((todo) => todo.id !== deletedId)
);

// ⚠️ IMPORTANT: Always return new reference
// ❌ BAD: Mutating existing data
queryClient.setQueryData(['todos'], (old) => {
  old?.push(newTodo);  // Mutation!
  return old;
});

// ✅ GOOD: Return new array
queryClient.setQueryData(['todos'], (old) =>
  old ? [...old, newTodo] : [newTodo]
);
```

### getQueryData & getQueriesData

```typescript
// Get single query data
const user = queryClient.getQueryData<User>(['user', userId]);

// Get all matching queries
const allTodoQueries = queryClient.getQueriesData<Todo[]>({
  queryKey: ['todos']
});
// Returns: Array<[queryKey, data]>

// Check if data exists
const hasUser = queryClient.getQueryData(['user', userId]) !== undefined;

// Get query state (includes status, error, etc.)
const state = queryClient.getQueryState(['user', userId]);
if (state?.status === 'error') {
  console.log('Query failed:', state.error);
}
```

### removeQueries

```typescript
// Remove specific query
queryClient.removeQueries({ queryKey: ['todos', 'detail', deletedId] });

// Remove all queries matching prefix
queryClient.removeQueries({ queryKey: ['todos'] });

// Remove inactive queries only
queryClient.removeQueries({ queryKey: ['todos'], type: 'inactive' });
```

## Cache Persistence

### persist with localStorage

```typescript
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours (must be >= maxAge)
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'REACT_QUERY_CACHE',
  throttleTime: 1000,
});

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            // Only persist successful queries
            return query.state.status === 'success';
          },
        },
      }}
    >
      <YourApp />
    </PersistQueryClientProvider>
  );
}
```

### Async Persistence (IndexedDB)

```typescript
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => await get(key),
    setItem: async (key, value) => await set(key, value),
    removeItem: async (key) => await del(key),
  },
  key: 'REACT_QUERY_CACHE',
});
```

## Real-Time Data Strategies

### Polling

```typescript
useQuery({
  queryKey: ['notifications'],
  queryFn: fetchNotifications,
  refetchInterval: 30000,                    // Poll every 30s
  refetchIntervalInBackground: false,        // Pause when tab hidden
});
```

### WebSocket Integration

```typescript
// Subscribe to WebSocket updates
useEffect(() => {
  const ws = new WebSocket('wss://api.example.com/ws');

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'TODO_UPDATED') {
      // Update cache directly
      queryClient.setQueryData(['todos', data.todo.id], data.todo);
      // Invalidate list to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['todos', 'list'] });
    }
  };

  return () => ws.close();
}, [queryClient]);
```

### Server-Sent Events (SSE)

```typescript
useEffect(() => {
  const eventSource = new EventSource('/api/events');

  eventSource.addEventListener('cache-invalidation', (event) => {
    const { queryKey } = JSON.parse(event.data);
    queryClient.invalidateQueries({ queryKey });
  });

  return () => eventSource.close();
}, [queryClient]);
```

## Common Patterns Matrix

| Scenario | staleTime | gcTime | Refetch Strategy |
|----------|-----------|--------|------------------|
| Real-time (stocks, chat) | 0 | 5min | Poll or WebSocket |
| User data | 5min | 30min | Window focus |
| Product catalog | 1min | 10min | On navigation |
| Static config | Infinity | Infinity | Manual/deploy |
| Search results | 0 | 1min | On input change |
| Dashboard | 30s | 5min | Poll + window focus |

## Debugging Tips

```typescript
// Log all query activity in development
if (process.env.NODE_ENV === 'development') {
  queryClient.getQueryCache().subscribe((event) => {
    console.log('Query event:', event.type, event.query.queryKey);
  });
}

// Inspect query state
const queryCache = queryClient.getQueryCache();
const queries = queryCache.getAll();
queries.forEach((query) => {
  console.log({
    key: query.queryKey,
    state: query.state.status,
    dataUpdatedAt: new Date(query.state.dataUpdatedAt),
    isStale: query.isStale(),
  });
});
```
