# Zustand Real-World Examples

Production-tested patterns for common use cases.

## E-Commerce Cart Store

Complete shopping cart with persistence, optimistic updates, and computed totals.

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    immer((set) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            state.items.push({ ...item, id: crypto.randomUUID() });
          }
        }),

      removeItem: (id) =>
        set((state) => {
          state.items = state.items.filter((i) => i.id !== id);
        }),

      updateQuantity: (id, quantity) =>
        set((state) => {
          const item = state.items.find((i) => i.id === id);
          if (item) {
            item.quantity = Math.max(0, quantity);
            if (item.quantity === 0) {
              state.items = state.items.filter((i) => i.id !== id);
            }
          }
        }),

      clearCart: () => set({ items: [] }),
    })),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ✅ Computed selectors (not stored state)
export const useCartItemCount = () =>
  useCartStore((s) => s.items.reduce((sum, item) => sum + item.quantity, 0));

export const useCartSubtotal = () =>
  useCartStore((s) => s.items.reduce((sum, item) => sum + item.price * item.quantity, 0));

export const useCartTax = () => {
  const subtotal = useCartSubtotal();
  return subtotal * 0.1; // 10% tax
};

export const useCartTotal = () => {
  const subtotal = useCartSubtotal();
  const tax = useCartTax();
  return subtotal + tax;
};

// Usage in component
function CartSummary() {
  const itemCount = useCartItemCount();
  const subtotal = useCartSubtotal();
  const tax = useCartTax();
  const total = useCartTotal();

  return (
    <div>
      <p>{itemCount} items</p>
      <p>Subtotal: ${subtotal.toFixed(2)}</p>
      <p>Tax: ${tax.toFixed(2)}</p>
      <p>Total: ${total.toFixed(2)}</p>
    </div>
  );
}
```

## Authentication Store with Token Refresh

Auth state with automatic token refresh and secure handling.

```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  subscribeWithSelector((set, get) => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,

    login: async (email, password) => {
      set({ isLoading: true });
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) throw new Error('Login failed');

        const { user, accessToken, refreshToken } = await response.json();

        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    logout: () => {
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });
    },

    refreshAuth: async () => {
      const { refreshToken } = get();
      if (!refreshToken) {
        get().logout();
        return;
      }

      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          get().logout();
          return;
        }

        const { accessToken, refreshToken: newRefreshToken } = await response.json();

        set({
          accessToken,
          refreshToken: newRefreshToken,
        });
      } catch {
        get().logout();
      }
    },

    setUser: (user) => set({ user }),
  }))
);

// ✅ Auto-refresh token before expiry
if (typeof window !== 'undefined') {
  useAuthStore.subscribe(
    (state) => state.accessToken,
    (accessToken) => {
      if (accessToken) {
        // Decode JWT to get expiry (simplified)
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const expiresAt = payload.exp * 1000;
        const refreshAt = expiresAt - 60000; // Refresh 1 min before expiry

        const timeout = setTimeout(() => {
          useAuthStore.getState().refreshAuth();
        }, refreshAt - Date.now());

        return () => clearTimeout(timeout);
      }
    }
  );
}

// ✅ Selectors
export const useUser = () => useAuthStore((s) => s.user);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
export const useIsAdmin = () => useAuthStore((s) => s.user?.role === 'admin');
export const useAccessToken = () => useAuthStore((s) => s.accessToken);
```

## Theme Store with System Preference Sync

Theme management that syncs with system preferences.

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const getSystemTheme = (): ResolvedTheme =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

const resolveTheme = (theme: Theme): ResolvedTheme =>
  theme === 'system' ? getSystemTheme() : theme;

export const useThemeStore = create<ThemeState>()(
  persist(
    subscribeWithSelector((set) => ({
      theme: 'system',
      resolvedTheme: getSystemTheme(),

      setTheme: (theme) =>
        set({
          theme,
          resolvedTheme: resolveTheme(theme),
        }),
    })),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme }), // Only persist preference
      onRehydrateStorage: () => (state) => {
        // Resolve theme after hydration
        if (state) {
          state.resolvedTheme = resolveTheme(state.theme);
        }
      },
    }
  )
);

// ✅ Sync with system preference changes
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  mediaQuery.addEventListener('change', () => {
    const { theme } = useThemeStore.getState();
    if (theme === 'system') {
      useThemeStore.setState({ resolvedTheme: getSystemTheme() });
    }
  });

  // Apply theme to document
  useThemeStore.subscribe(
    (state) => state.resolvedTheme,
    (resolvedTheme) => {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(resolvedTheme);
    },
    { fireImmediately: true }
  );
}

// ✅ Selectors
export const useTheme = () => useThemeStore((s) => s.theme);
export const useResolvedTheme = () => useThemeStore((s) => s.resolvedTheme);
export const useIsDarkMode = () => useThemeStore((s) => s.resolvedTheme === 'dark');
```

