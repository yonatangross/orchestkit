/**
 * Config-based Sink Registry: loads telemetry sinks from user-scope config only.
 *
 * Resolution order (all additive):
 *   1. Built-in sinks: JsonlSink (always), HttpSink (if HTTPS URL + token configured)
 *   2. User sinks: ~/.claude/settings.local.json and CLAUDE_PLUGIN_DATA/settings.local.json
 *      -> telemetry.sinks[]
 *
 * NEVER reads sink config from getProjectDir() (#4218 / audit HR-2).
 * Every sink URL must be https:; anything else is skipped with a one-shot stderr warning.
 *
 * Each sink config: { type: "http", url: "...", token: "...", hmacSecret?: "..." }
 * Currently only "http" type is supported for user sinks.
 *
 * Deduplication: registerSink() is idempotent by name. First-registered wins.
 *
 * #1260: Phase 4A, config-based sink registry.
 * #4218: User-scope only + https-only.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerSink } from './telemetry.js';
import { JsonlSink } from './jsonl-sink.js';
import { HttpSink } from './http-sink.js';
import { getWebhookUrl, getHookToken } from './orchestration-state.js';
import { getHomeDir, getPluginDataDir } from './paths.js';
import { logHook } from './common.js';
import { isHttpsUrl, warnRefusedUrlOnce } from './sink-url-policy.js';

const HOOK_NAME = 'sink-registry';

// ---------------------------------------------------------------------------
// Sink Config Types
// ---------------------------------------------------------------------------

export interface SinkConfig {
  type: 'http';
  name?: string;
  url: string;
  token: string;
  hmacSecret?: string;
}

export interface TelemetryConfig {
  sinks?: SinkConfig[];
}

/** Hosts of registered HTTP sinks (for SessionStart announcement). */
const registeredHttpHosts: string[] = [];
let sinkHostsAnnounced = false;

// ---------------------------------------------------------------------------
// Config Loading
// ---------------------------------------------------------------------------

/**
 * Read and parse a JSON file, returning undefined on any error.
 */
function readJsonFile(path: string): Record<string, unknown> | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    logHook(HOOK_NAME, `Failed to parse ${path}`);
    return undefined;
  }
}

/**
 * Extract telemetry.sinks[] from a parsed JSON config.
 * Returns empty array if not present or invalid.
 * Drops non-https URLs (#4218).
 */
function extractSinkConfigs(config: Record<string, unknown> | undefined): SinkConfig[] {
  if (!config) return [];

  const telemetry = config.telemetry as TelemetryConfig | undefined;
  if (!telemetry || !Array.isArray(telemetry.sinks)) return [];

  const raw = telemetry.sinks.filter((s): s is SinkConfig => {
    if (!s || typeof s !== 'object') return false;
    return (
      (s as { type?: string }).type === 'http' &&
      typeof (s as { url?: string }).url === 'string' &&
      typeof (s as { token?: string }).token === 'string'
    );
  });

  const allowed: SinkConfig[] = [];
  for (const sink of raw) {
    if (!isHttpsUrl(sink.url)) {
      warnRefusedUrlOnce(sink.url, 'telemetry sink');
      continue;
    }
    allowed.push(sink);
  }
  return allowed;
}

/**
 * Project-tree plugin.json is never trusted for sinks (#4218).
 * Kept as a no-op export so callers/tests can assert the boundary.
 */
export function loadPluginSinkConfigs(): SinkConfig[] {
  return [];
}

/**
 * User-scope settings paths (home + CLAUDE_PLUGIN_DATA). Never project tree.
 */
function userSinkConfigPaths(): string[] {
  const paths: string[] = [join(getHomeDir(), '.claude', 'settings.local.json')];
  const pluginData = getPluginDataDir();
  if (pluginData) {
    paths.push(join(pluginData, 'settings.local.json'));
  }
  return paths;
}

/**
 * Load sink configs from user-scope settings only (#4218).
 */
export function loadUserSinkConfigs(): SinkConfig[] {
  const seen = new Set<string>();
  const out: SinkConfig[] = [];
  for (const settingsPath of userSinkConfigPaths()) {
    for (const sink of extractSinkConfigs(readJsonFile(settingsPath))) {
      const key = sink.name || sink.url;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(sink);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sink Factory
// ---------------------------------------------------------------------------

/**
 * Derive a sink name from a URL (for deduplication).
 */
function sinkNameFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return `http-${hostname}`;
  } catch {
    return `http-custom`;
  }
}

function trackHost(url: string): void {
  try {
    const host = new URL(url).host;
    if (!registeredHttpHosts.includes(host)) registeredHttpHosts.push(host);
  } catch {
    // ignore
  }
}

/**
 * Hosts of HTTP sinks registered in this process (SessionStart visibility).
 */
export function getRegisteredHttpSinkHosts(): string[] {
  return [...registeredHttpHosts];
}

/**
 * Print registered sink hosts once (stderr + return string for systemMessage).
 * Hosts only: never tokens or full URLs.
 */
export function announceRegisteredSinkHosts(): string | null {
  if (sinkHostsAnnounced) return null;
  sinkHostsAnnounced = true;
  const hosts = getRegisteredHttpSinkHosts();
  const message =
    hosts.length === 0
      ? 'ORK telemetry: no HTTP sinks registered (user-scope https only).'
      : `ORK telemetry sink hosts: ${hosts.join(', ')}`;
  process.stderr.write(`[ork sink-registry] ${message}\n`);
  return message;
}

/** Test helper: reset announcement + host tracking. */
export function _resetSinkRegistryAnnounceForTesting(): void {
  registeredHttpHosts.length = 0;
  sinkHostsAnnounced = false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register all sinks: built-in + user-scope config.
 *
 * Called at module scope in webhook-forwarder.ts (once per process) and at
 * SessionStart so hosts can be announced (#4218).
 * Safe to call multiple times (registerSink deduplicates by name).
 */
export function registerAllSinks(): void {
  // 1. Built-in: JSONL (always-on local safety net)
  registerSink(new JsonlSink());

  // 2. Built-in: HTTP (if HTTPS URL + token are configured via userConfig/env)
  const hookUrl = getWebhookUrl();
  const hookToken = getHookToken();
  if (hookUrl && hookToken) {
    registerSink(new HttpSink());
    trackHost(hookUrl);
  }

  // 3. User sinks from user-scope settings only (never project tree)
  const userSinks = loadUserSinkConfigs();
  for (const config of userSinks) {
    try {
      const name = config.name || sinkNameFromUrl(config.url);
      registerSink(new HttpSink({ name, url: config.url, token: config.token }));
      trackHost(config.url);
      logHook(HOOK_NAME, `Registered user sink: ${name}`);
    } catch {
      logHook(HOOK_NAME, `Failed to create sink from user config: ${config.url}`);
    }
  }

}
