# TanStack Query Real-World Examples

Production-tested patterns for common use cases.

## E-Commerce Product Catalog

Complete product browsing with infinite scroll, filters, and prefetch.

```typescript
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  queryOptions,
  infiniteQueryOptions,
} from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';

// Types
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  rating: number;
  stock: number;
}

interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price' | 'rating' | 'name';
  sortOrder?: 'asc' | 'desc';
}

interface ProductsPage {
  items: Product[];
  nextCursor: string | null;
  total: number;
}

// Query key factory
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters?: ProductFilters) => [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};

// Query options
export const productQueryOptions = (id: string) =>
  queryOptions({
    queryKey: productKeys.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/products/${id}`);
      if (!res.ok) throw new Error('Product not found');
      return res.json() as Promise<Product>;
    },
    staleTime: 5 * 60 * 1000, // Products rarely change
  });

export const productsInfiniteOptions = (filters?: ProductFilters) =>
  infiniteQueryOptions({
    queryKey: productKeys.list(filters),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set('cursor', pageParam);
      if (filters?.category) params.set('category', filters.category);
      if (filters?.minPrice) params.set('minPrice', String(filters.minPrice));
      if (filters?.maxPrice) params.set('maxPrice', String(filters.maxPrice));
      if (filters?.sortBy) params.set('sortBy', filters.sortBy);
      if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder);

      const res = await fetch(`/api/products?${params}`);
      return res.json() as Promise<ProductsPage>;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 1 * 60 * 1000,
  });

// Hooks
export function useProduct(id: string) {
  return useQuery(productQueryOptions(id));
}

export function useProducts(filters?: ProductFilters) {
  return useInfiniteQuery(productsInfiniteOptions(filters));
}

// Prefetch hook
export function usePrefetchProduct() {
  const queryClient = useQueryClient();
  return useCallback(
    (id: string) => {
      queryClient.prefetchQuery(productQueryOptions(id));
    },
    [queryClient]
  );
}

// Component
function ProductGrid({ filters }: { filters?: ProductFilters }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
  } = useProducts(filters);

  const prefetchProduct = usePrefetchProduct();
  const observerRef = useRef<HTMLDivElement>(null);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '100px' }
    );

    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isPending) return <ProductGridSkeleton />;

  const products = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="grid grid-cols-4 gap-4">
      {products.map((product) => (
        <Link
          key={product.id}
          to={`/products/${product.id}`}
          onMouseEnter={() => prefetchProduct(product.id)}
          className="group"
        >
          <ProductCard product={product} />
        </Link>
      ))}

      <div ref={observerRef} className="col-span-4 h-20 flex justify-center">
        {isFetchingNextPage && <Spinner />}
      </div>
    </div>
  );
}
```

## Shopping Cart with Optimistic Updates

Cart management with instant UI feedback and error recovery.

```typescript
import {
  useMutation,
  useQuery,
  useQueryClient,
  queryOptions,
} from '@tanstack/react-query';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface Cart {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
}

// Query options
export const cartQueryOptions = queryOptions({
  queryKey: ['cart'],
  queryFn: async () => {
    const res = await fetch('/api/cart');
    return res.json() as Promise<Cart>;
  },
  staleTime: 0, // Always fetch fresh cart
});

// Hooks
export function useCart() {
  return useQuery(cartQueryOptions);
}

export function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      quantity,
    }: {
      productId: string;
      quantity: number;
    }) => {
      const res = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
      });
      if (!res.ok) throw new Error('Failed to add item');
      return res.json() as Promise<Cart>;
    },

    // Optimistic update
    onMutate: async ({ productId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: ['cart'] });
      const previousCart = queryClient.getQueryData<Cart>(['cart']);

      // Get product details from cache or make educated guess
      const product = queryClient.getQueryData<Product>(['products', productId]);

      if (previousCart && product) {
        const existingItem = previousCart.items.find(
          (item) => item.productId === productId
        );

        let updatedItems: CartItem[];
        if (existingItem) {
          updatedItems = previousCart.items.map((item) =>
            item.productId === productId
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        } else {
          updatedItems = [
            ...previousCart.items,
            {
              id: `temp-${Date.now()}`,
              productId,
              name: product.name,
              price: product.price,
              quantity,
              image: product.image,
            },
          ];
        }

        const subtotal = updatedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        const tax = subtotal * 0.1;

        queryClient.setQueryData<Cart>(['cart'], {
          items: updatedItems,
          subtotal,
          tax,
          total: subtotal + tax,
        });
      }

      return { previousCart };
    },

    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(['cart'], context.previousCart);
      }
      toast.error('Failed to add item to cart');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}