## Multi-Step Form Wizard Store

Form wizard with step validation and draft persistence.

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
}

interface AddressInfo {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface PaymentInfo {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
}

interface WizardState {
  currentStep: number;
  personal: Partial<PersonalInfo>;
  address: Partial<AddressInfo>;
  payment: Partial<PaymentInfo>;
  completedSteps: Set<number>;

  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updatePersonal: (data: Partial<PersonalInfo>) => void;
  updateAddress: (data: Partial<AddressInfo>) => void;
  updatePayment: (data: Partial<PaymentInfo>) => void;
  markStepComplete: (step: number) => void;
  reset: () => void;
}

const TOTAL_STEPS = 3;

const initialState = {
  currentStep: 0,
  personal: {},
  address: {},
  payment: {},
  completedSteps: new Set<number>(),
};

export const useWizardStore = create<WizardState>()(
  persist(
    immer((set) => ({
      ...initialState,

      setStep: (step) =>
        set((state) => {
          if (step >= 0 && step < TOTAL_STEPS) {
            state.currentStep = step;
          }
        }),

      nextStep: () =>
        set((state) => {
          if (state.currentStep < TOTAL_STEPS - 1) {
            state.currentStep += 1;
          }
        }),

      prevStep: () =>
        set((state) => {
          if (state.currentStep > 0) {
            state.currentStep -= 1;
          }
        }),

      updatePersonal: (data) =>
        set((state) => {
          Object.assign(state.personal, data);
        }),

      updateAddress: (data) =>
        set((state) => {
          Object.assign(state.address, data);
        }),

      updatePayment: (data) =>
        set((state) => {
          Object.assign(state.payment, data);
        }),

      markStepComplete: (step) =>
        set((state) => {
          state.completedSteps.add(step);
        }),

      reset: () => set(initialState),
    })),
    {
      name: 'wizard-draft',
      storage: createJSONStorage(() => sessionStorage), // Tab-scoped
      partialize: (state) => ({
        currentStep: state.currentStep,
        personal: state.personal,
        address: state.address,
        // Don't persist payment info for security
      }),
    }
  )
);

// ✅ Selectors
export const useCurrentStep = () => useWizardStore((s) => s.currentStep);
export const useIsFirstStep = () => useWizardStore((s) => s.currentStep === 0);
export const useIsLastStep = () => useWizardStore((s) => s.currentStep === TOTAL_STEPS - 1);
export const useWizardProgress = () => useWizardStore((s) => ((s.currentStep + 1) / TOTAL_STEPS) * 100);
```

## Notification Toast Store

Global notification system with auto-dismiss.

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
}

interface NotificationState {
  notifications: Notification[];
  add: (notification: Omit<Notification, 'id'>) => string;
  remove: (id: string) => void;
  clear: () => void;
}

const DEFAULT_DURATION = 5000;

export const useNotificationStore = create<NotificationState>()(
  immer((set, get) => ({
    notifications: [],

    add: (notification) => {
      const id = crypto.randomUUID();
      const duration = notification.duration ?? DEFAULT_DURATION;

      set((state) => {
        state.notifications.push({
          ...notification,
          id,
          dismissible: notification.dismissible ?? true,
        });
      });

      // Auto-dismiss after duration
      if (duration > 0) {
        setTimeout(() => {
          get().remove(id);
        }, duration);
      }

      return id;
    },

    remove: (id) =>
      set((state) => {
        state.notifications = state.notifications.filter((n) => n.id !== id);
      }),

    clear: () => set({ notifications: [] }),
  }))
);

// ✅ Convenience functions
export const toast = {
  info: (title: string, message?: string) =>
    useNotificationStore.getState().add({ type: 'info', title, message }),

  success: (title: string, message?: string) =>
    useNotificationStore.getState().add({ type: 'success', title, message }),

  warning: (title: string, message?: string) =>
    useNotificationStore.getState().add({ type: 'warning', title, message }),

  error: (title: string, message?: string) =>
    useNotificationStore.getState().add({ type: 'error', title, message, duration: 0 }),
};

// ✅ Selectors
export const useNotifications = () => useNotificationStore((s) => s.notifications);
export const useHasNotifications = () => useNotificationStore((s) => s.notifications.length > 0);
```
