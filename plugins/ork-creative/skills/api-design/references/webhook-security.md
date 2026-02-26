# Webhook Security

Patterns for verifying webhook authenticity and preventing replay attacks across messaging platforms.

## Core Principle

Never trust incoming webhooks without verification. All platforms provide a mechanism to prove the request originated from them.

## HMAC-SHA256 Verification (Generic)

```typescript
import crypto from 'crypto';

function verifyHmacSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
  prefix = ''
): boolean {
  const expected = prefix + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

## Platform-Specific Verification

### Slack

```typescript
function verifySlackWebhook(req: Request, signingSecret: string): boolean {
  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const signature = req.headers['x-slack-signature'] as string;

  // Replay protection: reject requests older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return false;
  }

  const baseString = `v0:${timestamp}:${req.rawBody}`;
  const expected = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(baseString)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### WhatsApp (Meta Business API)

```typescript
function verifyMetaWebhook(req: Request, appSecret: string): boolean {
  const signature = (req.headers['x-hub-signature-256'] as string)?.replace('sha256=', '');
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### Telegram

Telegram uses a simpler token-based approach:

```typescript
function verifyTelegramWebhook(req: Request, secretToken: string): boolean {
  return req.headers['x-telegram-bot-api-secret-token'] === secretToken;
}
```

## Replay Protection

Signatures alone don't prevent replay attacks. Add timestamp validation:

```typescript
function isReplayAttack(timestamp: number, maxAgeSeconds = 300): boolean {
  return Math.abs(Date.now() / 1000 - timestamp) > maxAgeSeconds;
}
```

**Apply before signature check** — reject stale requests early.

## Idempotency

Messaging platforms may send duplicate webhooks (network retries, platform bugs). Track processed message IDs:

```typescript
async function processWebhook(messageId: string, handler: () => Promise<void>): Promise<void> {
  // Atomic check-and-set using Redis
  const isNew = await redis.set(`webhook:${messageId}`, '1', 'EX', 86400, 'NX');
  if (!isNew) return; // Already processed
  await handler();
}
```

**Key rules:**
- Use `timingSafeEqual` for all signature comparisons (prevents timing attacks)
- Validate timestamps before checking signatures (cheap rejection of stale requests)
- Store processed message IDs with TTL (24h is typical) for deduplication
- Use raw request body for signature verification — parsed JSON may differ from original bytes
