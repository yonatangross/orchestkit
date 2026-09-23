/**
 * Shared HTTPS-only policy for telemetry sinks and orchestration webhooks (#4218).
 */

const warnedUrls = new Set<string>();

/**
 * True only when the URL parses and uses the https: scheme.
 * http://localhost and every other non-https scheme are refused.
 */
export function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Warn once per URL to stderr when a sink/webhook URL is refused.
 */
export function warnRefusedUrlOnce(url: string, kind: string): void {
  if (warnedUrls.has(url)) return;
  warnedUrls.add(url);
  process.stderr.write(
    `[ork] Refused ${kind} URL (https required, including no http://localhost): ${url}\n`
  );
}

/** Test helper. */
export function _resetWarnedUrlsForTesting(): void {
  warnedUrls.clear();
}

/**
 * Return the hostname for a URL, or null if unparseable.
 */
export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * True when the token's issued host matches the destination URL host.
 * Missing issued host => refuse (never attach bearer blindly).
 */
export function tokenHostMatchesUrl(issuedHost: string | null | undefined, url: string): boolean {
  if (!issuedHost) return false;
  const dest = hostnameOf(url);
  if (!dest) return false;
  return issuedHost.toLowerCase() === dest.toLowerCase();
}
