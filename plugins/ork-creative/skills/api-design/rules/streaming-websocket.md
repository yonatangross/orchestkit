---
title: Implement WebSocket bidirectional streaming with async generator cleanup for resource safety
impact: HIGH
impactDescription: "WebSockets enable bidirectional real-time communication; async generator cleanup prevents resource leaks"
tags: websocket, bidirectional, real-time, async-generator, aclosing, backpressure
---

## WebSocket and Async Generator Patterns

**Incorrect -- no message validation or heartbeat:**
```python
# No heartbeat, no validation, no reconnection
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    wss.clients.forEach((client) => client.send(data))  // Raw broadcast!
  })
})
```

**Correct -- WebSocket with heartbeat and validation:**
```typescript
const wss = new WebSocketServer({ port: 8080 })

wss.on('connection', (ws) => {
  // Heartbeat
  const heartbeat = setInterval(() => ws.ping(), 30000)

  ws.on('message', (data) => {
    const parsed = JSON.parse(data.toString())
    // Validate message structure
    if (!parsed.type || !parsed.text) return

    // Broadcast to connected clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(parsed))
      }
    })
  })

  ws.on('close', () => clearInterval(heartbeat))
})
```

**Incorrect -- async generator without cleanup:**
```python
# Generator not closed if exception occurs mid-iteration
async for chunk in external_api_stream():  # Resource leak if exception!
    yield process(chunk)
```

**Correct -- aclosing() for guaranteed async generator cleanup:**
```python
from contextlib import aclosing

# Guaranteed cleanup with aclosing()
async def stream_llm_response(prompt: str):
    async with aclosing(llm.astream(prompt)) as stream:
        async for chunk in stream:
            yield chunk.content

# Consumption with proper cleanup
async def consume():
    async with aclosing(stream_llm_response("Hello")) as response:
        async for token in response:
            handle(token)
```

**When to use aclosing():**

| Scenario | Use aclosing() |
|----------|----------------|
| External API streaming (LLM, HTTP) | Always |
| Database streaming results | Always |
| File streaming | Always |
| Simple in-memory generators | Optional |
| Generator with try/finally cleanup | Always |

Key decisions:
- WebSocket for bidirectional real-time (chat, collaboration)
- SSE for one-way server-to-client (use SSE rule instead)
- Always implement heartbeat/ping-pong for WebSockets
- Always use `aclosing()` for external resource async generators
- Implement backpressure with ReadableStream flow control
- Monitor buffer sizes, pause production when consumer is slow