export function useUpdateCartQuantity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      quantity,
    }: {
      itemId: string;
      quantity: number;
    }) => {
      const res = await fetch(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) throw new Error('Failed to update quantity');
      return res.json() as Promise<Cart>;
    },

    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: ['cart'] });
      const previousCart = queryClient.getQueryData<Cart>(['cart']);

      if (previousCart) {
        const updatedItems =
          quantity === 0
            ? previousCart.items.filter((item) => item.id !== itemId)
            : previousCart.items.map((item) =>
                item.id === itemId ? { ...item, quantity } : item
              );

        const subtotal = updatedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        const tax = subtotal * 0.1;

        queryClient.setQueryData<Cart>(['cart'], {
          items: updatedItems,
          subtotal,
          tax,
          total: subtotal + tax,
        });
      }

      return { previousCart };
    },

    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(['cart'], context.previousCart);
      }
      toast.error('Failed to update quantity');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}

export function useRemoveFromCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove item');
      return res.json() as Promise<Cart>;
    },

    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: ['cart'] });
      const previousCart = queryClient.getQueryData<Cart>(['cart']);

      if (previousCart) {
        const updatedItems = previousCart.items.filter(
          (item) => item.id !== itemId
        );
        const subtotal = updatedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        const tax = subtotal * 0.1;

        queryClient.setQueryData<Cart>(['cart'], {
          items: updatedItems,
          subtotal,
          tax,
          total: subtotal + tax,
        });
      }

      return { previousCart };
    },

    onError: (err, itemId, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(['cart'], context.previousCart);
      }
      toast.error('Failed to remove item');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}

