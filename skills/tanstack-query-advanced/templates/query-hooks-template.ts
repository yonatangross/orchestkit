/**
 * Production TanStack Query v5 Hooks Template
 *
 * Features:
 * - Type-safe queries with Zod validation
 * - queryOptions for reusable key/fn pairs
 * - Optimistic updates with rollback
 * - Infinite queries with cursor pagination
 * - Suspense-ready hooks
 * - React Router loader integration
 * - Error handling patterns
 *
 * Usage:
 * 1. Copy this template
 * 2. Replace Todo with your entity
 * 3. Update API endpoints
 * 4. Configure staleTime/gcTime for your use case
 */

import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useSuspenseQuery,
  useQueries,
  useQueryClient,
  queryOptions,
  infiniteQueryOptions,
  type QueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { z } from 'zod';

// ============================================
// Types & Schemas
// ============================================

// Entity schema with Zod for runtime validation
const todoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  completed: z.boolean(),
  priority: z.enum(['low', 'medium', 'high']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

type Todo = z.infer<typeof todoSchema>;

// Mutation input types
const createTodoSchema = todoSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
type CreateTodoInput = z.infer<typeof createTodoSchema>;

const updateTodoSchema = todoSchema.partial().required({ id: true });
type UpdateTodoInput = z.infer<typeof updateTodoSchema>;

// Paginated response
interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  previousCursor: string | null;
  total: number;
}

// List filters
interface TodoFilters {
  status?: 'all' | 'active' | 'completed';
  priority?: 'low' | 'medium' | 'high';
  search?: string;
}

// ============================================
// API Client
// ============================================

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const api = {
  // List with pagination
  getTodos: async (
    cursor?: string | null,
    filters?: TodoFilters
  ): Promise<PaginatedResponse<Todo>> => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (filters?.status && filters.status !== 'all') {
      params.set('status', filters.status);
    }
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.search) params.set('search', filters.search);

    const res = await fetch(`/api/todos?${params}`);
    if (!res.ok) {
      throw new ApiError(res.status, 'Failed to fetch todos');
    }

    const data = await res.json();
    return {
      items: z.array(todoSchema).parse(data.items),
      nextCursor: data.nextCursor,
      previousCursor: data.previousCursor,
      total: data.total,
    };
  },

  // Single item
  getTodo: async (id: string): Promise<Todo> => {
    const res = await fetch(`/api/todos/${id}`);
    if (!res.ok) {
      if (res.status === 404) {
        throw new ApiError(404, 'Todo not found', 'NOT_FOUND');
      }
      throw new ApiError(res.status, 'Failed to fetch todo');
    }
    return todoSchema.parse(await res.json());
  },

  // Create
  createTodo: async (data: CreateTodoInput): Promise<Todo> => {
    const validated = createTodoSchema.parse(data);
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validated),
    });
    if (!res.ok) {
      throw new ApiError(res.status, 'Failed to create todo');
    }
    return todoSchema.parse(await res.json());
  },

  // Update
  updateTodo: async ({ id, ...data }: UpdateTodoInput): Promise<Todo> => {
    const res = await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      if (res.status === 404) {
        throw new ApiError(404, 'Todo not found', 'NOT_FOUND');
      }
      throw new ApiError(res.status, 'Failed to update todo');
    }
    return todoSchema.parse(await res.json());
  },

  // Delete
  deleteTodo: async (id: string): Promise<void> => {
    const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      throw new ApiError(res.status, 'Failed to delete todo');
    }
  },

  // Bulk operations
  bulkUpdateTodos: async (
    ids: string[],
    updates: Partial<Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Todo[]> => {
    const res = await fetch('/api/todos/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, updates }),
    });
    if (!res.ok) {
      throw new ApiError(res.status, 'Failed to bulk update todos');
    }
    return z.array(todoSchema).parse(await res.json());
  },
};

// ============================================
// Query Keys Factory
// ============================================

export const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (filters?: TodoFilters) => [...todoKeys.lists(), filters] as const,
  details: () => [...todoKeys.all, 'detail'] as const,
  detail: (id: string) => [...todoKeys.details(), id] as const,
} as const;

// ============================================
// Query Options (Reusable)
// ============================================

