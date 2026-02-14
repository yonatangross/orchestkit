---
title: "Messaging Platform Integrations"
category: integration
impact: HIGH
impactDescription: Messaging integrations (WhatsApp, Telegram, Slack) handle user-facing communication where failures are immediately visible. Webhook security gaps expose your system to spoofed messages.
tags: [whatsapp, telegram, slack, messaging, webhook, bot, integration]
---

# Messaging Platform Integrations

## Platform Selection

| Platform | API Style | Best For | Limitations |
|----------|-----------|----------|-------------|
| WhatsApp (WAHA) | REST + Webhooks | Business messaging, notifications | Session management, rate limits |
| Telegram Bot API | REST + Webhooks/Polling | Interactive bots, commands | 30 msg/sec per bot |
| Slack | REST + Events API | Team workflows, notifications | Workspace-scoped |

## WhatsApp via WAHA

```typescript
// Send message via WAHA (WhatsApp HTTP API)
const response = await fetch(`${WAHA_URL}/api/sendText`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chatId: `${phone}@c.us`,
    text: message,
    session: "default",
  }),
});
```

## Telegram Bot API

```typescript
// Set webhook for Telegram bot
await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: `${BASE_URL}/api/telegram/webhook`,
    secret_token: WEBHOOK_SECRET,
  }),
});
```

## Webhook Security (Critical)

Every platform provides a signature verification mechanism. **Always verify.**

```typescript
// Telegram: verify secret_token header
function verifyTelegramWebhook(req: Request): boolean {
  return req.headers["x-telegram-bot-api-secret-token"] === WEBHOOK_SECRET;
}
```

- **WhatsApp WAHA**: API key header authentication
- **Telegram**: `secret_token` in webhook registration, verified via header
- **Slack**: HMAC-SHA256 signing secret verification

## Anti-Patterns

**Incorrect:**
- Processing webhooks without signature verification — anyone can POST fake messages
- Synchronous processing of incoming messages — webhook timeout causes retries
- No idempotency on webhook handlers — duplicate messages on retry

**Correct:**
- Always verify webhook signatures before processing
- Acknowledge webhook immediately (200 OK), process async via queue
- Store message IDs and deduplicate on retry
- Rate-limit outgoing messages per platform limits

## References

- `references/whatsapp-waha.md` — WAHA setup, session lifecycle, message types
- `references/telegram-bot-api.md` — Bot setup, webhook config, keyboard patterns
- `references/webhook-security.md` — Signature verification patterns per platform
