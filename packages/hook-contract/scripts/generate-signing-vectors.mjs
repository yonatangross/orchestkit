#!/usr/bin/env node
/**
 * Regenerate golden HMAC signing test vectors at test-vectors/signing/*.json.
 *
 * Vectors are consumed by both the npm package (this repo) and the PyPI sibling
 * (orchestkit_hook_contract) via the M141-6 cross-language parity gate.
 *
 * Run: node scripts/generate-signing-vectors.mjs
 *
 * Deterministic: all vectors use fixed secrets and timestamps so re-running
 * produces byte-identical files.
 */
import { createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'test-vectors', 'signing');

const SECRET_A_HEX = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const SECRET_B_HEX = 'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';
const T = 1731000000;
const TOLERANCE = 300;

function hmac(secretHex, payload) {
  return createHmac('sha256', Buffer.from(secretHex, 'hex')).update(payload).digest('hex');
}

function signed(t, body) {
  return Buffer.concat([Buffer.from(`${t}.`, 'ascii'), body]);
}

function b64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function writeVector(name, data) {
  const path = join(OUT_DIR, `${name}.json`);
  const pretty = JSON.stringify(data, null, 2) + '\n';
  writeFileSync(path, pretty);
  console.log(`✓ ${name}.json`);
}

mkdirSync(OUT_DIR, { recursive: true });

// ─── Positive vectors ──────────────────────────────────────────────────────

{
  const body = Buffer.from('{"event":"PreToolUse","tool":"Bash"}', 'utf8');
  const sig = hmac(SECRET_A_HEX, signed(T, body));
  writeVector('happy-path-v1', {
    name: 'happy-path-v1',
    description: 'Single scheme, fresh timestamp, valid digest.',
    secret_hex: SECRET_A_HEX,
    body_b64: b64(body),
    timestamp: T,
    now: T + 10,
    tolerance_sec: TOLERANCE,
    header: `t=${T},v1=${sig}`,
    expected: { valid: true, reason: 'ok' },
  });
}

{
  const body = Buffer.from('{"event":"PostToolUse"}', 'utf8');
  const sigA = hmac(SECRET_A_HEX, signed(T, body));
  const sigB = hmac(SECRET_B_HEX, signed(T, body));
  writeVector('multi-scheme-rotation', {
    name: 'multi-scheme-rotation',
    description:
      'Header contains v1 (old secret) and v2 (new secret); verifier holds only the v2 secret.',
    secret_hex: SECRET_B_HEX,
    body_b64: b64(body),
    timestamp: T,
    now: T + 5,
    tolerance_sec: TOLERANCE,
    header: `t=${T},v1=${sigA},v2=${sigB}`,
    expected: { valid: true, reason: 'ok' },
  });
}

{
  const body = Buffer.from('{"event":"SessionStart"}', 'utf8');
  const sig = hmac(SECRET_A_HEX, signed(T, body));
  writeVector('uppercase-digest', {
    name: 'uppercase-digest',
    description: 'Verifier accepts uppercase hex digest (normalized to lowercase before compare).',
    secret_hex: SECRET_A_HEX,
    body_b64: b64(body),
    timestamp: T,
    now: T,
    tolerance_sec: TOLERANCE,
    header: `t=${T},v1=${sig.toUpperCase()}`,
    expected: { valid: true, reason: 'ok' },
  });
}

{
  const body = Buffer.from('plain text payload, not JSON', 'utf8');
  const sig = hmac(SECRET_A_HEX, signed(T, body));
  writeVector('non-json-body', {
    name: 'non-json-body',
    description: 'Body is text/plain bytes; raw-bytes discipline allows arbitrary content types.',
    secret_hex: SECRET_A_HEX,
    body_b64: b64(body),
    timestamp: T,
    now: T,
    tolerance_sec: TOLERANCE,
    header: `t=${T},v1=${sig}`,
    expected: { valid: true, reason: 'ok' },
  });
}

{
  const body = Buffer.from('{"event":"Stop"}\n', 'utf8');
  const sig = hmac(SECRET_A_HEX, signed(T, body));
  writeVector('body-with-trailing-newline', {
    name: 'body-with-trailing-newline',
    description: 'Body ends with a newline byte (0x0A); the signature MUST cover it.',
    secret_hex: SECRET_A_HEX,
    body_b64: b64(body),
    timestamp: T,
    now: T,
    tolerance_sec: TOLERANCE,
    header: `t=${T},v1=${sig}`,
    expected: { valid: true, reason: 'ok' },
  });
}

// ─── Negative vectors ──────────────────────────────────────────────────────

