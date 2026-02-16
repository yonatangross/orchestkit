---
title: "Streaming: Backpressure & Cancellation"
impact: MEDIUM
impactDescription: "Backpressure prevents memory exhaustion when consumers are slower than producers"
tags: [backpressure, buffer, cancellation, abort, asyncio-queue]
---

# Backpressure & Stream Cancellation

## Backpressure with Bounded Queue

```python
import asyncio

async def stream_with_backpressure(prompt: str, max_buffer: int = 100):
    """Handle slow consumers with backpressure."""
    buffer = asyncio.Queue(maxsize=max_buffer)

    async def producer():
        async for token in async_stream(prompt):
            await buffer.put(token)  # Blocks if buffer full
        await buffer.put(None)  # Signal completion

    async def consumer():
        while True:
            token = await buffer.get()
            if token is None:
                break
            yield token
            await asyncio.sleep(0)  # Yield control

    # Start producer in background
    asyncio.create_task(producer())

    # Return consumer generator
    async for token in consumer():
        yield token
```

## Stream Cancellation

```typescript
// Frontend: Cancel with AbortController
const controller = new AbortController();

async function streamChat(prompt: string, onToken: (t: string) => void) {
  const response = await fetch("/chat/stream?prompt=" + encodeURIComponent(prompt), {
    signal: controller.signal
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  try {
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      onToken(decoder.decode(value));
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Stream cancelled by user');
    }
  }
}

// Cancel the stream
controller.abort();
```

## Server-Side Cancellation

```python
from fastapi import Request

@app.get("/chat/stream")
async def stream_chat(prompt: str, request: Request):
    """SSE with server-side disconnect detection."""
    async def generate():
        async for token in async_stream(prompt):
            if await request.is_disconnected():
                break  # Client disconnected
            yield {"event": "token", "data": token}
        yield {"event": "done", "data": ""}

    return EventSourceResponse(generate())
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Buffer size | 50-200 tokens |
| Cancellation (frontend) | AbortController |
| Cancellation (server) | request.is_disconnected() |
| Completion signal | None sentinel in queue |

## Common Mistakes

- Unbounded buffers (memory exhaustion with slow consumers)
- Not checking for client disconnect on server side
- Missing AbortController cleanup on component unmount
- Not yielding control in consumer (starves event loop)

**Incorrect — unbounded queue causes memory exhaustion:**
```python
async def stream_tokens(prompt: str):
    buffer = asyncio.Queue()  # No maxsize = unbounded
    async for token in async_stream(prompt):
        await buffer.put(token)  # Never blocks, grows infinitely
    # Slow consumer = OOM
```

**Correct — bounded queue applies backpressure:**
```python
async def stream_tokens(prompt: str):
    buffer = asyncio.Queue(maxsize=100)  # Bounded buffer
    async for token in async_stream(prompt):
        await buffer.put(token)  # Blocks when full, slows producer
    # Producer matches consumer speed
```
