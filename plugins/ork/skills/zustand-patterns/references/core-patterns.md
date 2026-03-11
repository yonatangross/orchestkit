# Zustand Core Patterns

## 1. Basic Store with TypeScript

```typescript
import { create } from 'zustand';

interface BearState {
  bears: number;
  increase: (by: number) => void;
  reset: () => void;
}

const useBearStore = create<BearState>()((set) => ({
  bears: 0,
  increase: (by) => set((state) => ({ bears: state.bears + by })),
  reset: () => set({ bears: 0 }),
}));
```

## 2. Slices Pattern (Modular Stores)

```typescript
import { create, StateCreator } from 'zustand';

// Auth slice
interface AuthSlice {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const createAuthSlice: StateCreator<AuthSlice & CartSlice, [], [], AuthSlice> = (set) => ({
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
});

// Cart slice
interface CartSlice {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  clearCart: () => void;
}

const createCartSlice: StateCreator<AuthSlice & CartSlice, [], [], CartSlice> = (set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  clearCart: () => set({ items: [] }),
});

// Combined store
const useStore = create<AuthSlice & CartSlice>()((...a) => ({
  ...createAuthSlice(...a),
  ...createCartSlice(...a),
}));
```

## 3. Immer Middleware (Immutable Updates)

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface TodoState {
  todos: Todo[];
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  updateNested: (id: string, subtaskId: string, done: boolean) => void;
}

const useTodoStore = create<TodoState>()(
  immer((set) => ({
    todos: [],
    addTodo: (text) =>
      set((state) => {
        state.todos.push({ id: crypto.randomUUID(), text, done: false });
      }),
    toggleTodo: (id) =>
      set((state) => {
        const todo = state.todos.find((t) => t.id === id);
        if (todo) todo.done = !todo.done;
      }),
    updateNested: (id, subtaskId, done) =>
      set((state) => {
        const todo = state.todos.find((t) => t.id === id);
        const subtask = todo?.subtasks?.find((s) => s.id === subtaskId);
        if (subtask) subtask.done = done;
      }),
  }))
);
```

## 4. Persist Middleware

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  theme: 'light' | 'dark';
  language: string;
  setTheme: (theme: 'light' | 'dark') => void;
}

const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      language: 'en',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme }), // Only persist theme
      version: 1,
      migrate: (persisted, version) => {
        if (version === 0) {
          // Migration logic
        }
        return persisted as SettingsState;
      },
    }
  )
);
```

## 5. Selectors (Prevent Re-renders)

```typescript
// BAD: Re-renders on ANY state change
const { bears, fish } = useBearStore();

// GOOD: Only re-renders when bears changes
const bears = useBearStore((state) => state.bears);

// GOOD: Shallow comparison for objects (Zustand 5.x)
import { useShallow } from 'zustand/react/shallow';

const { bears, fish } = useBearStore(
  useShallow((state) => ({ bears: state.bears, fish: state.fish }))
);

// GOOD: Computed/derived state via selector
const totalAnimals = useBearStore((state) => state.bears + state.fish);

// BAD: Storing computed state
const useStore = create((set) => ({
  items: [],
  total: 0, // Don't store derived values!
  addItem: (item) => set((s) => ({
    items: [...s.items, item],
    total: s.total + item.price, // Sync issues!
  })),
}));

// GOOD: Compute in selector
const total = useStore((s) => s.items.reduce((sum, i) => sum + i.price, 0));
```

## 6. Async Actions

```typescript
interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
  fetchUser: (id: string) => Promise<void>;
}

const useUserStore = create<UserState>()((set) => ({
  user: null,
  loading: false,
  error: null,
  fetchUser: async (id) => {
    set({ loading: true, error: null });
    try {
      const user = await api.getUser(id);
      set({ user, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },
}));
```

## 7. DevTools Integration

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useStore = create<State>()(
  devtools(
    (set) => ({
      // ... state and actions
    }),
    { name: 'MyStore', enabled: process.env.NODE_ENV === 'development' }
  )
);
```
