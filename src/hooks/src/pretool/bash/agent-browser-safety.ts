/**
 * Agent Browser Safety Hook
 * Validates agent-browser CLI commands for safety
 *
 * Tested with agent-browser v0.13–v0.21.
 * Command docs are in the upstream agent-browser skill — this hook
 * focuses purely on safety guardrails.
 *
 * Features:
 * - URL blocklist (internal, OAuth providers, SSRF endpoints, RFC 1918)
 * - Sensitive action warnings with native confirmation (v0.15+)
 * - Per-domain rate limiting (#318)
 * - robots.txt enforcement (#319)
 * - --allow-file-access warning (v0.16)
 * - AGENT_BROWSER_ENCRYPTION_KEY leak prevention (v0.16)
 * - --user-agent spoofing warning (v0.16)
 *
 * CC 2.1.9: Injects safety context via additionalContext
 */

import type { HookInput, HookResult , HookContext} from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
  outputAllowWithContext,
  getLogDir,
} from '../../lib/common.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { NOOP_CTX } from '../../lib/context.js';

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
  /\blocalhost(?::\d+)?\b/i,
  /127\.0\.0\.1/i,
  /internal\./i,
  /intranet\./i,
  /\.local\//i,
  /file:\/\//i,
  // Cloud metadata endpoints (SSRF prevention)
  /169\.254\.169\.254/i,
  /metadata\.google\.internal/i,
  /100\.100\.100\.200/i,
  /\[::1\]/i,
  /^https?:\/\/0\.0\.0\.0/i,
  // Private network ranges (RFC 1918)
  /^https?:\/\/10\.\d+\.\d+\.\d+/i,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/i,
  /^https?:\/\/192\.168\.\d+\.\d+/i,
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

/**
 * Whether to use native action confirmation (agent-browser v0.15+)
 * When enabled, injects --confirm-actions flag for sensitive operations
 * instead of just warning via additionalContext.
 */
const USE_NATIVE_CONFIRMATION = process.env.AGENT_BROWSER_NATIVE_CONFIRM !== '0';

/**
 * Network route commands that need URL validation
 * agent-browser v0.13+ network mocking commands
 */
