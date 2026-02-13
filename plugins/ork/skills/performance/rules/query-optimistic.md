---
title: TanStack Query Optimistic Updates
impact: HIGH
impactDescription: "Waiting for server confirmation before updating UI creates perceived lag — optimistic updates provide instant feedback with automatic rollback on failure"
tags: tanstack-query, optimistic-updates, useMutation, rollback, cache-invalidation
---

## TanStack Query Optimistic Updates

Show immediate UI feedback before server confirmation with proper rollback on error.

**Incorrect — mutation without optimistic update:**
```tsx
// WRONG: User waits for server roundtrip
const mutation = useMutation({
  mutationFn: updateTodo,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] }); // Refetches after delay
  },
});
// UI feels sluggish — user sees spinner for 200-500ms
```

**Correct — optimistic update with rollback:**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTodo,
    onMutate: async (newTodo) => {
      // 1. Cancel outgoing refetches (prevent race condition)
      await queryClient.cancelQueries({ queryKey: ['todos', newTodo.id] });

      // 2. Snapshot previous value for rollback
      const previousTodo = queryClient.getQueryData(['todos', newTodo.id]);

      // 3. Optimistically update cache
      queryClient.setQueryData(['todos', newTodo.id], newTodo);

      // 4. Return context for rollback
      return { previousTodo };
    },
    onError: (_err, newTodo, context) => {
      // Rollback to previous value on error
      queryClient.setQueryData(['todos', newTodo.id], context?.previousTodo);
    },
    onSettled: (_data, _error, variables) => {
      // Always reconcile with server after mutation
      queryClient.invalidateQueries({ queryKey: ['todos', variables.id] });
    },
  });
}

// Optimistic list update (add to list)
function useAddTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTodo,
    onMutate: async (newTodo) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      const previousTodos = queryClient.getQueryData<Todo[]>(['todos']);

      // Immutable update (NEVER mutate cache directly)
      queryClient.setQueryData<Todo[]>(['todos'], (old) =>
        old ? [...old, { ...newTodo, id: 'temp-id' }] : [newTodo]
      );

      return { previousTodos };
    },
    onError: (_err, _newTodo, context) => {
      queryClient.setQueryData(['todos'], context?.previousTodos);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}
```

**Track pending mutations:**
```typescript
import { useMutationState } from '@tanstack/react-query';

function PendingTodos() {
  const pendingMutations = useMutationState({
    filters: { mutationKey: ['addTodo'], status: 'pending' },
    select: (mutation) => mutation.state.variables as Todo,
  });

  return (
    <>
      {pendingMutations.map((todo) => (
        <TodoItem key={todo.id} todo={todo} isPending />
      ))}
    </>
  );
}
```

**Key rules:**
- Always cancel outgoing queries in `onMutate` to prevent race conditions
- Always return context from `onMutate` for rollback capability
- Use immutable updates: `[...old, newItem]` not `old.push(newItem)`
- Always `invalidateQueries` in `onSettled` to reconcile with server
- Use `useMutationState` to show pending items in the UI
- Selective invalidation: `queryKey: ['todos', id]` not `queryClient.invalidateQueries()` (invalidates everything)
