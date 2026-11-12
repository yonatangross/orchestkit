# Zustand Anti-Patterns & React Query Integration

## Anti-Patterns (FORBIDDEN)

```typescript
// FORBIDDEN: Destructuring entire store
const { count, increment } = useStore(); // Re-renders on ANY state change

// FORBIDDEN: Storing derived/computed state
const useStore = create((set) => ({
  items: [],
  total: 0, // Will get out of sync!
}));

// FORBIDDEN: Storing server state
const useStore = create((set) => ({
  users: [], // Use TanStack Query instead
  fetchUsers: async () => { ... },
}));

// FORBIDDEN: Mutating state without Immer
set((state) => {
  state.items.push(item); // Breaks reactivity!
  return state;
});

// FORBIDDEN: Using deprecated shallow import
import { shallow } from 'zustand/shallow'; // Use useShallow from zustand/react/shallow
```

## Integration with React Query

```typescript
// Zustand for CLIENT state (UI, preferences, local-only)
const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: false,
  theme: 'light',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));

// TanStack Query for SERVER state (API data)
function Dashboard() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  // Zustand: UI state | TanStack Query: server data
}
```
