# Real User Monitoring (RUM) Setup

Complete guide to implementing Real User Monitoring for Core Web Vitals.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RUM Data Flow                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Browser                          Server                   Analytics    │
│  ┌────────┐                      ┌────────┐              ┌────────────┐ │
│  │  User  │──interaction──►│ web-vitals │            │            │ │
│  │Session │                │  library   │            │  Dashboard │ │
│  └────────┘                └─────┬──────┘            │   + Alerts │ │
│                                  │                    └─────┬──────┘ │
│                                  │                          │        │
│                     ┌────────────▼────────────┐             │        │
│                     │    sendBeacon / fetch   │─────────────►        │
│                     │    (keepalive: true)    │             │        │
│                     └────────────┬────────────┘             │        │
│                                  │                          │        │
│                     ┌────────────▼────────────┐             │        │
│                     │     /api/vitals         │─────────────►        │
│                     │   (batch + process)     │   metrics   │        │
│                     └─────────────────────────┘             │        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

## web-vitals Library Setup

### Installation

```bash
npm install web-vitals
# or
pnpm add web-vitals
```

### Basic Implementation

```typescript
// lib/vitals.ts
import {
  onCLS,
  onINP,
  onLCP,
  onFCP,
  onTTFB,
  type Metric,
  type ReportOpts,
} from 'web-vitals';

// Metric type for your analytics
export interface VitalsMetric {
  name: 'CLS' | 'INP' | 'LCP' | 'FCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: 'navigate' | 'reload' | 'back-forward' | 'back-forward-cache' | 'prerender';
  // Custom metadata
  url: string;
  userAgent: string;
  connectionType?: string;
  deviceMemory?: number;
  timestamp: number;
}

// Collect device and connection info for debugging
function getDeviceInfo(): Partial<VitalsMetric> {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string };
    deviceMemory?: number;
  };

  return {
    userAgent: navigator.userAgent,
    connectionType: nav.connection?.effectiveType,
    deviceMemory: nav.deviceMemory,
  };
}

function createMetricPayload(metric: Metric): VitalsMetric {
  return {
    name: metric.name as VitalsMetric['name'],
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: window.location.href,
    timestamp: Date.now(),
    ...getDeviceInfo(),
  };
}

// Reliable transmission even during page unload
function sendToAnalytics(metric: Metric) {
  const payload = createMetricPayload(metric);
  const body = JSON.stringify(payload);

  // sendBeacon is most reliable for unload scenarios
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  } else {
    // Fallback with keepalive for browsers without sendBeacon
    fetch('/api/vitals', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true, // Keeps request alive even if page unloads
    });
  }
}

// Report all web vitals
export function reportWebVitals(opts?: ReportOpts) {
  // Core Web Vitals (affect SEO)
  onCLS(sendToAnalytics, opts);
  onINP(sendToAnalytics, opts);
  onLCP(sendToAnalytics, opts);

  // Additional useful metrics
  onFCP(sendToAnalytics, opts);
  onTTFB(sendToAnalytics, opts);
}
```

## Next.js App Router Integration

### Client Component for Vitals

```typescript
// app/components/web-vitals.tsx
'use client';

import { useEffect } from 'react';
import { reportWebVitals } from '@/lib/vitals';

export function WebVitals() {
  useEffect(() => {
    // Report immediately (first value)
    reportWebVitals({ reportAllChanges: false });
  }, []);

  return null;
}

// For debugging during development
export function WebVitalsDebug() {
  useEffect(() => {
    // Report all changes, not just final values
    reportWebVitals({ reportAllChanges: true });
  }, []);

  return null;
}
```

### Layout Integration

```typescript
// app/layout.tsx
import { WebVitals } from '@/components/web-vitals';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WebVitals />
        {children}
      </body>
    </html>
  );
}
```

## API Endpoint Implementation

### Next.js Route Handler

