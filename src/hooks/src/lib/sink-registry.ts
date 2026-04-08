/**
 * Config-based Sink Registry -- loads telemetry sinks from plugin + user config.
 *
 * Resolution order (all additive, run in parallel):
 *   1. Built-in sinks: JsonlSink (always), HttpSink (if URL + token configured)
 *   2. Plugin sinks: plugin.json -> telemetry.sinks[]
 *   3. User sinks: .claude/settings.local.json -> telemetry.sinks[]
 *
 * Each sink config: { type: "http", url: "...", token: "...", hmacSecret?: "..." }
 * Currently only "http" type is supported for user/plugin sinks.
 *
 * Deduplication: registerSink() is idempotent by name. Plugin sinks register
 * before user sinks, so plugin names win on collision (first-registered wins).
 *
 * #1260: Phase 4A -- Config-based sink registry.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerSink } from './telemetry.js';
import { JsonlSink } from './jsonl-sink.js';
import { HttpSink } from './http-sink.js';
import { getWebhookUrl } from './orchestration-state.js';
import { getProjectDir } from './paths.js';
import { logHook } from './common.js';

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
 */
function extractSinkConfigs(config: Record<string, unknown> | undefined): SinkConfig[] {
  if (!config) return [];

  const telemetry = config.telemetry as TelemetryConfig | undefined;
  if (!telemetry || !Array.isArray(telemetry.sinks)) return [];

  return telemetry.sinks.filter((s): s is SinkConfig => {
    if (!s || typeof s !== 'object') return false;
    return (s as { type?: string }).type === 'http'
      && typeof (s as { url?: string }).url === 'string'
      && typeof (s as { token?: string }).token === 'string';
  });
}

/**
 * Load sink configs from plugin.json at project root.
 */
export function loadPluginSinkConfigs(): SinkConfig[] {
  const pluginJsonPath = join(getProjectDir(), 'plugin.json');
  return extractSinkConfigs(readJsonFile(pluginJsonPath));
}

/**
 * Load sink configs from .claude/settings.local.json.
 */
export function loadUserSinkConfigs(): SinkConfig[] {
  const settingsPath = join(getProjectDir(), '.claude', 'settings.local.json');
  return extractSinkConfigs(readJsonFile(settingsPath));
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register all sinks: built-in + plugin config + user config.
 *
 * Called at module scope in webhook-forwarder.ts (once per process).
 * Safe to call multiple times (registerSink deduplicates by name).
 */
export function registerAllSinks(): void {
  // 1. Built-in: JSONL (always-on local safety net)
  registerSink(new JsonlSink());

  // 2. Built-in: HTTP (if URL + token are configured via env/config)
  const hookUrl = getWebhookUrl();
  const hookToken = process.env.ORCHESTKIT_HOOK_TOKEN;
  if (hookUrl && hookToken) {
    registerSink(new HttpSink());
  }

  // 3. Plugin sinks from plugin.json
  const pluginSinks = loadPluginSinkConfigs();
  for (const config of pluginSinks) {
    try {
      const name = config.name || sinkNameFromUrl(config.url);
      registerSink(new HttpSink({ name, url: config.url, token: config.token }));
      logHook(HOOK_NAME, `Registered plugin sink: ${name}`);
    } catch {
      logHook(HOOK_NAME, `Failed to create sink from plugin config: ${config.url}`);
    }
  }

  // 4. User sinks from settings.local.json
  const userSinks = loadUserSinkConfigs();
  for (const config of userSinks) {
    try {
      const name = config.name || sinkNameFromUrl(config.url);
      registerSink(new HttpSink({ name, url: config.url, token: config.token }));
      logHook(HOOK_NAME, `Registered user sink: ${name}`);
    } catch {
      logHook(HOOK_NAME, `Failed to create sink from user config: ${config.url}`);
    }
  }
}
