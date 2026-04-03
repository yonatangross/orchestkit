/**
 * HTTP Telemetry Sink — POSTs events to remote API with HMAC signature.
 *
 * Features:
 * - HMAC-SHA256 signed payloads (X-CC-Hooks-Signature header)
 * - 3 retries with full-jitter exponential backoff
 * - Circuit breaker (5 failures → OPEN, 30s cooldown → HALF_OPEN)
 * - Fire-and-forget: addEvent() starts async work, never blocks
 *
 * Process model: Each CC hook = separate Node.js process. Circuit breaker
 * state is persisted to a small JSON file so state survives across
 * process invocations. Reads are sync (fast, ~0.1ms), writes are async.
 *
 * #1260: Phase 4 enhancements — retry + circuit breaker.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { TelemetrySink, TelemetryEvent } from './telemetry.js';
import { signPayload } from './crypto.js';
import { logHook } from './common.js';
import { getWebhookUrl } from './orchestration-state.js';
import { getPluginDataDir, getProjectDir } from './paths.js';

const HOOK_NAME = 'http-sink';
const FETCH_TIMEOUT_MS = 3000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;
const MAX_DELAY_MS = 5000;

// Circuit breaker constants
const CB_FAILURE_THRESHOLD = 5;
const CB_COOLDOWN_MS = 30_000;

// ---------------------------------------------------------------------------
// Circuit Breaker (file-persisted across processes)
// ---------------------------------------------------------------------------

interface CircuitBreakerState {
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  consecutiveFailures: number;
  openedAt: number; // Unix ms timestamp when circuit opened
}

const DEFAULT_CB_STATE: CircuitBreakerState = {
  status: 'CLOSED',
  consecutiveFailures: 0,
  openedAt: 0,
};

function getCbStatePath(): string {
  const pluginData = getPluginDataDir();
  const base = pluginData || join(getProjectDir(), '.claude');
  return join(base, 'telemetry', 'circuit-breaker.json');
}

function readCbState(): CircuitBreakerState {
  try {
    const raw = readFileSync(getCbStatePath(), 'utf8');
    return { ...DEFAULT_CB_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CB_STATE };
  }
}

function writeCbState(state: CircuitBreakerState): void {
  try {
    const path = getCbStatePath();
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(path, JSON.stringify(state), 'utf8');
  } catch {
    // Non-critical — circuit breaker degrades to always-closed
  }
}

/**
 * Check if the circuit allows a request through.
 * Returns true if request should proceed, false if circuit is OPEN.
 */
function circuitAllows(): boolean {
  const state = readCbState();

  if (state.status === 'CLOSED') return true;

  if (state.status === 'OPEN') {
    const elapsed = Date.now() - state.openedAt;
    if (elapsed >= CB_COOLDOWN_MS) {
      // Transition to HALF_OPEN — allow one probe request
      writeCbState({ ...state, status: 'HALF_OPEN' });
      return true;
    }
    return false; // Still in cooldown
  }

  // HALF_OPEN — allow the probe request
  return true;
}

/**
 * Record a successful request — reset circuit to CLOSED.
 */
function recordSuccess(): void {
  const state = readCbState();
  if (state.consecutiveFailures > 0 || state.status !== 'CLOSED') {
    writeCbState(DEFAULT_CB_STATE);
  }
}

/**
 * Record a failed request — increment failures, potentially open circuit.
 */
function recordFailure(): void {
  const state = readCbState();
  const failures = state.consecutiveFailures + 1;

  if (failures >= CB_FAILURE_THRESHOLD) {
    writeCbState({ status: 'OPEN', consecutiveFailures: failures, openedAt: Date.now() });
    logHook(HOOK_NAME, `Circuit OPEN after ${failures} consecutive failures (30s cooldown)`);
  } else {
    writeCbState({ ...state, status: 'CLOSED', consecutiveFailures: failures });
  }
}

// ---------------------------------------------------------------------------
// Retry with full-jitter exponential backoff
// ---------------------------------------------------------------------------

function isRetriable(status: number): boolean {
  // 4xx = non-retriable (client error) EXCEPT 429 (rate limit)
  if (status >= 400 && status < 500 && status !== 429) return false;
  // 5xx = retriable (server error), 429 = retriable
  return true;
}

function jitterDelay(attempt: number): number {
  const expDelay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
  return Math.random() * expDelay; // Full jitter: uniform [0, expDelay]
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry. Returns true on success, false on exhaustion.
 */
async function fetchWithRetry(url: string, options: RequestInit): Promise<boolean> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) return true;

      if (!isRetriable(response.status)) {
        logHook(HOOK_NAME, `Non-retriable ${response.status} for ${url}`);
        return false;
      }

      // Retriable error — wait and try again (unless last attempt)
      if (attempt < MAX_RETRIES) {
        await sleep(jitterDelay(attempt));
      }
    } catch {
      // Network error, timeout, DNS failure — retriable
      if (attempt < MAX_RETRIES) {
        await sleep(jitterDelay(attempt));
      }
    }
  }

  return false; // All retries exhausted
}

// ---------------------------------------------------------------------------
// HttpSink
// ---------------------------------------------------------------------------

export class HttpSink implements TelemetrySink {
  readonly name = 'http';
  readonly supportedEvents: string[] = []; // all events

  addEvent(event: TelemetryEvent): void {
    const hookUrl = getWebhookUrl();
    const hookToken = process.env.ORCHESTKIT_HOOK_TOKEN;

    if (!hookUrl || !hookToken) return;

    // Circuit breaker gate
    if (!circuitAllows()) {
      logHook(HOOK_NAME, `Circuit OPEN — skipping ${event.event}`);
      return;
    }

    const body = JSON.stringify(event);
    const signature = signPayload(body, hookToken);
    const url = `${hookUrl.replace(/\/$/, '')}/cc-event`;

    // Fire-and-forget with retry — process stays alive until promise settles
    fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Hooks-Signature': signature,
      },
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }).then(success => {
      if (success) {
        recordSuccess();
        logHook(HOOK_NAME, `Forwarded ${event.event} to ${url}`);
      } else {
        recordFailure();
        logHook(HOOK_NAME, `Forward failed for ${event.event} after ${MAX_RETRIES + 1} attempts`);
      }
    }).catch(() => {
      recordFailure();
      logHook(HOOK_NAME, `Forward failed for ${event.event} (unexpected error)`);
    });
  }

  async flush(): Promise<void> {
    // HTTP sink is fire-and-forget — nothing to flush
  }
}

// Exported for testing
export { circuitAllows, recordSuccess, recordFailure, readCbState, writeCbState, fetchWithRetry, isRetriable, jitterDelay, getCbStatePath };
export type { CircuitBreakerState };
