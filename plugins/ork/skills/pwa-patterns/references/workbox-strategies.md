# Workbox Caching Strategies

## Strategy Overview

| Strategy | Network | Cache | Best For |
|----------|---------|-------|----------|
| CacheFirst | Fallback | Primary | Static assets, fonts |
| NetworkFirst | Primary | Fallback | API data, user content |
| StaleWhileRevalidate | Background | Immediate | Balance of fresh + fast |
| NetworkOnly | Always | Never | Auth, POST requests |
| CacheOnly | Never | Always | Offline-only content |

## CacheFirst

```javascript
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

workbox.routing.registerRoute(
  /\.(?:js|css|woff2)$/,
  new CacheFirst({
    cacheName: 'static-resources',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      }),
    ],
  })
);
```

**Use when:**
- Asset has hash in filename (cache-busting)
- Content rarely/never changes
- Fast response critical

## NetworkFirst

```javascript
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

workbox.routing.registerRoute(
  /\/api\//,
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10, // Fall back after 10s
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);
```

**Use when:**
- Fresh data preferred
- Offline fallback needed
- API responses

## StaleWhileRevalidate

```javascript
import { StaleWhileRevalidate } from 'workbox-strategies';

workbox.routing.registerRoute(
  /\/avatars\//,
  new StaleWhileRevalidate({
    cacheName: 'avatars',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  })
);
```

**Use when:**
- Speed important, staleness acceptable
- Content updates periodically
- User avatars, thumbnails

## Background Sync

```javascript
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { NetworkOnly } from 'workbox-strategies';

const bgSyncPlugin = new BackgroundSyncPlugin('formQueue', {
  maxRetentionTime: 24 * 60, // 24 hours
});

workbox.routing.registerRoute(
  /\/api\/submit/,
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'POST'
);
```

**Use when:**
- Form submissions
- Analytics events
- Offline-capable POSTs

## Cache Expiration

```javascript
import { ExpirationPlugin } from 'workbox-expiration';

new ExpirationPlugin({
  maxEntries: 60,           // Max items in cache
  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
  purgeOnQuotaError: true,  // Delete on storage quota error
})
```

## Cacheable Response

```javascript
import { CacheableResponsePlugin } from 'workbox-cacheableResponse';

new CacheableResponsePlugin({
  statuses: [0, 200], // Cache opaque (0) and OK (200)
  headers: {
    'X-Is-Cacheable': 'true', // Custom header check
  },
})
```