{
  // Compute signature over the FULL body, then verify with body truncated by 1 byte.
  const fullBody = Buffer.from('{"event":"PreToolUse","tool":"Bash"}', 'utf8');
  const sig = hmac(SECRET_A_HEX, signed(T, fullBody));
  const truncated = fullBody.subarray(0, fullBody.length - 1);
  writeVector('truncated-body', {
    name: 'truncated-body',
    description: 'Signature computed over full body; body delivered with last byte removed.',
    secret_hex: SECRET_A_HEX,
    body_b64: b64(truncated),
    timestamp: T,
    now: T,
    tolerance_sec: TOLERANCE,
    header: `t=${T},v1=${sig}`,
    expected: { valid: false, reason: 'signature_mismatch' },
  });
}

{
  const body = Buffer.from('{"event":"PreToolUse"}', 'utf8');
  const sig = hmac(SECRET_B_HEX, signed(T, body)); // signed with B, verifier holds A
  writeVector('wrong-secret', {
    name: 'wrong-secret',
    description: 'Header signed with a different secret than the verifier holds.',
    secret_hex: SECRET_A_HEX,
    body_b64: b64(body),
    timestamp: T,
    now: T,
    tolerance_sec: TOLERANCE,
    header: `t=${T},v1=${sig}`,
    expected: { valid: false, reason: 'signature_mismatch' },
  });
}

{
  const body = Buffer.from('{"event":"PreToolUse"}', 'utf8');
  const sig = hmac(SECRET_A_HEX, signed(T, body));
  writeVector('stale-timestamp', {
    name: 'stale-timestamp',
    description: 'Timestamp older than now by (tolerance + 1) seconds.',
    secret_hex: SECRET_A_HEX,
    body_b64: b64(body),
    timestamp: T,
    now: T + TOLERANCE + 1,
    tolerance_sec: TOLERANCE,
    header: `t=${T},v1=${sig}`,
    expected: { valid: false, reason: 'stale' },
  });
}

{
  const body = Buffer.from('{"event":"PreToolUse"}', 'utf8');
  const sig = hmac(SECRET_A_HEX, signed(T, body));
  writeVector('future-timestamp', {
    name: 'future-timestamp',
    description: 'Timestamp ahead of now by (tolerance + 1) seconds.',
    secret_hex: SECRET_A_HEX,
    body_b64: b64(body),
    timestamp: T,
    now: T - TOLERANCE - 1,
    tolerance_sec: TOLERANCE,
    header: `t=${T},v1=${sig}`,
    expected: { valid: false, reason: 'stale' },
  });
}

{
  const body = Buffer.from('{"event":"PreToolUse"}', 'utf8');
  writeVector('missing-v-scheme', {
    name: 'missing-v-scheme',
    description: 'Header contains only the t= pair; no signature scheme.',
    secret_hex: SECRET_A_HEX,
    body_b64: b64(body),
    timestamp: T,
    now: T,
    tolerance_sec: TOLERANCE,
    header: `t=${T}`,
    expected: { valid: false, reason: 'malformed_header' },
  });
}

{
  const body = Buffer.from('{"event":"PreToolUse"}', 'utf8');
  const sig = hmac(SECRET_A_HEX, signed(T, body));
  writeVector('malformed-header-no-t', {
    name: 'malformed-header-no-t',
    description: 'Header contains a scheme pair but no t= timestamp.',
    secret_hex: SECRET_A_HEX,
    body_b64: b64(body),
    timestamp: T,
    now: T,
    tolerance_sec: TOLERANCE,
    header: `v1=${sig}`,
    expected: { valid: false, reason: 'malformed_header' },
  });
}

{
  const body = Buffer.from('{"event":"PreToolUse"}', 'utf8');
  writeVector('missing-header', {
    name: 'missing-header',
    description: 'No header value at all (null/empty string).',
    secret_hex: SECRET_A_HEX,
    body_b64: b64(body),
    timestamp: T,
    now: T,
    tolerance_sec: TOLERANCE,
    header: '',
    expected: { valid: false, reason: 'missing_header' },
  });
}

{
  const body = Buffer.from('{"event":"PreToolUse"}', 'utf8');
  writeVector('non-hex-digest', {
    name: 'non-hex-digest',
    description: 'Scheme value contains characters outside [0-9a-f].',
    secret_hex: SECRET_A_HEX,
    body_b64: b64(body),
    timestamp: T,
    now: T,
    tolerance_sec: TOLERANCE,
    header: `t=${T},v1=${'z'.repeat(64)}`,
    expected: { valid: false, reason: 'malformed_header' },
  });
}

console.log(`\nGenerated vectors in ${OUT_DIR}`);
