/**
 * Performance Monitoring Template
 * Complete implementation for tracking Core Web Vitals + custom metrics
 *
 * Features:
 * - Core Web Vitals (LCP, INP, CLS) collection
 * - Custom async operation timing
 * - Render performance measurement
 * - Batched reporting with sampling
 * - Device and connection metadata
 * - Development debugging mode
 */

import {
  onCLS,
  onINP,
  onLCP,
  onFCP,
  onTTFB,
  type Metric,
  type ReportOpts,
} from 'web-vitals';

// ============================================
// Types
// ============================================

export interface PerformanceMetric {
  name: string;
  value: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  id?: string;
  navigationType?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface ReporterConfig {
  /** API endpoint to send metrics */
  endpoint: string;
  /** Sample rate 0-1, default 1 (100%) */
  sampleRate?: number;
  /** Always sample poor metrics regardless of rate */
  alwaysSamplePoor?: boolean;
  /** Enable console logging for debugging */
  debug?: boolean;
  /** Batch metrics before sending */
  batchSize?: number;
  /** Max time to hold batch before sending (ms) */
  batchTimeout?: number;
  /** Custom headers for requests */
  headers?: Record<string, string>;
  /** Page-specific sample rate multipliers */
  pageMultipliers?: Record<string, number>;
}

interface DeviceInfo {
  userAgent: string;
  url: string;
  referrer: string;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  timestamp: number;
}

// ============================================
// Device & Connection Info
// ============================================

function getDeviceInfo(): DeviceInfo {
  const nav = navigator as Navigator & {
    connection?: {
      type?: string;
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
    };
    deviceMemory?: number;
  };

  return {
    userAgent: navigator.userAgent,
    url: window.location.href,
    referrer: document.referrer,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio,
    connectionType: nav.connection?.type,
    effectiveType: nav.connection?.effectiveType,
    downlink: nav.connection?.downlink,
    rtt: nav.connection?.rtt,
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    timestamp: Date.now(),
  };
}

// ============================================
// Performance Reporter Class
// ============================================

export class PerformanceReporter {
  private config: Required<ReporterConfig>;
  private queue: PerformanceMetric[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private deviceInfo: DeviceInfo | null = null;

  constructor(config: ReporterConfig) {
    this.config = {
      sampleRate: 1,
      alwaysSamplePoor: true,
      debug: false,
      batchSize: 10,
      batchTimeout: 5000,
      headers: {},
      pageMultipliers: {},
      ...config,
    };

    // Setup unload handler
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flush();
        }
      });

      // Capture device info once
      this.deviceInfo = getDeviceInfo();
    }
  }

  /**
   * Report a performance metric
   */
  report(metric: PerformanceMetric): void {
    // Sampling logic
    if (!this.shouldSample(metric)) {
      return;
    }

    // Debug logging
    if (this.config.debug) {
      this.logMetric(metric);
    }

    // Enrich with device info and timestamp
    const enrichedMetric: PerformanceMetric = {
      ...metric,
      metadata: {
        ...metric.metadata,
        ...this.deviceInfo,
        reportedAt: Date.now(),
      },
    };

    this.queue.push(enrichedMetric);

    // Flush if batch size reached
    if (this.queue.length >= this.config.batchSize) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  /**
   * Determine if metric should be sampled
   */
  private shouldSample(metric: PerformanceMetric): boolean {
    // Always sample poor metrics if configured
    if (this.config.alwaysSamplePoor && metric.rating === 'poor') {
      return true;
    }

    // Check page-specific multiplier
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    const multiplier = this.config.pageMultipliers[path] ?? 1;
    const effectiveRate = this.config.sampleRate * multiplier;

    return Math.random() < effectiveRate;
  }

  /**
   * Schedule a flush after timeout
   */
  private scheduleFlush(): void {
    if (this.flushTimeout) return;

    this.flushTimeout = setTimeout(() => {
      this.flush();
      this.flushTimeout = null;
    }, this.config.batchTimeout);
  }

  /**
   * Send queued metrics to the endpoint
   */
  flush(): void {
    if (this.queue.length === 0) return;

    const metrics = [...this.queue];
    this.queue = [];

    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    const payload = JSON.stringify({
      metrics,
      batchTimestamp: Date.now(),
    });

    // Use sendBeacon for reliability during page unload
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(this.config.endpoint, blob);
    } else {
      // Fallback to fetch with keepalive
      fetch(this.config.endpoint, {
        method: 'POST',
        body: payload,
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        keepalive: true,
      }).catch((error) => {
        if (this.config.debug) {
          console.error('[Performance Reporter] Failed to send metrics:', error);
        }
      });
    }
  }

  /**
   * Debug logging with color-coded output
   */
  private logMetric(metric: PerformanceMetric): void {
    const colors = {
      good: 'color: green; font-weight: bold',
      'needs-improvement': 'color: orange; font-weight: bold',
      poor: 'color: red; font-weight: bold',
    };

    const color = metric.rating ? colors[metric.rating] : 'color: gray';
    const unit = metric.name === 'CLS' ? '' : 'ms';

    console.log(
      `%c[${metric.name}] ${metric.value.toFixed(2)}${unit}`,
      color,
      metric.rating ? `(${metric.rating})` : '',
      metric.metadata ?? ''
    );
  }
}

