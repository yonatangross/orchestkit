/**
 * Production-ready Zustand store template
 *
 * Features:
 * - TypeScript strict mode
 * - Slices pattern for modularity
 * - Immer for immutable updates
 * - DevTools for debugging
 * - Persist with migrations
 * - Proper selector exports
 * - Reset functionality
 *
 * Usage:
 * 1. Copy this template
 * 2. Modify slices for your domain
 * 3. Update persistence partialize
 * 4. Add your selectors
 */

import { create, StateCreator } from 'zustand';
import { devtools, persist, subscribeWithSelector, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import type {} from '@redux-devtools/extension';

// ============================================
// Types
// ============================================

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: number;
}

// ============================================
// Slice Interfaces
// ============================================

interface AuthSlice {
  // State
  user: User | null;
  isAuthenticated: boolean;

  // Actions
  login: (user: User) => void;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => void;
}

interface CartSlice {
  // State
  items: CartItem[];

  // Actions
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

interface UISlice {
  // State
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  notifications: Notification[];

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
}

interface ResetSlice {
  reset: () => void;
}

// Combined store type
type StoreState = AuthSlice & CartSlice & UISlice & ResetSlice;

// Middleware type for slices
type SliceCreator<T> = StateCreator<
  StoreState,
  [['zustand/immer', never], ['zustand/devtools', never]],
  [],
  T
>;

// ============================================
// Initial State (for reset)
// ============================================

const initialAuthState: Pick<AuthSlice, 'user' | 'isAuthenticated'> = {
  user: null,
  isAuthenticated: false,
};

const initialCartState: Pick<CartSlice, 'items'> = {
  items: [],
};

const initialUIState: Pick<UISlice, 'sidebarOpen' | 'theme' | 'notifications'> = {
  sidebarOpen: true,
  theme: 'system',
  notifications: [],
};

// ============================================
// Slice Creators
// ============================================

const createAuthSlice: SliceCreator<AuthSlice> = (set) => ({
  ...initialAuthState,

  login: (user) =>
    set(
      (state) => {
        state.user = user;
        state.isAuthenticated = true;
      },
      undefined,
      'auth/login'
    ),

  logout: () =>
    set(
      (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.items = []; // Clear cart on logout
      },
      undefined,
      'auth/logout'
    ),

  updateProfile: (updates) =>
    set(
      (state) => {
        if (state.user) {
          Object.assign(state.user, updates);
        }
      },
      undefined,
      'auth/updateProfile'
    ),
});

const createCartSlice: SliceCreator<CartSlice> = (set) => ({
  ...initialCartState,

  addItem: (item) =>
    set(
      (state) => {
        const existing = state.items.find((i) => i.productId === item.productId);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          state.items.push({
            ...item,
            id: crypto.randomUUID(),
          });
        }
      },
      undefined,
      'cart/addItem'
    ),

  removeItem: (id) =>
    set(
      (state) => {
        state.items = state.items.filter((i) => i.id !== id);
      },
      undefined,
      'cart/removeItem'
    ),

  updateQuantity: (id, quantity) =>
    set(
      (state) => {
        const item = state.items.find((i) => i.id === id);
        if (item) {
          if (quantity <= 0) {
            state.items = state.items.filter((i) => i.id !== id);
          } else {
            item.quantity = quantity;
          }
        }
      },
      undefined,
      'cart/updateQuantity'
    ),

  clearCart: () =>
    set(
      (state) => {
        state.items = [];
      },
      undefined,
      'cart/clear'
    ),
});

const createUISlice: SliceCreator<UISlice> = (set) => ({
  ...initialUIState,

  toggleSidebar: () =>
    set(
      (state) => {
        state.sidebarOpen = !state.sidebarOpen;
      },
      undefined,
      'ui/toggleSidebar'
    ),

  setSidebarOpen: (open) =>
    set(
      (state) => {
        state.sidebarOpen = open;
      },
      undefined,
      'ui/setSidebarOpen'
    ),

  setTheme: (theme) =>
    set(
      (state) => {
        state.theme = theme;
      },
      undefined,
      'ui/setTheme'
    ),

  addNotification: (notification) =>
    set(
      (state) => {
        state.notifications.push({
          ...notification,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        });
      },
      undefined,
      'ui/addNotification'
    ),

  dismissNotification: (id) =>
    set(
      (state) => {
        state.notifications = state.notifications.filter((n) => n.id !== id);
      },
      undefined,
      'ui/dismissNotification'
    ),

  clearNotifications: () =>
    set(
      (state) => {
        state.notifications = [];
      },
      undefined,
      'ui/clearNotifications'
    ),
});