```typescript
// app/api/vitals/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Thresholds from web.dev
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
} as const;

// 2026 thresholds (plan ahead!)
const THRESHOLDS_2026 = {
  LCP: { good: 2000, poor: 4000 },
  INP: { good: 150, poor: 500 },
  CLS: { good: 0.08, poor: 0.25 },
} as const;

interface VitalsMetric {
  name: string;
  value: number;
  rating: string;
  delta: number;
  id: string;
  navigationType: string;
  url: string;
  userAgent: string;
  connectionType?: string;
  deviceMemory?: number;
  timestamp: number;
}

// Validate incoming metric
function isValidMetric(data: unknown): data is VitalsMetric {
  if (!data || typeof data !== 'object') return false;
  const metric = data as Record<string, unknown>;
  return (
    typeof metric.name === 'string' &&
    typeof metric.value === 'number' &&
    typeof metric.rating === 'string'
  );
}

export async function POST(request: NextRequest) {
  try {
    const metric = await request.json();

    if (!isValidMetric(metric)) {
      return NextResponse.json(
        { error: 'Invalid metric format' },
        { status: 400 }
      );
    }

    // Enrich with server-side data
    const enrichedMetric = {
      ...metric,
      receivedAt: new Date().toISOString(),
      clientIP: request.headers.get('x-forwarded-for') ?? 'unknown',
      country: request.headers.get('x-vercel-ip-country') ?? 'unknown',
    };

    // Log for debugging (replace with your analytics service)
    console.log('[Web Vital]', JSON.stringify(enrichedMetric));

    // Store in your analytics database
    await storeMetric(enrichedMetric);

    // Alert on poor metrics (optional)
    if (metric.rating === 'poor') {
      await alertOnPoorMetric(enrichedMetric);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Vitals API Error]', error);
    return NextResponse.json(
      { error: 'Failed to process metric' },
      { status: 500 }
    );
  }
}

// Example: Store in PostgreSQL
async function storeMetric(metric: VitalsMetric & { receivedAt: string }) {
  // Replace with your database client
  // await db.insert('web_vitals').values({
  //   name: metric.name,
  //   value: metric.value,
  //   rating: metric.rating,
  //   url: metric.url,
  //   user_agent: metric.userAgent,
  //   connection_type: metric.connectionType,
  //   timestamp: new Date(metric.timestamp),
  //   received_at: new Date(metric.receivedAt),
  // });
}

// Example: Alert via Slack/PagerDuty
async function alertOnPoorMetric(metric: VitalsMetric) {
  const threshold = THRESHOLDS[metric.name as keyof typeof THRESHOLDS];
  if (!threshold) return;

  // await fetch(process.env.SLACK_WEBHOOK_URL!, {
  //   method: 'POST',
  //   body: JSON.stringify({
  //     text: `🚨 Poor ${metric.name}: ${metric.value}${metric.name === 'CLS' ? '' : 'ms'} on ${metric.url}`,
  //   }),
  // });
}
```

## Batching for High-Traffic Sites

```typescript
// lib/vitals-batched.ts
import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

const BATCH_SIZE = 10;
const FLUSH_INTERVAL = 5000; // 5 seconds

class MetricsBatcher {
  private queue: Metric[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  add(metric: Metric) {
    this.queue.push(metric);

    if (this.queue.length >= BATCH_SIZE) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), FLUSH_INTERVAL);
    }
  }

  private flush() {
    if (this.queue.length === 0) return;

    const metrics = [...this.queue];
    this.queue = [];

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Send batch
    navigator.sendBeacon(
      '/api/vitals/batch',
      JSON.stringify({ metrics, timestamp: Date.now() })
    );
  }

  // Flush on page unload
  flushSync() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}

const batcher = new MetricsBatcher();

// Ensure flush on unload
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      batcher.flushSync();
    }
  });
}

export function reportWebVitalsBatched() {
  onCLS((metric) => batcher.add(metric));
  onINP((metric) => batcher.add(metric));
  onLCP((metric) => batcher.add(metric));
}
```

## Database Schema

### PostgreSQL Schema

