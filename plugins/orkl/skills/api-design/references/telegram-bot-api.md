# Telegram Bot API

Reference for building Telegram bots with webhooks, commands, and interactive keyboards.

## Bot Creation

1. Open Telegram, search for `@BotFather`
2. Send `/newbot`, follow prompts
3. Save the bot token (`123456:ABC-DEF...`)

## Webhook Setup

```bash
# Set webhook
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://app.com/telegram/webhook",
    "secret_token": "your-webhook-secret",
    "allowed_updates": ["message", "callback_query"]
  }'

# Verify webhook is set
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Remove webhook (switch to polling)
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
```

### Webhook Verification

Telegram sends `X-Telegram-Bot-Api-Secret-Token` header matching your `secret_token`:

```typescript
function verifyTelegramWebhook(req: Request, secret: string): boolean {
  return req.headers['x-telegram-bot-api-secret-token'] === secret;
}
```

## Bot Commands

Register commands with BotFather so they appear in the menu:

```bash
POST /bot<TOKEN>/setMyCommands
{
  "commands": [
    { "command": "start", "description": "Start the bot" },
    { "command": "help", "description": "Show help" },
    { "command": "settings", "description": "Bot settings" }
  ]
}
```

Handle commands in your webhook:

```typescript
if (update.message?.text?.startsWith('/start')) {
  await sendMessage(chatId, 'Welcome! Use /help to see available commands.');
}
```

## Sending Messages

### Text with Formatting

```bash
POST /bot<TOKEN>/sendMessage
{
  "chat_id": 123456,
  "text": "*Bold* _italic_ `code` [link](https://example.com)",
  "parse_mode": "MarkdownV2"
}
```

### Inline Keyboards

```bash
POST /bot<TOKEN>/sendMessage
{
  "chat_id": 123456,
  "text": "Choose an action:",
  "reply_markup": {
    "inline_keyboard": [
      [
        { "text": "Approve", "callback_data": "approve_123" },
        { "text": "Reject", "callback_data": "reject_123" }
      ],
      [{ "text": "Visit site", "url": "https://example.com" }]
    ]
  }
}
```

### Handle Callback Queries

```typescript
if (update.callback_query) {
  const { id, data, message } = update.callback_query;

  // Answer the callback (removes loading spinner)
  await fetch(`${API}/answerCallbackQuery`, {
    method: 'POST',
    body: JSON.stringify({ callback_query_id: id })
  });

  // Process the action
  if (data.startsWith('approve_')) {
    await editMessage(message.chat.id, message.message_id, 'Approved!');
  }
}
```

## Media Messages

```bash
# Send photo
POST /bot<TOKEN>/sendPhoto
{ "chat_id": 123456, "photo": "https://example.com/image.jpg", "caption": "Check this" }

# Send document
POST /bot<TOKEN>/sendDocument
{ "chat_id": 123456, "document": "https://example.com/file.pdf" }
```

## Rate Limits

- **Private chats**: 1 message per second per chat
- **Groups**: 20 messages per minute per group
- **Global**: 30 messages per second across all chats
- **Bulk notifications**: Use `sendMessage` in a loop with 1/30s delay between calls
