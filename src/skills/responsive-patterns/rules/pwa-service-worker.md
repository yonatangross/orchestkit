---
title: PWA Service Worker & Workbox
impact: HIGH
impactDescription: "Misconfigured service workers serve stale content indefinitely or break offline support — Workbox 7.x provides battle-tested caching strategies"
tags: pwa, service-worker, workbox, cache-api, vite-pwa
---

## PWA Service Worker & Workbox

Configure service workers with Workbox 7.x for reliable caching, update management, and installability.

**Incorrect — service worker without update strategy:**
```javascript
// WRONG: No skipWaiting means users stuck on old version
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('v1').then((cache) =>
      cache.addAll(['/index.html', '/app.js', '/style.css'])
    )
  );
});
// Missing: skipWaiting, clientsClaim, no update prompt
```

**Correct — Workbox with proper caching strategies:**
```javascript
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Static assets: CacheFirst (hashed filenames = safe to cache long)
registerRoute(
  /\.(?:js|css|woff2)$/,
  new CacheFirst({
    cacheName: 'static-v1',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  })
);

// API calls: NetworkFirst (fresh data preferred, cached fallback)
registerRoute(
  /\/api\//,
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  })
);

// Avatars/images: StaleWhileRevalidate (show cached, update in background)
registerRoute(
  /\/avatars\//,
  new StaleWhileRevalidate({ cacheName: 'avatars' })
);
```

**VitePWA integration:**
```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          { urlPattern: /^https:\/\/api\./, handler: 'NetworkFirst' },
        ],
      },
      manifest: {
        name: 'My PWA App',
        short_name: 'MyPWA',
        theme_color: '#4f46e5',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
```

**Key rules:**
- Use `generateSW` for simple apps, `injectManifest` for custom service worker logic
- Always enable `clientsClaim` and `skipWaiting` for immediate activation
- CacheFirst for static assets, NetworkFirst for APIs, StaleWhileRevalidate for non-critical images
- Never cache POST responses or authentication tokens
- Include `navigateFallback: '/index.html'` for SPA offline support
