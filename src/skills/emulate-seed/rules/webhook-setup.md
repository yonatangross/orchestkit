---
title: "Webhook Setup: HMAC Delivery and Verification"
impact: MEDIUM
impactDescription: "Skipping webhook signature verification in tests means production bugs in HMAC validation go undetected until deployment"
tags: [emulate, webhook, hmac, signature, verification, testing]
---

## Webhook Setup

Emulate delivers real webhooks with HMAC-SHA256 signatures when state changes occur (PR created, issue opened, deployment completed). Configure a webhook receiver in your tests to verify delivery and signatures.

### Webhook Receiver Pattern

```typescript
import http from 'http'
import crypto from 'crypto'

const WEBHOOK_SECRET = 'test-webhook-secret'
const receivedEvents: Array<{ event: string; payload: object }> = []

const webhookServer = http.createServer((req, res) => {
  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', () => {
    // Verify HMAC signature
    const signature = req.headers['x-hub-signature-256'] as string
    const expected = 'sha256=' + crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(body)
      .digest('hex')

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      res.writeHead(401)
      res.end('Invalid signature')
      return
    }

    receivedEvents.push({
      event: req.headers['x-github-event'] as string,
      payload: JSON.parse(body)
    })
    res.writeHead(200)
    res.end('OK')
  })
})

webhookServer.listen(9876)
```

**Incorrect — skipping signature verification in tests:**

```typescript
// BAD: no signature check — production HMAC bugs go undetected
webhookServer.on('request', (req, res) => {
  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', () => {
    receivedEvents.push(JSON.parse(body))  // Just trust it
    res.writeHead(200).end()
  })
})
```

**Correct — verify HMAC even in tests:**

```typescript
// GOOD: same verification logic as production
const signature = req.headers['x-hub-signature-256'] as string
const expected = 'sha256=' + crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(body)
  .digest('hex')

if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
  res.writeHead(401).end('Invalid signature')
  return
}
```

**Key rules:**
- Always verify HMAC-SHA256 signatures in test webhook receivers — mirrors production behavior
- Use `crypto.timingSafeEqual` for constant-time comparison to prevent timing attacks
- Store the webhook secret in the seed config and share it with the receiver
- Check the `x-github-event` header to route different event types
- Clean up the webhook server in `afterAll` to prevent port leaks
- Emulate delivers webhooks on state mutations (create, update, delete) — not on reads

Reference: `references/sdk-patterns.md`