// Single todo query options
export const todoQueryOptions = (id: string) =>
  queryOptions({
    queryKey: todoKeys.detail(id),
    queryFn: () => api.getTodo(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      // Don't retry on 404
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 3;
    },
  });

// Infinite list query options
export const todosInfiniteQueryOptions = (filters?: TodoFilters) =>
  infiniteQueryOptions({
    queryKey: todoKeys.list(filters),
    queryFn: ({ pageParam }) => api.getTodos(pageParam, filters),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    getPreviousPageParam: (firstPage) => firstPage.previousCursor,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

// ============================================
// Query Hooks
// ============================================

/**
 * Fetch single todo with loading/error states
 */
export function useTodo(id: string) {
  return useQuery(todoQueryOptions(id));
}

/**
 * Fetch single todo with Suspense (throws promise)
 */
export function useSuspenseTodo(id: string) {
  return useSuspenseQuery(todoQueryOptions(id));
}

/**
 * Fetch infinite list with cursor pagination
 */
export function useTodosInfinite(filters?: TodoFilters) {
  return useInfiniteQuery(todosInfiniteQueryOptions(filters));
}

/**
 * Fetch multiple todos in parallel
 */
export function useMultipleTodos(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => todoQueryOptions(id)),
    combine: (results) => ({
      data: results.map((r) => r.data).filter((d): d is Todo => d !== undefined),
      isPending: results.some((r) => r.isPending),
      isError: results.some((r) => r.isError),
      errors: results.filter((r) => r.error).map((r) => r.error),
    }),
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Create todo with cache update
 */
export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createTodo,
    onSuccess: (newTodo) => {
      // Add to detail cache
      queryClient.setQueryData(todoKeys.detail(newTodo.id), newTodo);

      // Invalidate lists to include new item
      queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to create todo:', error);
    },
  });
}

/**
 * Update todo with optimistic update and rollback
 */
export function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.updateTodo,

    // Optimistic update
    onMutate: async (variables) => {
      const { id, ...updates } = variables;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: todoKeys.detail(id) });
      await queryClient.cancelQueries({ queryKey: todoKeys.lists() });

      // Snapshot previous values
      const previousTodo = queryClient.getQueryData<Todo>(todoKeys.detail(id));
      const previousLists = queryClient.getQueriesData<PaginatedResponse<Todo>>({
        queryKey: todoKeys.lists(),
      });

      // Optimistically update detail
      if (previousTodo) {
        queryClient.setQueryData<Todo>(todoKeys.detail(id), {
          ...previousTodo,
          ...updates,
          updatedAt: new Date().toISOString(),
        });
      }

      // Optimistically update all lists
      previousLists.forEach(([queryKey]) => {
        queryClient.setQueryData<PaginatedResponse<Todo>>(queryKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((todo) =>
              todo.id === id
                ? { ...todo, ...updates, updatedAt: new Date().toISOString() }
                : todo
            ),
          };
        });
      });

      // Return context for rollback
      return { previousTodo, previousLists, id };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      if (!context) return;

      // Restore detail
      if (context.previousTodo) {
        queryClient.setQueryData(todoKeys.detail(context.id), context.previousTodo);
      }

      // Restore all lists
      context.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },

    // Always refetch to ensure consistency
    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: todoKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
    },
  });
}

/**
 * Delete todo with optimistic removal
 */
export function useDeleteTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteTodo,

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: todoKeys.detail(id) });
      await queryClient.cancelQueries({ queryKey: todoKeys.lists() });

      const previousTodo = queryClient.getQueryData<Todo>(todoKeys.detail(id));
      const previousLists = queryClient.getQueriesData<PaginatedResponse<Todo>>({
        queryKey: todoKeys.lists(),
      });

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: todoKeys.detail(id) });

      // Remove from all lists
      previousLists.forEach(([queryKey]) => {
        queryClient.setQueryData<PaginatedResponse<Todo>>(queryKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.filter((todo) => todo.id !== id),
            total: old.total - 1,
          };
        });
      });

      return { previousTodo, previousLists, id };
    },

    onError: (err, id, context) => {
      if (!context) return;

      if (context.previousTodo) {
        queryClient.setQueryData(todoKeys.detail(id), context.previousTodo);
      }

      context.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
    },
  });
}

