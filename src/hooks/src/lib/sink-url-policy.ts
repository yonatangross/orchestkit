/**
 * Shared HTTPS-only policy for telemetry sinks and orchestration webhooks (#4218).
 */

const warnedHosts = new Set<string>();

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
 * Return the hostname for a URL, or null if unparseable.
 * Never returns userinfo/credentials.
 */
export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Warn once per host to stderr when a sink/webhook URL is refused.
 * Prints the host only (never the full URL, never credentials/token).
 */
export function warnRefusedUrlOnce(url: string, kind: string): void {
  const host = hostnameOf(url) ?? '(unparseable)';
  if (warnedHosts.has(host)) return;
  warnedHosts.add(host);
  process.stderr.write(
    `[ork] Refused ${kind} (https required, including no http localhost): host ${host}\n`
  );
}

/** Test helper. */
export function _resetWarnedUrlsForTesting(): void {
  warnedHosts.clear();
}

/**
 * True when the token's issued host matches the destination URL host.
 * Missing issued host => refuse (caller may supply a fallback host first).
 */
export function tokenHostMatchesUrl(issuedHost: string | null | undefined, url: string): boolean {
  if (!issuedHost) return false;
  const dest = hostnameOf(url);
  if (!dest) return false;
  return issuedHost.toLowerCase() === dest.toLowerCase();
}
