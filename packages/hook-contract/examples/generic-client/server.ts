/**
 * Generic hook-sink client — a minimal, framework-portable example of an HTTP
 * server that accepts OrchestKit hook payloads, verifies the HMAC signature,
 * and dispatches per event type. Proves the contract is consumable beyond the
 * yonatan-hq platform (#1808).
 *
 * `createApp(secret)` returns the configured Express app with no side effects,
 * so it can be exercised directly with supertest (see __tests__/server.test.ts).
 * The server only binds a port when this module is executed directly.
 *
 * The two load-bearing details every consumer must get right:
 *   1. HMAC is over the RAW request bytes — capture them BEFORE any JSON parse
 *      (express.raw), or the signature will never match.
 *   2. `verify()` never throws on bad input; branch on `reason` for observability.
 */

import { pathToFileURL } from 'node:url';
import express, { type Express } from 'express';
import { verify, HOOK_SIGNATURE_HEADER } from '@orchestkit/hook-contract/signing';
import { HOOK_EVENT_NAMES } from '@orchestkit/hook-contract/events';

const EVENTS = new Set<string>(HOOK_EVENT_NAMES);

/** Build the hook-sink Express app bound to `secret`. Pure — no listen, no env reads. */
export function createApp(secret: string): Express {
  const app = express();

  // Capture RAW bytes for the HMAC — must run before any body parser.
  app.post('/hooks/ingest', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
    const body: Uint8Array = req.body instanceof Buffer ? req.body : Buffer.from(req.body ?? '');

    const result = verify(req.header(HOOK_SIGNATURE_HEADER), body, secret);
    if (!result.valid) {
      // reason ∈ ok|missing_header|malformed_header|stale|signature_mismatch|weak_secret
      const code =
        result.reason === 'missing_header' || result.reason === 'malformed_header' ? 400 : 401;
      console.warn(`[hook-sink] rejected: ${result.reason}`);
      return res.status(code).json({ ok: false, reason: result.reason });
    }

    // Canonical envelope (per @orchestkit/hook-contract schemas): the discriminator
    // is `event` (top-level), with event-specific fields nested under `payload`.
    let payload: {
      event?: string;
      session_id?: string;
      payload?: Record<string, unknown>;
      [k: string]: unknown;
    };
    try {
      payload = JSON.parse(Buffer.from(body).toString('utf8'));
    } catch {
      return res.status(400).json({ ok: false, reason: 'invalid_json' });
    }

    const event = String(payload.event ?? '');
    if (!EVENTS.has(event)) {
      // Unknown/absent event name — accept but flag (forward-compat with newer CC).
      console.warn(`[hook-sink] unknown event: ${event || '(none)'}`);
    }

    // Dispatch. Replace these with real handlers; the contract guarantees the shape.
    switch (event) {
      case 'PreToolUse':
      case 'PostToolUse':
        console.log(
          `[hook-sink] ${event}: tool=${(payload.payload as { tool_name?: string } | undefined)?.tool_name ?? '?'}`,
        );
        break;
      case 'SessionStart':
      case 'SessionEnd':
        console.log(`[hook-sink] ${event}: session=${payload.session_id ?? '?'}`);
        break;
      default:
        console.log(`[hook-sink] ${event}`);
    }

    // 202 = accepted/queued. Ack fast; do real work off the request path.
    return res.status(202).json({ ok: true, event });
  });

  return app;
}

// Run as a server only when executed directly (`tsx server.ts`), never on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const PORT = Number(process.env.PORT) || 8787;
  const SECRET = process.env.HOOK_SECRET;
  if (!SECRET || SECRET.length < 32) {
    console.error('Set HOOK_SECRET to the shared signing secret (>= 32 bytes / 64 hex chars).');
    process.exit(1);
  }
  createApp(SECRET).listen(PORT, () =>
    console.log(`[hook-sink] listening on :${PORT}/hooks/ingest`),
  );
}
