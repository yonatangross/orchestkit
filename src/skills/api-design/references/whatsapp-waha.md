# WhatsApp via WAHA

WAHA (WhatsApp HTTP API) provides a self-hosted REST API for WhatsApp messaging without Meta's Business API.

## Setup

Run WAHA as a Docker container:

```bash
docker run -d \
  --name waha \
  -p 3000:3000 \
  -e WHATSAPP_HOOK_URL=https://app.com/webhook/whatsapp \
  -e WHATSAPP_HOOK_EVENTS=message,session.status \
  devlikeapro/waha:latest
```

For production, use Docker Compose with persistent storage:

```yaml
services:
  waha:
    image: devlikeapro/waha:latest
    ports:
      - "3000:3000"
    environment:
      WHATSAPP_HOOK_URL: https://app.com/webhook/whatsapp
      WHATSAPP_HOOK_EVENTS: message,message.ack,session.status
      WAHA_DASHBOARD_ENABLED: "true"
    volumes:
      - waha_data:/app/.sessions
    restart: unless-stopped

volumes:
  waha_data:
```

## Session Lifecycle

```bash
# Create and start session
POST /api/sessions/start
{ "name": "main", "config": { "proxy": null, "webhooks": [{ "url": "...", "events": ["message"] }] } }

# Get QR code for authentication
GET /api/sessions/main/qr   # Returns QR image
GET /api/sessions/main/auth  # Returns pairing code alternative

# Check session status
GET /api/sessions/main
# Response: { "name": "main", "status": "WORKING" | "SCAN_QR" | "STOPPED" }

# Stop session
POST /api/sessions/stop
{ "name": "main" }
```

**Status flow**: `STARTING` -> `SCAN_QR` -> `WORKING` -> `STOPPED`

## Message Types

### Text

```bash
POST /api/sendText
{ "session": "main", "chatId": "1234567890@c.us", "text": "Hello!" }
```

### Image / Document / Video

```bash
POST /api/sendFile
{
  "session": "main",
  "chatId": "1234567890@c.us",
  "file": {
    "mimetype": "image/jpeg",
    "url": "https://example.com/image.jpg",
    "filename": "photo.jpg"
  },
  "caption": "Check this out"
}
```

### Location

```bash
POST /api/sendLocation
{ "session": "main", "chatId": "1234567890@c.us", "latitude": 32.0853, "longitude": 34.7818 }
```

## Group Messaging

```bash
# chatId for groups uses @g.us suffix
POST /api/sendText
{ "session": "main", "chatId": "120363001234567890@g.us", "text": "Group message" }

# List groups
GET /api/groups?session=main
```

## Handling Incoming Messages

WAHA posts to your webhook URL:

```json
{
  "event": "message",
  "session": "main",
  "payload": {
    "id": "true_1234567890@c.us_AABBCCDD",
    "from": "1234567890@c.us",
    "to": "0987654321@c.us",
    "body": "User message text",
    "timestamp": 1707900000,
    "hasMedia": false
  }
}
```

**Key points:**
- `@c.us` suffix = individual chat, `@g.us` = group chat
- `id` is unique per message — use for deduplication
- Media messages have `hasMedia: true` and a separate download endpoint
- Session status changes also come via webhook (`session.status` event)