// ============================================
// Web Vitals Integration
// ============================================

/**
 * Initialize Core Web Vitals monitoring
 */
export function initWebVitals(
  reporter: PerformanceReporter,
  opts?: ReportOpts
): void {
  const reportWebVital = (metric: Metric) => {
    reporter.report({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
    });
  };

  // Core Web Vitals (affect SEO)
  onLCP(reportWebVital, opts);
  onINP(reportWebVital, opts);
  onCLS(reportWebVital, opts);

  // Additional useful metrics
  onFCP(reportWebVital, opts);
  onTTFB(reportWebVital, opts);
}

// ============================================
// Custom Measurement Utilities
// ============================================

/**
 * Measure an async operation's duration
 *
 * @example
 * const data = await measureAsync(
 *   'api-fetch-users',
 *   () => fetch('/api/users').then(r => r.json()),
 *   reporter
 * );
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  reporter: PerformanceReporter,
  metadata?: Record<string, string | number | boolean>
): Promise<T> {
  const start = performance.now();
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;

  performance.mark(startMark);

  try {
    const result = await fn();
    const duration = performance.now() - start;

    performance.mark(endMark);
    performance.measure(name, startMark, endMark);

    reporter.report({
      name,
      value: duration,
      metadata: {
        type: 'async-operation',
        success: true,
        ...metadata,
      },
    });

    return result;
  } catch (error) {
    const duration = performance.now() - start;

    reporter.report({
      name,
      value: duration,
      metadata: {
        type: 'async-operation',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        ...metadata,
      },
    });

    throw error;
  } finally {
    // Cleanup marks
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(name);
  }
}

/**
 * Create a render timing measurement function
 * Call the returned function when render completes
 *
 * @example
 * function MyComponent() {
 *   const endRender = useMemo(
 *     () => measureRender('MyComponent', reporter),
 *     []
 *   );
 *
 *   useEffect(() => {
 *     endRender();
 *   }, [endRender]);
 * }
 */
export function measureRender(
  name: string,
  reporter: PerformanceReporter,
  metadata?: Record<string, string | number | boolean>
): () => void {
  const start = performance.now();

  return () => {
    const duration = performance.now() - start;
    reporter.report({
      name,
      value: duration,
      metadata: {
        type: 'render',
        ...metadata,
      },
    });
  };
}

/**
 * Create a React hook for measuring component render time
 *
 * @example
 * function ProductList({ products }) {
 *   useRenderMetric('ProductList', reporter, { itemCount: products.length });
 *   return <div>...</div>;
 * }
 */
export function createRenderHook(reporter: PerformanceReporter) {
  return function useRenderMetric(
    name: string,
    metadata?: Record<string, string | number | boolean>
  ): void {
    // This would be implemented with useEffect in the actual React app
    // Placeholder for demonstration
    const start = performance.now();

    // Simulate useEffect behavior
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        reporter.report({
          name,
          value: performance.now() - start,
          metadata: {
            type: 'render',
            ...metadata,
          },
        });
      });
    }
  };
}

// ============================================
// Long Task Observer
// ============================================

/**
 * Monitor long tasks (>50ms) that may impact INP
 */
export function observeLongTasks(
  reporter: PerformanceReporter,
  threshold = 50
): () => void {
  if (!('PerformanceObserver' in window)) {
    return () => {};
  }

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > threshold) {
        reporter.report({
          name: 'long-task',
          value: entry.duration,
          metadata: {
            type: 'long-task',
            startTime: entry.startTime,
            // Attribution if available
            ...(entry as PerformanceEntry & { attribution?: unknown[] }).attribution
              ? { attribution: JSON.stringify((entry as any).attribution) }
              : {},
          },
        });
      }
    }
  });

  try {
    observer.observe({ type: 'longtask', buffered: true });
  } catch {
    // Long task observation not supported
  }

  return () => observer.disconnect();
}

// ============================================
// Layout Shift Observer
// ============================================

/**
 * Monitor individual layout shifts for debugging CLS issues
 */
