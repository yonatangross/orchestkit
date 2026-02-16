---
title: "Streaming: SSE Endpoints"
impact: HIGH
impactDescription: "SSE streaming reduces time-to-first-byte and improves perceived responsiveness"
tags: [sse, server-sent-events, fastapi, streaming, frontend, async]
---

# SSE Streaming Endpoints

## Basic Streaming (OpenAI)

```python
from openai import AsyncOpenAI

client = AsyncOpenAI()

async def async_stream(prompt: str):
    """Async streaming for better concurrency."""
    stream = await client.chat.completions.create(
        model="gpt-5.2",
        messages=[{"role": "user", "content": prompt}],
        stream=True
    )

    async for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
```

## FastAPI SSE Endpoint

```python
from fastapi import FastAPI
from sse_starlette.sse import EventSourceResponse

app = FastAPI()

@app.get("/chat/stream")
async def stream_chat(prompt: str):
    """Server-Sent Events endpoint for streaming."""
    async def generate():
        async for token in async_stream(prompt):
            yield {
                "event": "token",
                "data": token
            }
        yield {"event": "done", "data": ""}

    return EventSourceResponse(generate())
```

## Frontend SSE Consumer

```typescript
async function streamChat(prompt: string, onToken: (t: string) => void) {
  const response = await fetch("/chat/stream?prompt=" + encodeURIComponent(prompt));
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data !== '[DONE]') {
          onToken(data);
        }
      }
    }
  }
}

// Usage
let fullResponse = '';
await streamChat('Hello', (token) => {
  fullResponse += token;
  setDisplayText(fullResponse);  // Update UI incrementally
});
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Protocol | SSE for web, WebSocket for bidirectional |
| Timeout | 30-60s for long responses |
| Retry | Reconnect on disconnect |
| Framework | sse-starlette for FastAPI |

## Common Mistakes

- No timeout (hangs on network issues)
- Missing error handling in stream
- Not closing connections properly
- Buffering entire response (defeats purpose of streaming)

**Incorrect — buffering entire response before sending:**
```python
@app.get("/chat/stream")
async def stream_chat(prompt: str):
    full_response = ""
    async for token in async_stream(prompt):
        full_response += token  # Accumulate everything
    return {"response": full_response}  # Send all at once
```

**Correct — streaming tokens incrementally:**
```python
@app.get("/chat/stream")
async def stream_chat(prompt: str):
    async def generate():
        async for token in async_stream(prompt):
            yield {"event": "token", "data": token}  # Send immediately
    return EventSourceResponse(generate())
```
