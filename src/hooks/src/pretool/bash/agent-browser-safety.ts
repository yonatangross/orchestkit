/**
 * Agent Browser Safety Hook
 * Validates agent-browser CLI commands for safety
 *
 * Features:
 * - URL blocklist (internal, OAuth providers)
 * - Sensitive action warnings
 * - Per-domain rate limiting (#318)
 * - robots.txt enforcement (#319)
 *
 * CC 2.1.9: Injects safety context via additionalContext
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
  outputAllowWithContext,
  logHook,
  logPermissionFeedback,
  getLogDir,
} from '../../lib/common.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Rate limit configuration (configurable via env vars)
 */
const RATE_LIMITS = {
  requestsPerMinute: parseInt(process.env.AGENT_BROWSER_RATE_LIMIT_PER_MIN || '10', 10),
  requestsPerHour: parseInt(process.env.AGENT_BROWSER_RATE_LIMIT_PER_HOUR || '100', 10),
  burstLimit: parseInt(process.env.AGENT_BROWSER_BURST_LIMIT || '3', 10),
};

/**
 * robots.txt cache TTL in milliseconds (default: 1 hour)
 */
const ROBOTS_CACHE_TTL = parseInt(process.env.AGENT_BROWSER_ROBOTS_CACHE_TTL || '3600000', 10);

/**
 * Blocked URL patterns for agent-browser
 */
const BLOCKED_URL_PATTERNS = [
  /localhost.*admin/i,
  /127\.0\.0\.1.*admin/i,
  /internal\./i,
  /intranet\./i,
  /\.local\//i,
  /file:\/\//i,
  // Auth/OAuth provider domains - sensitive login pages
  /accounts\.google\.com/i,
  /login\.microsoftonline\.com/i,
  /auth0\.com/i,
  /okta\.com/i,
  /login\.live\.com/i,
  /appleid\.apple\.com/i,
  /github\.com\/login/i,
  /gitlab\.com\/users\/sign_in/i,
];

/**
 * Sensitive action patterns
 */
const SENSITIVE_ACTIONS = [
  'click.*delete',
  'click.*remove',
  'fill.*password',
  'fill.*credit',
  'submit.*payment',
];

// =============================================================================
// Rate Limiting (#318)
// =============================================================================

interface RateLimitRecord {
  timestamps: number[];
  lastUpdated: number;
}

interface RateLimitStore {
  domains: Record<string, RateLimitRecord>;
}

/**
 * Get rate limit storage file path
 */
function getRateLimitFile(): string {
  const logDir = getLogDir();
  const rateDir = join(logDir, 'agent-browser');
  if (!existsSync(rateDir)) {
    mkdirSync(rateDir, { recursive: true });
  }
  return join(rateDir, 'rate-limits.json');
}

/**
 * Load rate limit store from disk
 */
function loadRateLimitStore(): RateLimitStore {
  const file = getRateLimitFile();
  try {
    if (existsSync(file)) {
      return JSON.parse(readFileSync(file, 'utf-8'));
    }
  } catch {
    // Corrupted file, start fresh
  }
  return { domains: {} };
}

/**
 * Save rate limit store to disk
 */
