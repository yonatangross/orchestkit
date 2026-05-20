/**
 * HMAC signing for OrchestKit hook deliveries.
 *
 * Spec: packages/hook-contract/docs/signing-rfc.md (M141-4)
 *
 * Zero runtime deps — uses node:crypto only.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export type Reason =
  | 'ok'
  | 'missing_header'
  | 'malformed_header'
  | 'stale'
  | 'signature_mismatch'
  | 'weak_secret';

export interface VerifyResult {
  valid: boolean;
  reason: Reason;
}

export interface SignOptions {
  /** Unix seconds. Defaults to `Math.floor(Date.now() / 1000)`. */
  timestamp?: number;
  /** Scheme label, e.g. `"v1"`. Defaults to `"v1"`. */
  scheme?: string;
}

export interface VerifyOptions {
  /** Unix seconds used as the verifier's reference time. Defaults to current time. */
  now?: number;
  /** Replay tolerance in seconds. Defaults to 300. */
  toleranceSec?: number;
  /** Called once with `"weak_secret"` if any provided secret is shorter than 32 bytes. */
  onWarning?: (reason: Reason) => void;
}

const HEADER_NAME = 'X-CC-Hooks-Signature';
const DEFAULT_TOLERANCE_SEC = 300;
const HEX_DIGEST_LEN = 64;
const SCHEME_PATTERN = /^v[0-9]+$/;
const DIGITS_ONLY = /^[0-9]+$/;
const HEX_ONLY = /^[0-9a-f]+$/;
/** DoS cap. Well above any legitimate multi-scheme rotation header (~200 bytes). */
const MAX_HEADER_BYTES = 8192;
/** 10 digits of unix seconds covers through year 2286, fits in a safe-integer Number. */
const MAX_TIMESTAMP_DIGITS = 10;

/** Recommended minimum secret length in bytes. Below this triggers the `weak_secret` advisory. */
export const MIN_SECRET_BYTES = 32;

/** Header name constant for consumers building Express/Fastify/etc. middleware. */
export const HOOK_SIGNATURE_HEADER = HEADER_NAME;

function toBytes(value: Uint8Array | string): Uint8Array {
  if (value instanceof Uint8Array) return value;
  return Buffer.from(value, 'utf8');
}

function hmacHex(secret: Uint8Array, payload: Uint8Array): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function concatSignedPayload(timestampStr: string, body: Uint8Array): Uint8Array {
  const prefix = Buffer.from(`${timestampStr}.`, 'ascii');
  const out = Buffer.alloc(prefix.length + body.length);
  prefix.copy(out, 0);
  Buffer.from(body.buffer, body.byteOffset, body.byteLength).copy(out, prefix.length);
  return out;
}

/**
 * Sign a request body and return the full `X-CC-Hooks-Signature` header value.
 *
 * Example:
 *   const header = sign(bodyBytes, secret);
 *   // → "t=1731000000,v1=4c2f...e9"
 *   fetch(url, { method: 'POST', headers: { 'X-CC-Hooks-Signature': header }, body: bodyBytes });
 */
export function sign(
  body: Uint8Array,
  secret: Uint8Array | string,
  opts: SignOptions = {},
): string {
  const secretBytes = toBytes(secret);
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const scheme = opts.scheme ?? 'v1';

  if (!Number.isInteger(timestamp) || timestamp < 0) {
    throw new TypeError(`sign: timestamp must be a non-negative integer, got ${timestamp}`);
  }
  if (!SCHEME_PATTERN.test(scheme)) {
    throw new TypeError(`sign: scheme must match /^v[0-9]+$/, got "${scheme}"`);
  }

  const timestampStr = String(timestamp);
  const digest = hmacHex(secretBytes, concatSignedPayload(timestampStr, body));
  return `t=${timestampStr},${scheme}=${digest}`;
}

interface ParsedHeader {
  tRaw: string;
  schemes: Map<string, string>;
}