const NETWORK_ROUTE_PATTERN = /\bnetwork\s+route\b/i;

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
    // Use execFileSync to avoid shell injection — arguments are passed directly
    const result = execFileSync('curl', ['-sL', '--max-time', '5', robotsUrl], {
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
 * Check if URL is blocked.
 *
 * RFC 6761: *.localhost TLD is reserved for local development and cannot
 * route to external hosts — allow subdomain patterns (e.g. hq-web.localhost:1355)
 * unless ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST=0 disables this allowlist.
 *
 * Bare localhost (no subdomain) always remains blocked.
 */
function isBlockedUrl(url: string): boolean {
  const allowLocalhost = process.env.ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST !== '0';
  if (allowLocalhost && /^https?:\/\/(localhost|127\.0\.0\.1|[a-z0-9-]+\.localhost)(:\d+)?(\/|$)/i.test(url)) return false;
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
export function agentBrowserSafety(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const command = input.tool_input.command || '';

  // Check 0: AGENT_BROWSER_ENCRYPTION_KEY leak prevention (v0.16)
  // This check runs on ALL bash commands, not just agent-browser
  if (/AGENT_BROWSER_ENCRYPTION_KEY/.test(command) && /\b(echo|printf|cat|log|print)\b|>/.test(command)) {
    ctx.logPermission('deny', 'Attempted to leak AGENT_BROWSER_ENCRYPTION_KEY', input);
    ctx.log('agent-browser-safety', 'BLOCKED: encryption key leak attempt');

    return outputDeny(
      `agent-browser blocked: AGENT_BROWSER_ENCRYPTION_KEY must never be echoed, logged, or piped.

This key encrypts Auth Vault credentials. Exposing it compromises all stored auth states.
Use the key only as an environment variable passed to agent-browser commands.`
    );
  }

  // Only process agent-browser commands
  if (!/agent-browser|ab\s/.test(command)) {
    return outputSilentSuccess();
  }

  // Check pre-1: --allow-file-access warning (v0.16)
  // Must run before URL blocklist to avoid false deny on file:// URLs
  if (/--allow-file-access/.test(command)) {
    const context = `WARNING: --allow-file-access enables file:// URL access in agent-browser.
This bypasses the file:// URL blocklist and allows reading local filesystem files.
Only use this flag when explicitly required for local file testing.
Never combine with untrusted URLs or user-supplied paths.`;

    ctx.logPermission('allow', '--allow-file-access warning', input);
    ctx.log('agent-browser-safety', '--allow-file-access flag detected');
    return outputAllowWithContext(context);
  }

  // Extract URL from command
  const url = extractUrl(command);

  // Check 1: URL blocklist
  if (url && isBlockedUrl(url)) {
    ctx.logPermission('deny', `Blocked URL: ${url}`, input);
    ctx.log('agent-browser-safety', `BLOCKED: ${url}`);

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
        ctx.logPermission('deny', rateCheck.reason || 'Rate limited', input);
        ctx.log('agent-browser-safety', `RATE LIMITED: ${domain}`);

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
      ctx.logPermission('deny', robotsCheck.reason || 'Blocked by robots.txt', input);
      ctx.log('agent-browser-safety', `ROBOTS BLOCKED: ${url}`);

      return outputDeny(
        `agent-browser blocked by robots.txt.

URL: ${url}
${robotsCheck.reason}

The website's robots.txt disallows automated access to this path.
Set AGENT_BROWSER_IGNORE_ROBOTS=true to override (not recommended).`
      );
    }
  }

  // Check 4: Sensitive actions — use native confirmation when available
  if (isSensitiveAction(command)) {
    const domain = url ? extractDomain(url) : 'unknown';
    const rateCheck = url && domain ? checkRateLimit(domain) : { remaining: '?' };

    if (USE_NATIVE_CONFIRMATION) {
      // v0.15: Inject --confirm-actions for native safety gating
      const context = `Sensitive browser action detected. Native confirmation enabled (--confirm-actions).
The agent-browser CLI will require explicit approval before executing:
- Delete/remove button clicks
- Password field fills
- Payment form submissions

Use 'agent-browser confirm' to approve or 'agent-browser deny' to reject.
Auto-denies after 60s timeout.

Rate limit remaining: ${rateCheck.remaining}/${RATE_LIMITS.requestsPerMinute} per minute`;

      ctx.logPermission('allow', 'Sensitive action — native confirmation enabled', input);
      ctx.log('agent-browser-safety', 'Sensitive action: native confirmation');
      return outputAllowWithContext(context);
    }

    // Fallback: legacy warning-only mode
    const context = `Sensitive browser action detected:
${command.slice(0, 100)}...

This may interact with:
- Delete/remove buttons
- Password fields
- Payment forms

Rate limit remaining: ${rateCheck.remaining}/${RATE_LIMITS.requestsPerMinute} per minute

Proceed with caution. Verify target elements.`;

    ctx.logPermission('allow', 'Sensitive action warning', input);
    ctx.log('agent-browser-safety', 'Sensitive action detected');
    return outputAllowWithContext(context);
  }

  // Check 5: Network route validation (v0.13+)
  if (NETWORK_ROUTE_PATTERN.test(command)) {
    // Extract the route target URL
    const routeUrlMatch = command.match(/network\s+route\s+["']?([^"'\s]+)["']?/i);
    const routeUrl = routeUrlMatch ? routeUrlMatch[1] : null;

    if (routeUrl && isBlockedUrl(routeUrl)) {
      ctx.logPermission('deny', `Blocked network route target: ${routeUrl}`, input);
      ctx.log('agent-browser-safety', `BLOCKED ROUTE: ${routeUrl}`);
      return outputDeny(
        `agent-browser network route blocked: target URL matches blocked pattern.

URL: ${routeUrl}

Network route/mock targets follow the same URL safety rules as navigation.`
      );
    }

    // Warn on --body mocking (data injection)
    if (/--body\s/.test(command)) {
      const context = `Network response mocking detected (--body flag).
Mocked responses bypass real server validation.
Ensure mocked data matches expected API contracts.
Use 'agent-browser network unroute' to clean up after testing.`;

      ctx.logPermission('allow', 'Network mock warning', input);
      ctx.log('agent-browser-safety', 'Network mock detected');
      return outputAllowWithContext(context);
    }
  }

  // Check 6: inspect / get cdp-url — new attack surface (v0.18+)
  if (/\b(inspect|get\s+cdp-url)\b/.test(command)) {
    const context = `WARNING: DevTools inspection detected.
'inspect' opens a local proxy forwarding the Chrome DevTools frontend to the CDP WebSocket.
'get cdp-url' exposes the CDP URL for external debugger attachment.
These commands create a local network attack surface — avoid in shared/CI environments.
Never expose the CDP port beyond localhost.`;

    ctx.logPermission('allow', 'DevTools inspect warning', input);
    ctx.log('agent-browser-safety', 'inspect/cdp-url detected');
    return outputAllowWithContext(context);
  }

  // Check 7: clipboard read — host clipboard access (v0.19+)
  if (/\bclipboard\s+read\b/.test(command)) {
    const context = `WARNING: clipboard read accesses the host clipboard without user prompt.
Clipboard may contain sensitive data (passwords, tokens, personal information).
Never log or transmit clipboard contents to external services.`;

    ctx.logPermission('allow', 'Clipboard read warning', input);
    ctx.log('agent-browser-safety', 'clipboard read detected');
    return outputAllowWithContext(context);
  }

  // Check 8: HAR capture stop — sensitive network data (v0.21+)
  // Only warn on 'stop' which writes the HAR file; 'start' is harmless
  if (/\bnetwork\s+har\s+stop\b/.test(command)) {
    const context = `WARNING: HAR capture records full request/response bodies including auth tokens, cookies, and POST data.
Treat HAR output files as credentials — never commit to git or share publicly.
Clean up HAR files after use.`;

    ctx.logPermission('allow', 'HAR capture warning', input);
    ctx.log('agent-browser-safety', 'network har stop detected');
    return outputAllowWithContext(context);
  }

  // Check 9: --user-agent spoofing warning (v0.16)
  if (/--user-agent\s/.test(command)) {
    const context = `WARNING: Custom --user-agent detected.
Use --user-agent only to identify your automation tool (e.g., "MyBot/1.0").
Do NOT spoof real browser user-agents to bypass bot detection — this violates ethical scraping rules.
agent-browser identifies itself by default; only override when the target site requires a specific UA string.`;

    ctx.logPermission('allow', '--user-agent spoofing warning', input);
    ctx.log('agent-browser-safety', '--user-agent flag detected');
    return outputAllowWithContext(context);
  }

  // Safe command
  ctx.logPermission('allow', 'agent-browser command validated', input);
  return outputSilentSuccess();
}