// ============================================
// Store Creation
// ============================================

export const useAppStore = create<StoreState>()(
  persist(
    devtools(
      subscribeWithSelector(
        immer((...args) => ({
          ...createAuthSlice(...args),
          ...createCartSlice(...args),
          ...createUISlice(...args),

          // Reset all state
          reset: () =>
            args[0](
              () => ({
                ...initialAuthState,
                ...initialCartState,
                ...initialUIState,
              }),
              true,
              'app/reset'
            ),
        }))
      ),
      {
        name: 'AppStore',
        enabled: process.env.NODE_ENV === 'development',
      }
    ),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,

      // Only persist these fields
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        items: state.items,
        theme: state.theme,
        // Don't persist: sidebarOpen, notifications (ephemeral)
      }),

      // Handle schema migrations
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Partial<StoreState>;

        // Add migration logic here as schema evolves
        // if (version === 0) { ... }

        return state as StoreState;
      },
    }
  )
);

// ============================================
// Selectors (Prevent Re-renders)
// ============================================

// Auth selectors
export const useUser = () => useAppStore((s) => s.user);
export const useIsAuthenticated = () => useAppStore((s) => s.isAuthenticated);

// Cart selectors
export const useCartItems = () => useAppStore((s) => s.items);
export const useCartItemCount = () => useAppStore((s) => s.items.length);
export const useCartTotal = () =>
  useAppStore((s) => s.items.reduce((sum, item) => sum + item.price * item.quantity, 0));

// UI selectors
export const useSidebarOpen = () => useAppStore((s) => s.sidebarOpen);
export const useTheme = () => useAppStore((s) => s.theme);
export const useNotifications = () => useAppStore((s) => s.notifications);

// Multi-value selectors (use useShallow)
export const useAuth = () =>
  useAppStore(useShallow((s) => ({ user: s.user, isAuthenticated: s.isAuthenticated })));

export const useCartSummary = () =>
  useAppStore(
    useShallow((s) => ({
      itemCount: s.items.length,
      total: s.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    }))
  );

// ============================================
// Action Selectors (Stable References)
// ============================================

export const useAuthActions = () =>
  useAppStore(useShallow((s) => ({ login: s.login, logout: s.logout, updateProfile: s.updateProfile })));

export const useCartActions = () =>
  useAppStore(
    useShallow((s) => ({
      addItem: s.addItem,
      removeItem: s.removeItem,
      updateQuantity: s.updateQuantity,
      clearCart: s.clearCart,
    }))
  );

export const useUIActions = () =>
  useAppStore(
    useShallow((s) => ({
      toggleSidebar: s.toggleSidebar,
      setSidebarOpen: s.setSidebarOpen,
      setTheme: s.setTheme,
      addNotification: s.addNotification,
      dismissNotification: s.dismissNotification,
      clearNotifications: s.clearNotifications,
    }))
  );

// ============================================
// External Subscriptions (Non-React)
// ============================================

// Subscribe to theme changes for document updates
if (typeof window !== 'undefined') {
  useAppStore.subscribe(
    (state) => state.theme,
    (theme) => {
      const resolvedTheme =
        theme === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : theme;
      document.documentElement.dataset.theme = resolvedTheme;
    },
    { fireImmediately: true }
  );
}

// ============================================
// Testing Utilities
// ============================================

export const resetStore = () => useAppStore.getState().reset();

export const getStoreSnapshot = () => useAppStore.getState();

// For testing: replace store state
export const setStoreState = (state: Partial<StoreState>) => {
  useAppStore.setState(state);
};