```sql
CREATE TABLE web_vitals (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(10) NOT NULL,
  value DECIMAL(10, 4) NOT NULL,
  rating VARCHAR(20) NOT NULL,
  delta DECIMAL(10, 4),
  metric_id VARCHAR(50),
  navigation_type VARCHAR(30),
  url TEXT NOT NULL,
  user_agent TEXT,
  connection_type VARCHAR(20),
  device_memory INT,
  client_ip INET,
  country VARCHAR(2),
  timestamp TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for common queries
  INDEX idx_vitals_name_timestamp (name, timestamp DESC),
  INDEX idx_vitals_url (url),
  INDEX idx_vitals_rating (rating)
);

-- Partition by month for large datasets
CREATE TABLE web_vitals_2025_01 PARTITION OF web_vitals
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### Analytics Queries

```sql
-- Daily Core Web Vitals summary (p75 is Google's standard)
SELECT
  DATE(timestamp) as date,
  name,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75,
  COUNT(CASE WHEN rating = 'good' THEN 1 END)::float / COUNT(*) * 100 as good_pct,
  COUNT(*) as samples
FROM web_vitals
WHERE timestamp > NOW() - INTERVAL '30 days'
  AND name IN ('LCP', 'INP', 'CLS')
GROUP BY DATE(timestamp), name
ORDER BY date DESC, name;

-- Worst performing pages by LCP
SELECT
  url,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75_lcp,
  COUNT(*) as samples
FROM web_vitals
WHERE name = 'LCP'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY url
HAVING COUNT(*) > 100
ORDER BY p75_lcp DESC
LIMIT 20;

-- Performance by connection type
SELECT
  connection_type,
  name,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75,
  COUNT(*) as samples
FROM web_vitals
WHERE timestamp > NOW() - INTERVAL '7 days'
  AND connection_type IS NOT NULL
GROUP BY connection_type, name
ORDER BY connection_type, name;

-- Trend analysis: Week-over-week comparison
WITH current_week AS (
  SELECT name, PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75
  FROM web_vitals
  WHERE timestamp > NOW() - INTERVAL '7 days'
  GROUP BY name
),
previous_week AS (
  SELECT name, PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75
  FROM web_vitals
  WHERE timestamp BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
  GROUP BY name
)
SELECT
  c.name,
  c.p75 as current_p75,
  p.p75 as previous_p75,
  ROUND((c.p75 - p.p75) / p.p75 * 100, 2) as change_pct
FROM current_week c
JOIN previous_week p ON c.name = p.name;
```

## Grafana Dashboard

### Prometheus Metrics Export

```typescript
// lib/metrics-exporter.ts
import { Histogram, Counter, Registry } from 'prom-client';

const registry = new Registry();

// Histogram for percentile calculations
const webVitalsHistogram = new Histogram({
  name: 'web_vitals_value',
  help: 'Web Vitals metric values',
  labelNames: ['name', 'rating'],
  buckets: {
    LCP: [1000, 1500, 2000, 2500, 3000, 4000, 5000],
    INP: [50, 100, 150, 200, 300, 500, 1000],
    CLS: [0.01, 0.05, 0.1, 0.15, 0.25, 0.5],
  }['LCP'], // Default buckets
  registers: [registry],
});

const webVitalsCounter = new Counter({
  name: 'web_vitals_total',
  help: 'Total count of Web Vitals reports',
  labelNames: ['name', 'rating'],
  registers: [registry],
});

export function recordMetric(name: string, value: number, rating: string) {
  webVitalsHistogram.labels(name, rating).observe(value);
  webVitalsCounter.labels(name, rating).inc();
}

export { registry };
```

### Grafana Alert Rules

```yaml
# grafana-alerts.yaml
groups:
  - name: core-web-vitals
    interval: 5m
    rules:
      # LCP Alert
      - alert: HighLCP
        expr: histogram_quantile(0.75, sum(rate(web_vitals_value_bucket{name="LCP"}[15m])) by (le)) > 2500
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "LCP p75 is {{ $value | printf \"%.0f\" }}ms (threshold: 2500ms)"
          description: "Largest Contentful Paint has degraded. Check recent deployments."

      # INP Alert
      - alert: HighINP
        expr: histogram_quantile(0.75, sum(rate(web_vitals_value_bucket{name="INP"}[15m])) by (le)) > 200
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "INP p75 is {{ $value | printf \"%.0f\" }}ms (threshold: 200ms)"
          description: "Interaction to Next Paint has degraded. Check for long tasks."

      # CLS Alert
      - alert: HighCLS
        expr: histogram_quantile(0.75, sum(rate(web_vitals_value_bucket{name="CLS"}[15m])) by (le)) > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "CLS p75 is {{ $value | printf \"%.3f\" }} (threshold: 0.1)"
          description: "Cumulative Layout Shift has degraded. Check for layout shifts."

      # Good rate dropping
      - alert: GoodRateDrop
        expr: |
          (sum(rate(web_vitals_total{rating="good"}[1h])) by (name) /
           sum(rate(web_vitals_total[1h])) by (name)) < 0.75
        for: 30m
        labels:
          severity: critical
        annotations:
          summary: "{{ $labels.name }} good rate dropped below 75%"
          description: "Less than 75% of users are experiencing good {{ $labels.name }}"
```

## Sampling Strategy for High Traffic

```typescript
// lib/vitals-sampled.ts
import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

interface SamplingConfig {
  // Base sample rate (0-1)
  baseRate: number;
  // Always sample poor metrics
  alwaysSamplePoor: boolean;
  // Sample more on specific pages
  pageMultipliers?: Record<string, number>;
}

const DEFAULT_CONFIG: SamplingConfig = {
  baseRate: 0.1, // 10% baseline
  alwaysSamplePoor: true,
  pageMultipliers: {
    '/': 1.0, // Always sample homepage
    '/checkout': 1.0, // Always sample checkout
  },
};

function shouldSample(metric: Metric, config: SamplingConfig): boolean {
  // Always sample poor metrics for debugging
  if (config.alwaysSamplePoor && metric.rating === 'poor') {
    return true;
  }

  // Check page-specific multiplier
  const path = window.location.pathname;
  const multiplier = config.pageMultipliers?.[path] ?? 1;
  const effectiveRate = config.baseRate * multiplier;

  return Math.random() < effectiveRate;
}

export function reportWebVitalsSampled(config = DEFAULT_CONFIG) {
  const report = (metric: Metric) => {
    if (shouldSample(metric, config)) {
      sendToAnalytics(metric);
    }
  };

  onCLS(report);
  onINP(report);
  onLCP(report);
}
```

## Testing RUM in Development

```typescript
// lib/vitals-dev.ts
import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

const RATING_COLORS = {
  good: 'color: green',
  'needs-improvement': 'color: orange',
  poor: 'color: red',
} as const;

function logToConsole(metric: Metric) {
  const color = RATING_COLORS[metric.rating];
  const unit = metric.name === 'CLS' ? '' : 'ms';

  console.log(
    `%c[${metric.name}] ${metric.value.toFixed(2)}${unit} (${metric.rating})`,
    color,
    {
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
    }
  );
}

export function reportWebVitalsDev() {
  // Report all changes for debugging
  onCLS(logToConsole, { reportAllChanges: true });
  onINP(logToConsole, { reportAllChanges: true });
  onLCP(logToConsole, { reportAllChanges: true });
}

// Usage in development
if (process.env.NODE_ENV === 'development') {
  reportWebVitalsDev();
}
```

## Integration with Analytics Providers

### Google Analytics 4

```typescript
// lib/vitals-ga4.ts
import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function sendToGA4(metric: Metric) {
  if (typeof window.gtag !== 'function') return;

  window.gtag('event', metric.name, {
    event_category: 'Web Vitals',
    event_label: metric.id,
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    metric_rating: metric.rating,
    non_interaction: true,
  });
}

export function reportWebVitalsGA4() {
  onCLS(sendToGA4);
  onINP(sendToGA4);
  onLCP(sendToGA4);
}
```

### Vercel Analytics

```typescript
// Next.js built-in support
// next.config.js
module.exports = {
  // Vercel Analytics automatically collects Web Vitals
  // No additional setup needed when deployed on Vercel
};

// For self-hosted, use @vercel/analytics
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```