export function observeLayoutShifts(
  reporter: PerformanceReporter,
  minValue = 0.01
): () => void {
  if (!('PerformanceObserver' in window)) {
    return () => {};
  }

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const layoutShift = entry as PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
        sources?: Array<{ node?: Element }>;
      };

      // Only report unexpected shifts (not from user input)
      if (!layoutShift.hadRecentInput && layoutShift.value > minValue) {
        reporter.report({
          name: 'layout-shift',
          value: layoutShift.value,
          metadata: {
            type: 'layout-shift',
            startTime: entry.startTime,
            hadRecentInput: layoutShift.hadRecentInput,
            // Try to identify the shifting element
            element: layoutShift.sources?.[0]?.node?.nodeName ?? 'unknown',
          },
        });
      }
    }
  });

  try {
    observer.observe({ type: 'layout-shift', buffered: true });
  } catch {
    // Layout shift observation not supported
  }

  return () => observer.disconnect();
}

// ============================================
// Resource Timing
// ============================================

/**
 * Monitor resource loading performance
 */
export function observeResources(
  reporter: PerformanceReporter,
  filter?: (entry: PerformanceResourceTiming) => boolean
): () => void {
  if (!('PerformanceObserver' in window)) {
    return () => {};
  }

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const resource = entry as PerformanceResourceTiming;

      // Apply filter if provided
      if (filter && !filter(resource)) {
        continue;
      }

      reporter.report({
        name: 'resource-timing',
        value: resource.duration,
        metadata: {
          type: 'resource',
          resourceType: resource.initiatorType,
          name: resource.name,
          transferSize: resource.transferSize,
          encodedBodySize: resource.encodedBodySize,
          decodedBodySize: resource.decodedBodySize,
          // Timing breakdown
          dns: resource.domainLookupEnd - resource.domainLookupStart,
          tcp: resource.connectEnd - resource.connectStart,
          ttfb: resource.responseStart - resource.requestStart,
          download: resource.responseEnd - resource.responseStart,
        },
      });
    }
  });

  try {
    observer.observe({ type: 'resource', buffered: true });
  } catch {
    // Resource timing not supported
  }

  return () => observer.disconnect();
}

// ============================================
// LCP Element Detection
// ============================================

/**
 * Identify the LCP element for debugging
 */
export function detectLCPElement(
  callback: (element: Element | null, time: number) => void
): () => void {
  if (!('PerformanceObserver' in window)) {
    return () => {};
  }

  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
      element?: Element;
    };

    callback(lastEntry.element ?? null, lastEntry.startTime);
  });

  try {
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // LCP observation not supported
  }

  return () => observer.disconnect();
}

// ============================================
// Initialization Helper
// ============================================

/**
 * Initialize complete performance monitoring
 *
 * @example
 * const reporter = initPerformanceMonitoring({
 *   endpoint: '/api/vitals',
 *   sampleRate: 0.1, // 10% in production
 *   debug: process.env.NODE_ENV === 'development',
 *   pageMultipliers: {
 *     '/': 1.0,        // Always sample homepage
 *     '/checkout': 1.0, // Always sample checkout
 *   },
 * });
 *
 * // Measure custom operations
 * await measureAsync('api-fetch', () => fetchData(), reporter);
 */
export function initPerformanceMonitoring(
  config: ReporterConfig
): PerformanceReporter {
  const reporter = new PerformanceReporter(config);

  // Initialize Core Web Vitals
  initWebVitals(reporter);

  // Optionally enable additional observers in development
  if (config.debug) {
    observeLongTasks(reporter);
    observeLayoutShifts(reporter);

    // Log LCP element
    detectLCPElement((element, time) => {
      console.log('[LCP Element]', element, `at ${time.toFixed(0)}ms`);
    });
  }

  return reporter;
}

// ============================================
// React Integration Example
// ============================================

/**
 * Example React component for Web Vitals
 * Copy and adapt to your app
 */
export const WebVitalsComponent = `
'use client';

import { useEffect, useRef } from 'react';
import { initPerformanceMonitoring, PerformanceReporter } from './performance-monitoring';

// Singleton reporter
let reporterInstance: PerformanceReporter | null = null;

export function getReporter(): PerformanceReporter {
  if (!reporterInstance) {
    reporterInstance = initPerformanceMonitoring({
      endpoint: '/api/vitals',
      sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
      debug: process.env.NODE_ENV === 'development',
      alwaysSamplePoor: true,
      pageMultipliers: {
        '/': 1.0,
        '/checkout': 1.0,
        '/product/[id]': 0.5,
      },
    });
  }
  return reporterInstance;
}

export function WebVitals(): null {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Initialize monitoring
    getReporter();
  }, []);

  return null;
}

// Usage in layout
// export default function RootLayout({ children }) {
//   return (
//     <html>
//       <body>
//         <WebVitals />
//         {children}
//       </body>
//     </html>
//   );
// }
`;

// ============================================
// Type Exports
// ============================================

export type { Metric, ReportOpts };