/**
 * Bulk update todos (e.g., mark all as completed)
 */
export function useBulkUpdateTodos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, updates }: { ids: string[]; updates: Partial<Todo> }) =>
      api.bulkUpdateTodos(ids, updates),

    onSuccess: (updatedTodos) => {
      // Update each todo in cache
      updatedTodos.forEach((todo) => {
        queryClient.setQueryData(todoKeys.detail(todo.id), todo);
      });

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
    },
  });
}

/**
 * Toggle todo completion with optimistic update
 */
export function useToggleTodo() {
  const updateTodo = useUpdateTodo();

  return {
    ...updateTodo,
    mutate: (todo: Todo) =>
      updateTodo.mutate({
        id: todo.id,
        completed: !todo.completed,
      }),
    mutateAsync: (todo: Todo) =>
      updateTodo.mutateAsync({
        id: todo.id,
        completed: !todo.completed,
      }),
  };
}

// ============================================
// Prefetching Utilities
// ============================================

/**
 * Prefetch single todo (for hover prefetch)
 */
export function usePrefetchTodo() {
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.prefetchQuery(todoQueryOptions(id));
  };
}

/**
 * Prefetch todo list (for navigation)
 */
export function usePrefetchTodos() {
  const queryClient = useQueryClient();

  return (filters?: TodoFilters) => {
    queryClient.prefetchInfiniteQuery(todosInfiniteQueryOptions(filters));
  };
}

// ============================================
// React Router Loaders
// ============================================

/**
 * Loader for todo detail page
 */
export const todoLoader =
  (queryClient: QueryClient) =>
  async ({ params }: { params: { id: string } }) => {
    const { id } = params;

    // Return cached data or fetch
    await queryClient.ensureQueryData(todoQueryOptions(id));

    return { id };
  };

/**
 * Loader for todo list page
 */
export const todosLoader =
  (queryClient: QueryClient) =>
  async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    const filters: TodoFilters = {
      status: (url.searchParams.get('status') as TodoFilters['status']) || 'all',
      priority: url.searchParams.get('priority') as TodoFilters['priority'],
      search: url.searchParams.get('search') || undefined,
    };

    await queryClient.ensureInfiniteQueryData(todosInfiniteQueryOptions(filters));

    return { filters };
  };

// ============================================
// Utility Hooks
// ============================================

/**
 * Get cached todo without triggering fetch
 */
export function useCachedTodo(id: string): Todo | undefined {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<Todo>(todoKeys.detail(id));
}

/**
 * Check if todo is being mutated
 */
export function useIsTodoMutating(id: string): boolean {
  const queryClient = useQueryClient();
  return (
    queryClient.isMutating({
      mutationKey: ['updateTodo', id],
    }) > 0
  );
}

// ============================================
// Selector Hooks (Derived Data)
// ============================================

/**
 * Get total count from infinite query
 */
export function useTodoCount(filters?: TodoFilters): number | undefined {
  const { data } = useTodosInfinite(filters);
  return data?.pages[0]?.total;
}

/**
 * Get flattened items from infinite query
 */
export function useFlattenedTodos(filters?: TodoFilters): Todo[] {
  const { data } = useTodosInfinite(filters);
  return data?.pages.flatMap((page) => page.items) ?? [];
}

// ============================================
// QueryClient Default Configuration
// ============================================

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1 * 60 * 1000, // 1 minute default
        gcTime: 5 * 60 * 1000, // 5 minutes default
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        retry: 1,
        onError: (error) => {
          // Global error handler
          console.error('Mutation error:', error);
        },
      },
    },
  });

// ============================================
// Testing Utilities
// ============================================

/**
 * Create a test query client with no retries
 */
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

/**
 * Helper to set up test data
 */
export const seedTestData = (queryClient: QueryClient, todos: Todo[]) => {
  todos.forEach((todo) => {
    queryClient.setQueryData(todoKeys.detail(todo.id), todo);
  });

  queryClient.setQueryData(todoKeys.list(), {
    items: todos,
    nextCursor: null,
    previousCursor: null,
    total: todos.length,
  });
};