function parseHeader(header: string): ParsedHeader | null {
  if (header.length === 0) return null;
  if (header.length > MAX_HEADER_BYTES) return null;

  const pairs = header.split(',');
  let tRaw: string | undefined;
  const schemes = new Map<string, string>();

  for (const pair of pairs) {
    if (pair.length === 0) return null;
    const eqIdx = pair.indexOf('=');
    if (eqIdx <= 0 || eqIdx === pair.length - 1) return null;
    const key = pair.slice(0, eqIdx);
    const value = pair.slice(eqIdx + 1);

    if (key === 't') {
      if (tRaw !== undefined) return null;
      if (!DIGITS_ONLY.test(value)) return null;
      tRaw = value;
    } else if (SCHEME_PATTERN.test(key)) {
      if (schemes.has(key)) return null;
      const lowered = value.toLowerCase();
      if (lowered.length !== HEX_DIGEST_LEN || !HEX_ONLY.test(lowered)) return null;
      schemes.set(key, lowered);
    } else {
      return null;
    }
  }

  if (tRaw === undefined) return null;
  if (schemes.size === 0) return null;

  return { tRaw, schemes };
}

function normalizeSecrets(
  secret: Uint8Array | string | Array<Uint8Array | string>,
): Uint8Array[] {
  if (Array.isArray(secret)) {
    if (secret.length === 0) {
      throw new TypeError('verify: secret array must contain at least one secret');
    }
    return secret.map(toBytes);
  }
  return [toBytes(secret)];
}

/**
 * Verify a request signature. Never throws on bad input — every failure maps to a `Reason`.
 *
 * Throws only on programmer errors:
 *   - `secret` is `null`/`undefined`/empty array
 *   - `body` is not a `Uint8Array`
 */
export function verify(
  header: string | null | undefined,
  body: Uint8Array,
  secret: Uint8Array | string | Array<Uint8Array | string>,
  opts: VerifyOptions = {},
): VerifyResult {
  if (!(body instanceof Uint8Array)) {
    throw new TypeError('verify: body must be a Uint8Array');
  }
  if (secret == null) {
    throw new TypeError('verify: secret is required');
  }

  if (header == null || header.length === 0) {
    return { valid: false, reason: 'missing_header' };
  }

  const secrets = normalizeSecrets(secret);

  const parsed = parseHeader(header);
  if (!parsed) return { valid: false, reason: 'malformed_header' };

  // Weak-secret advisory fires only after header parse succeeds so attackers can't
  // probe verifier configuration by sending malformed headers and watching log lines.
  if (opts.onWarning) {
    for (const s of secrets) {
      if (s.length < MIN_SECRET_BYTES) {
        opts.onWarning('weak_secret');
        break;
      }
    }
  }

  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const toleranceSec = opts.toleranceSec ?? DEFAULT_TOLERANCE_SEC;

  // Reject timestamps that overflow safe-integer space. 10 digits covers through 2286;
  // anything longer can't be within tolerance of any sane `now`, so report `stale`.
  // Also guarantees Python-side parity: bigints would compute a real abs() diff there.
  if (parsed.tRaw.length > MAX_TIMESTAMP_DIGITS) {
    return { valid: false, reason: 'stale' };
  }
  const t = Number(parsed.tRaw);

  if (Math.abs(now - t) > toleranceSec) {
    return { valid: false, reason: 'stale' };
  }

  const signedPayload = concatSignedPayload(parsed.tRaw, body);
  let matched = false;

  for (const secretBytes of secrets) {
    const expected = hmacHex(secretBytes, signedPayload);
    const expectedBuf = Buffer.from(expected, 'hex');
    for (const [, candidate] of parsed.schemes) {
      if (candidate.length !== HEX_DIGEST_LEN) continue;
      const candidateBuf = Buffer.from(candidate, 'hex');
      if (candidateBuf.length !== expectedBuf.length) continue;
      // OR-assign (not bare-call) makes the non-short-circuit intent explicit and
      // resists future refactors that might reintroduce an early-exit.
      matched = timingSafeEqual(candidateBuf, expectedBuf) || matched;
    }
  }

  return matched
    ? { valid: true, reason: 'ok' }
    : { valid: false, reason: 'signature_mismatch' };
}