function saveRateLimitStore(store: RateLimitStore): void {
  const file = getRateLimitFile();
  try {
    writeFileSync(file, JSON.stringify(store, null, 2));
  } catch {
    // Ignore write errors
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Check if request is rate limited
 * Returns { allowed: true } or { allowed: false, reason: string }
 */
function checkRateLimit(domain: string): { allowed: boolean; reason?: string; remaining?: number } {
  const now = Date.now();
  const store = loadRateLimitStore();

  // Get or create domain record
  const record = store.domains[domain] || { timestamps: [], lastUpdated: now };

  // Filter to requests in the last minute
  const oneMinuteAgo = now - 60000;
  const oneHourAgo = now - 3600000;

  record.timestamps = record.timestamps.filter((t) => t > oneHourAgo);

  const requestsLastMinute = record.timestamps.filter((t) => t > oneMinuteAgo).length;
  const requestsLastHour = record.timestamps.length;

  // Check minute limit
  if (requestsLastMinute >= RATE_LIMITS.requestsPerMinute) {
    return {
      allowed: false,
      reason: `Rate limited: ${requestsLastMinute}/${RATE_LIMITS.requestsPerMinute} requests per minute to ${domain}`,
      remaining: 0,
    };
  }

  // Check hour limit
  if (requestsLastHour >= RATE_LIMITS.requestsPerHour) {
    return {
      allowed: false,
      reason: `Rate limited: ${requestsLastHour}/${RATE_LIMITS.requestsPerHour} requests per hour to ${domain}`,
      remaining: 0,
    };
  }

  // Check burst (rapid successive requests)
  const lastThreeSeconds = now - 3000;
  const recentBurst = record.timestamps.filter((t) => t > lastThreeSeconds).length;
  if (recentBurst >= RATE_LIMITS.burstLimit) {
    return {
      allowed: false,
      reason: `Burst limited: Too many rapid requests to ${domain}. Wait a moment.`,
      remaining: 0,
    };
  }

  // Allow and record
  record.timestamps.push(now);
  record.lastUpdated = now;
  store.domains[domain] = record;
  saveRateLimitStore(store);

  return {
    allowed: true,
    remaining: RATE_LIMITS.requestsPerMinute - requestsLastMinute - 1,
  };
}

// =============================================================================
// robots.txt Enforcement (#319)
// =============================================================================

interface RobotsCacheEntry {
  rules: string[];
  disallowedPaths: string[];
  expires: number;
  fetchedAt: number;
}

interface RobotsCache {
  entries: Record<string, RobotsCacheEntry>;
}

/**
 * Get robots.txt cache file path
 */
function getRobotsCacheFile(): string {
  const logDir = getLogDir();
  const cacheDir = join(logDir, 'agent-browser');
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
  return join(cacheDir, 'robots-cache.json');
}

/**
 * Load robots.txt cache from disk
 */
function loadRobotsCache(): RobotsCache {
  const file = getRobotsCacheFile();
  try {
    if (existsSync(file)) {
      return JSON.parse(readFileSync(file, 'utf-8'));
    }
  } catch {
    // Corrupted file, start fresh
  }
  return { entries: {} };
}

/**
 * Save robots.txt cache to disk
 */
function saveRobotsCache(cache: RobotsCache): void {
  const file = getRobotsCacheFile();
  try {
    writeFileSync(file, JSON.stringify(cache, null, 2));
  } catch {
    // Ignore write errors
  }
}

/**
 * Parse robots.txt content and extract disallowed paths for * user-agent
 */
function parseRobotsTxt(content: string): string[] {
  const disallowed: string[] = [];
  let inWildcardSection = false;

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();

    // Check for user-agent directive
    if (trimmed.startsWith('user-agent:')) {
      const agent = trimmed.replace('user-agent:', '').trim();
      inWildcardSection = agent === '*';
    }

    // Collect Disallow rules for * agent
    if (inWildcardSection && trimmed.startsWith('disallow:')) {
      const path = line.trim().replace(/^disallow:\s*/i, '').trim();
      if (path) {
        disallowed.push(path);
      }
    }
  }

  return disallowed;
}

/**
 * Fetch and cache robots.txt for a domain
 */
function fetchRobotsTxt(origin: string): RobotsCacheEntry | null {
  const cache = loadRobotsCache();
  const now = Date.now();

  // Check cache first
  const cached = cache.entries[origin];
  if (cached && cached.expires > now) {
    return cached;
  }

  // Fetch robots.txt (synchronous with timeout)
  const robotsUrl = `${origin}/robots.txt`;
  try {
    // Reject URLs containing shell metacharacters to prevent command injection
    if (/[`$\\;"'|&<>(){}!\n\r]/.test(robotsUrl)) {
      return null;
    }
    // Use curl with timeout for synchronous fetch
    const result = execSync(`curl -sL --max-time 5 "${robotsUrl}"`, {
      encoding: 'utf-8',
      timeout: 6000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const disallowed = parseRobotsTxt(result);
    const entry: RobotsCacheEntry = {
      rules: result.split('\n').slice(0, 50), // Store first 50 lines for debugging
      disallowedPaths: disallowed,
      expires: now + ROBOTS_CACHE_TTL,
      fetchedAt: now,
    };

    cache.entries[origin] = entry;
    saveRobotsCache(cache);

    return entry;
  } catch {
    // No robots.txt or fetch failed - create permissive entry
    const entry: RobotsCacheEntry = {
      rules: [],
      disallowedPaths: [],
      expires: now + ROBOTS_CACHE_TTL,
      fetchedAt: now,
    };
    cache.entries[origin] = entry;
    saveRobotsCache(cache);
    return entry;
  }
}

/**
 * Check if path is allowed by robots.txt
 */
function isAllowedByRobots(url: string): { allowed: boolean; reason?: string } {
  // Skip robots.txt check if explicitly disabled
  if (process.env.AGENT_BROWSER_IGNORE_ROBOTS === 'true') {
    return { allowed: true };
  }

  try {
    const parsed = new URL(url);
    const origin = parsed.origin;
    const path = parsed.pathname;

    const robots = fetchRobotsTxt(origin);
    if (!robots || robots.disallowedPaths.length === 0) {
      return { allowed: true };
    }

    // Check if path matches any disallowed pattern
    for (const disallowed of robots.disallowedPaths) {
      // Handle wildcard patterns
      if (disallowed.includes('*')) {
        // Escape regex special chars first, then convert escaped glob wildcards (\*) back to .*
        const escaped = disallowed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
        const regex = new RegExp(`^${escaped}`);
        if (regex.test(path)) {
          return {
            allowed: false,
            reason: `Blocked by robots.txt: ${disallowed}`,
          };
        }
      } else if (path.startsWith(disallowed)) {
        return {
          allowed: false,
          reason: `Blocked by robots.txt: ${disallowed}`,
        };
      }
    }

    return { allowed: true };
  } catch {
    // URL parsing failed - allow by default
    return { allowed: true };
  }
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Extract URL from agent-browser command
 */
function extractUrl(command: string): string | null {
  const urlMatch = command.match(/(?:navigate|goto|open)\s+["']?([^"'\s]+)["']?/i);
  return urlMatch ? urlMatch[1] : null;
}

/**
 * Check if URL is blocked
 */
function isBlockedUrl(url: string): boolean {
  return BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Check if action is sensitive
 */
function isSensitiveAction(command: string): boolean {
  return SENSITIVE_ACTIONS.some((pattern) => new RegExp(pattern, 'i').test(command));
}

// =============================================================================
// Main Hook
// =============================================================================

/**
 * Validate agent-browser commands for safety
 */
export function agentBrowserSafety(input: HookInput): HookResult {
  const command = input.tool_input.command || '';

  // Only process agent-browser commands
  if (!/agent-browser|ab\s/.test(command)) {
    return outputSilentSuccess();
  }

  // Extract URL from command
  const url = extractUrl(command);

  // Check 1: URL blocklist
  if (url && isBlockedUrl(url)) {
    logPermissionFeedback('deny', `Blocked URL: ${url}`, input);
    logHook('agent-browser-safety', `BLOCKED: ${url}`);

    return outputDeny(
      `agent-browser blocked: URL matches blocked pattern.

URL: ${url}

Blocked patterns include internal, localhost admin, and file:// URLs.
If this is intentional, use direct browser access instead.`
    );
  }

  // Check 2: Rate limiting (for navigation commands)
  if (url) {
    const domain = extractDomain(url);
    if (domain) {
      const rateCheck = checkRateLimit(domain);
      if (!rateCheck.allowed) {
        logPermissionFeedback('deny', rateCheck.reason || 'Rate limited', input);
        logHook('agent-browser-safety', `RATE LIMITED: ${domain}`);

        return outputDeny(
          `agent-browser rate limited.

${rateCheck.reason}

Limits: ${RATE_LIMITS.requestsPerMinute}/min, ${RATE_LIMITS.requestsPerHour}/hour
Configure via AGENT_BROWSER_RATE_LIMIT_PER_MIN and AGENT_BROWSER_RATE_LIMIT_PER_HOUR env vars.

Wait a moment before retrying, or use --session <name> for isolated sessions.`
        );
      }
    }
  }

  // Check 3: robots.txt enforcement
  if (url) {
    const robotsCheck = isAllowedByRobots(url);
    if (!robotsCheck.allowed) {
      logPermissionFeedback('deny', robotsCheck.reason || 'Blocked by robots.txt', input);
      logHook('agent-browser-safety', `ROBOTS BLOCKED: ${url}`);

      return outputDeny(
        `agent-browser blocked by robots.txt.

URL: ${url}
${robotsCheck.reason}

The website's robots.txt disallows automated access to this path.
Set AGENT_BROWSER_IGNORE_ROBOTS=true to override (not recommended).`
      );
    }
  }

  // Check 4: Sensitive actions
  if (isSensitiveAction(command)) {
    const domain = url ? extractDomain(url) : 'unknown';
    const rateCheck = url && domain ? checkRateLimit(domain) : { remaining: '?' };

    const context = `Sensitive browser action detected:
${command.slice(0, 100)}...

This may interact with:
- Delete/remove buttons
- Password fields
- Payment forms

Rate limit remaining: ${rateCheck.remaining}/${RATE_LIMITS.requestsPerMinute} per minute

Proceed with caution. Verify target elements.`;

    logPermissionFeedback('allow', 'Sensitive action warning', input);
    logHook('agent-browser-safety', 'Sensitive action detected');
    return outputAllowWithContext(context);
  }

  // Safe command
  logPermissionFeedback('allow', 'agent-browser command validated', input);
  return outputSilentSuccess();
}
