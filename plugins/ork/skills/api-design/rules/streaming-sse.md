---
title: Server-Sent Events (SSE) Streaming
impact: HIGH
impactDescription: "SSE provides simple, reliable server-to-client streaming with auto-reconnect for LLM responses and notifications"
tags: sse, streaming, server-sent-events, real-time, llm-streaming
---

## Server-Sent Events (SSE) Streaming

**Incorrect -- no keepalive or cleanup:**
```python
# No keepalive, no abort handling, no reconnection support
@app.get("/stream")
async def stream():
    async def generate():
        for item in data:
            yield f"data: {item}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
```

**Correct -- SSE with keepalive and abort handling (Next.js):**
```typescript
export async function GET(req: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode('data: Hello\n\n'))

      // Keep connection alive every 30s
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(': keepalive\n\n'))
      }, 30000)

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
```

**Correct -- LLM token streaming pattern:**
```typescript
export async function POST(req: Request) {
  const { messages } = await req.json()
  const stream = await openai.chat.completions.create({ model: 'gpt-5.2', messages, stream: true })
  const encoder = new TextEncoder()

  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content
          if (content) {
            controller.enqueue(encoder.encode("data: " + JSON.stringify({ content }) + "\n\n"))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    }),
    { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
  )
}
```

**Correct -- reconnecting client with exponential backoff:**
```typescript
class ReconnectingEventSource {
  private eventSource: EventSource | null = null
  private reconnectDelay = 1000
  private maxReconnectDelay = 30000

  constructor(private url: string, private onMessage: (data: string) => void) {
    this.connect()
  }

  private connect() {
    this.eventSource = new EventSource(this.url)
    this.eventSource.onmessage = (event) => {
      this.reconnectDelay = 1000
      this.onMessage(event.data)
    }
    this.eventSource.onerror = () => {
      this.eventSource?.close()
      setTimeout(() => this.connect(), this.reconnectDelay)
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
    }
  }
}
```

Key decisions:
- SSE for one-way server-to-client (LLM streaming, notifications)
- Keepalive every 30s to prevent timeouts
- Handle browser 6-connection-per-domain limit (use HTTP/2)
- Exponential backoff for reconnection (1s to 30s)
