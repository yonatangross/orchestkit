---
title: PWA Offline & Installability
impact: HIGH
impactDescription: "PWAs without proper offline support and manifest fail installability checks — background sync and proper manifests enable native-like experiences"
tags: pwa, offline-first, background-sync, install-prompt, web-manifest
---

## PWA Offline & Installability

Implement offline-first patterns, background sync, install prompts, and web app manifests for native-like PWA experiences.

**Incorrect — no offline fallback or install handling:**
```javascript
// WRONG: App crashes when offline
// No service worker fallback, no install prompt handling
// Users get browser error page instead of offline experience
```

**Correct — offline status hook and install prompt:**
```tsx
// useOnlineStatus hook
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// Install prompt hook
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  const promptInstall = async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (outcome === 'accepted') { setIsInstalled(true); return true; }
    return false;
  };

  return { canInstall: !!installPrompt, isInstalled, promptInstall };
}
```

**Background sync for offline form submissions:**
```javascript
// sw.js
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

registerRoute(
  /\/api\/forms/,
  new NetworkOnly({
    plugins: [
      new BackgroundSyncPlugin('formQueue', {
        maxRetentionTime: 24 * 60, // 24 hours
      }),
    ],
  }),
  'POST'
);
```

**PWA checklist:**
- Service worker registered with offline fallback
- Web App Manifest with icons (192px + 512px maskable)
- HTTPS enabled (required for service workers)
- Offline page/experience works gracefully
- Responsive design (meta viewport set)
- Fast First Contentful Paint (< 1.8s)

**Key rules:**
- Use `display: "standalone"` in manifest for app-like experience
- Include both 192px and 512px icons with `maskable` purpose
- Use BackgroundSyncPlugin for offline form submissions
- Prompt install at a natural moment (not on page load)
- Test offline behavior in Chrome DevTools Application tab