// Component
function CartPage() {
  const { data: cart, isPending } = useCart();
  const updateQuantity = useUpdateCartQuantity();
  const removeItem = useRemoveFromCart();

  if (isPending) return <CartSkeleton />;
  if (!cart?.items.length) return <EmptyCart />;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Shopping Cart</h1>

      <div className="space-y-4">
        {cart.items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 p-4 border rounded">
            <img src={item.image} alt={item.name} className="w-20 h-20 object-cover" />

            <div className="flex-1">
              <h3 className="font-medium">{item.name}</h3>
              <p className="text-gray-600">${item.price.toFixed(2)}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  updateQuantity.mutate({
                    itemId: item.id,
                    quantity: item.quantity - 1,
                  })
                }
                disabled={updateQuantity.isPending}
              >
                -
              </button>
              <span>{item.quantity}</span>
              <button
                onClick={() =>
                  updateQuantity.mutate({
                    itemId: item.id,
                    quantity: item.quantity + 1,
                  })
                }
                disabled={updateQuantity.isPending}
              >
                +
              </button>
            </div>

            <button
              onClick={() => removeItem.mutate(item.id)}
              disabled={removeItem.isPending}
              className="text-red-500"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>${cart.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax:</span>
          <span>${cart.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg mt-2">
          <span>Total:</span>
          <span>${cart.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
```

## User Dashboard with Parallel Queries

Dashboard loading multiple data sources in parallel.

```typescript
import {
  useQuery,
  useQueries,
  useSuspenseQueries,
  queryOptions,
} from '@tanstack/react-query';
import { Suspense } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface DashboardStats {
  totalOrders: number;
  totalSpent: number;
  loyaltyPoints: number;
}

interface Order {
  id: string;
  date: string;
  status: string;
  total: number;
}

interface Notification {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// Query options
export const userQueryOptions = queryOptions({
  queryKey: ['user', 'me'],
  queryFn: async () => {
    const res = await fetch('/api/users/me');
    return res.json() as Promise<User>;
  },
  staleTime: 10 * 60 * 1000,
});

export const dashboardStatsOptions = queryOptions({
  queryKey: ['dashboard', 'stats'],
  queryFn: async () => {
    const res = await fetch('/api/dashboard/stats');
    return res.json() as Promise<DashboardStats>;
  },
  staleTime: 5 * 60 * 1000,
});

export const recentOrdersOptions = queryOptions({
  queryKey: ['orders', 'recent'],
  queryFn: async () => {
    const res = await fetch('/api/orders?limit=5');
    return res.json() as Promise<Order[]>;
  },
  staleTime: 1 * 60 * 1000,
});

export const notificationsOptions = queryOptions({
  queryKey: ['notifications'],
  queryFn: async () => {
    const res = await fetch('/api/notifications?unread=true');
    return res.json() as Promise<Notification[]>;
  },
  staleTime: 30 * 1000, // Check often
});

// Combined hook using useQueries
export function useDashboardData() {
  return useQueries({
    queries: [
      userQueryOptions,
      dashboardStatsOptions,
      recentOrdersOptions,
      notificationsOptions,
    ],
    combine: (results) => ({
      user: results[0].data,
      stats: results[1].data,
      orders: results[2].data,
      notifications: results[3].data,
      isPending: results.some((r) => r.isPending),
      isError: results.some((r) => r.isError),
      errors: results.filter((r) => r.error).map((r) => r.error),
    }),
  });
}

// Suspense version
export function useSuspenseDashboardData() {
  return useSuspenseQueries({
    queries: [
      userQueryOptions,
      dashboardStatsOptions,
      recentOrdersOptions,
      notificationsOptions,
    ],
    combine: (results) => ({
      user: results[0].data,
      stats: results[1].data,
      orders: results[2].data,
      notifications: results[3].data,
    }),
  });
}

// Component (non-Suspense)
function Dashboard() {
  const { user, stats, orders, notifications, isPending, isError } =
    useDashboardData();

  if (isPending) return <DashboardSkeleton />;
  if (isError) return <ErrorMessage />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src={user?.avatar}
            alt={user?.name}
            className="w-12 h-12 rounded-full"
          />
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user?.name}</h1>
            <p className="text-gray-600">{user?.email}</p>
          </div>
        </div>

        {notifications && notifications.length > 0 && (
          <div className="relative">
            <BellIcon className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {notifications.length}
            </span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Orders" value={stats?.totalOrders ?? 0} />
        <StatCard
          label="Total Spent"
          value={`$${(stats?.totalSpent ?? 0).toFixed(2)}`}
        />
        <StatCard label="Loyalty Points" value={stats?.loyaltyPoints ?? 0} />
      </div>

      {/* Recent Orders */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>
        <div className="space-y-2">
          {orders?.map((order) => (
            <div
              key={order.id}
              className="flex justify-between p-4 border rounded"
            >
              <div>
                <span className="font-medium">Order #{order.id}</span>
                <span className="text-gray-500 ml-2">{order.date}</span>
              </div>
              <div className="flex items-center gap-4">
                <StatusBadge status={order.status} />
                <span>${order.total.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Component (Suspense version)
function DashboardWithSuspense() {
  return (
    <ErrorBoundary fallback={<ErrorMessage />}>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </ErrorBoundary>
  );
}

function DashboardContent() {
  const { user, stats, orders, notifications } = useSuspenseDashboardData();

  // Data is guaranteed to exist here!
  return (
    <div className="p-6 space-y-6">
      {/* Same JSX as above, but no null checks needed */}
    </div>
  );
}
```

## Search with Debounce

Search implementation with debounced queries.

```typescript
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useState, useDeferredValue } from 'react';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'product' | 'article' | 'user';
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
}

// Hook with built-in debounce using React 18's useDeferredValue
export function useSearch(query: string) {
  const deferredQuery = useDeferredValue(query);

  return useQuery({
    queryKey: ['search', deferredQuery],
    queryFn: async () => {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(deferredQuery)}`
      );
      return res.json() as Promise<SearchResponse>;
    },
    enabled: deferredQuery.length >= 2, // Only search with 2+ characters
    staleTime: 30 * 1000, // Cache results briefly
    placeholderData: keepPreviousData, // Keep showing old results while fetching
  });
}

// Component
function SearchBox() {
  const [query, setQuery] = useState('');
  const { data, isPending, isFetching } = useSearch(query);

  const isSearching = query.length >= 2;
  const showLoading = isFetching && isSearching;

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products, articles, users..."
        className="w-full p-3 border rounded-lg"
      />

      {showLoading && (
        <div className="absolute right-3 top-3">
          <Spinner className="w-5 h-5" />
        </div>
      )}

      {isSearching && data && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg max-h-96 overflow-auto">
          {data.results.length === 0 ? (
            <div className="p-4 text-gray-500">No results found</div>
          ) : (
            <ul>
              {data.results.map((result) => (
                <li key={result.id}>
                  <Link
                    to={`/${result.type}s/${result.id}`}
                    className="block p-4 hover:bg-gray-50"
                  >
                    <div className="font-medium">{result.title}</div>
                    <div className="text-sm text-gray-500">
                      {result.description}
                    </div>
                    <span className="text-xs text-blue-500 capitalize">
                      {result.type}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {data.total > data.results.length && (
            <div className="p-4 border-t text-center">
              <Link to={`/search?q=${query}`} className="text-blue-500">
                View all {data.total} results
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Real-Time Notifications with Polling

Notifications with automatic polling and manual refresh.

```typescript
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      return res.json() as Promise<Notification[]>;
    },
    refetchInterval: 30 * 1000, // Poll every 30 seconds
    refetchIntervalInBackground: false, // Pause when tab hidden
    staleTime: 10 * 1000,
  });
}

export function useUnreadCount() {
  const { data } = useNotifications();
  return data?.filter((n) => !n.read).length ?? 0;
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to mark as read');
    },

    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData<Notification[]>(['notifications']);

      queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
        old?.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );

      return { previous };
    },

    onError: (err, notificationId, context) => {
      queryClient.setQueryData(['notifications'], context?.previous);
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to mark all as read');
    },

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData<Notification[]>(['notifications']);

      queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
        old?.map((n) => ({ ...n, read: true }))
      );

      return { previous };
    },

    onError: (err, variables, context) => {
      queryClient.setQueryData(['notifications'], context?.previous);
    },
  });
}

// Component
function NotificationCenter() {
  const { data: notifications, isPending, refetch, isFetching } =
    useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const unreadCount = useUnreadCount();

  return (
    <div className="w-96 bg-white rounded-lg shadow-xl">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {unreadCount}
            </span>
          )}
        </h3>

        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-gray-500 hover:text-gray-700"
          >
            {isFetching ? <Spinner className="w-4 h-4" /> : <RefreshIcon />}
          </button>

          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
              className="text-sm text-blue-500"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="max-h-96 overflow-auto">
        {isPending ? (
          <NotificationsSkeleton />
        ) : notifications?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No notifications
          </div>
        ) : (
          notifications?.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${
                !notification.read ? 'bg-blue-50' : ''
              }`}
              onClick={() => {
                if (!notification.read) {
                  markAsRead.mutate(notification.id);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <NotificationIcon type={notification.type} />
                <div className="flex-1">
                  <p className="font-medium">{notification.title}</p>
                  <p className="text-sm text-gray-600">{notification.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
                {!notification.read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

## Form with Mutation Status

Form submission with loading states and error handling.

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update profile');
      }

      return res.json();
    },

    onSuccess: (data) => {
      // Update user cache
      queryClient.setQueryData(['user', 'me'], data);
      toast.success('Profile updated successfully');
    },

    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// Component
function ProfileForm() {
  const updateProfile = useUpdateProfile();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: async () => {
      const res = await fetch('/api/users/me');
      return res.json();
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfile.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block font-medium">
          Name
        </label>
        <input
          id="name"
          {...register('name')}
          className="w-full p-2 border rounded"
        />
        {errors.name && (
          <p className="text-red-500 text-sm">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...register('email')}
          className="w-full p-2 border rounded"
        />
        {errors.email && (
          <p className="text-red-500 text-sm">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="bio" className="block font-medium">
          Bio
        </label>
        <textarea
          id="bio"
          {...register('bio')}
          rows={4}
          className="w-full p-2 border rounded"
        />
        {errors.bio && (
          <p className="text-red-500 text-sm">{errors.bio.message}</p>
        )}
      </div>

      {updateProfile.isError && (
        <div className="p-4 bg-red-50 text-red-700 rounded">
          {updateProfile.error.message}
        </div>
      )}

      <button
        type="submit"
        disabled={!isDirty || updateProfile.isPending}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
```
