# Server-Sent Events (SSE) Deep Dive

Comprehensive guide to Server-Sent Events including protocol details, reconnection strategies, event types, buffering, backpressure handling, and production patterns.

## SSE Protocol Fundamentals

### What is SSE?

Server-Sent Events (SSE) is a web standard for **server-to-client** unidirectional streaming over HTTP. Unlike WebSockets (bidirectional), SSE uses regular HTTP and provides automatic reconnection.

**Use cases**:
- Real-time progress updates (file uploads, analysis workflows)
- Live notifications (chat messages, alerts)
- Streaming LLM responses (ChatGPT-style interfaces)
- Live data feeds (stock prices, sports scores)

**Not suitable for**:
- Bidirectional communication (use WebSockets)
- Binary data (SSE is text-based)
- Low latency requirements (<50ms) (use WebSockets)

### HTTP Response Format

**Server response headers**:
```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no  # Disable nginx buffering
```

**Event format**:
```
event: message
data: {"content": "Hello"}
id: 123
retry: 3000

```

**Key fields**:
- `event`: Event type (default: "message")
- `data`: Payload (can span multiple lines)
- `id`: Event ID for reconnection
- `retry`: Reconnection delay in milliseconds
- **Terminator**: Two newlines (`\n\n`) end each event

### Multi-line Data

```
event: progress
data: {
data:   "stage": "extraction",
data:   "status": "complete"
data: }

```

**Parser concatenates**: `{"stage": "extraction", "status": "complete"}`

## Client Implementation

### Basic EventSource

```javascript
const eventSource = new EventSource('/api/v1/analyze/123/stream');

// Listen to default "message" events
eventSource.onmessage = (event) => {
  console.log('Received:', event.data);
};

// Listen to custom event types
eventSource.addEventListener('progress', (event) => {
  const data = JSON.parse(event.data);
  console.log(`Stage: ${data.stage}, Status: ${data.status}`);
});

eventSource.addEventListener('error', (event) => {
  const data = JSON.parse(event.data);
  console.error('Error:', data.message);
});

eventSource.addEventListener('complete', (event) => {
  console.log('Complete!');
  eventSource.close();  // Close connection when done
});

// Handle connection errors
eventSource.onerror = (error) => {
  console.error('EventSource failed:', error);
};
```

### React Hook Example

```typescript
import { useEffect, useState } from 'react';

interface ProgressEvent {
  type: 'progress' | 'error' | 'complete';
  stage: string;
  status: string;
  message?: string;
}

export function useAnalysisProgress(analysisId: string) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/v1/analyze/${analysisId}/stream`
    );

    eventSource.addEventListener('progress', (e) => {
      const event = JSON.parse(e.data) as ProgressEvent;
      setEvents((prev) => [...prev, event]);
    });

    eventSource.addEventListener('complete', (e) => {
      const event = JSON.parse(e.data) as ProgressEvent;
      setEvents((prev) => [...prev, event]);
      setIsComplete(true);
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      const event = JSON.parse(e.data) as ProgressEvent;
      setEvents((prev) => [...prev, event]);
    });

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [analysisId]);

  return { events, isComplete };
}
```

## Server Implementation (FastAPI)

### Basic SSE Endpoint

```python
from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse
from collections.abc import AsyncIterator
import asyncio
import json

router = APIRouter()

async def event_generator() -> AsyncIterator[dict[str, str]]:
    """Generate SSE events."""
    for i in range(10):
        await asyncio.sleep(1)

        yield {
            "event": "progress",
            "data": json.dumps({
                "type": "progress",
                "count": i,
                "timestamp": datetime.now(UTC).isoformat()
            })
        }

    # Final event
    yield {
        "event": "complete",
        "data": json.dumps({"type": "complete"})
    }

@router.get("/stream")
async def stream_events():
    return EventSourceResponse(event_generator())
```

### SSE with Pub/Sub (Production Pattern)

**Use case**: Multiple workflow tasks publish events → Single SSE endpoint subscribes and streams to client

```python
from app.shared.services.messaging.broadcaster import broadcaster

@router.get("/analyze/{analysis_id}/stream")
async def stream_analysis_progress(
    analysis_id: uuid.UUID,
    request: Request
) -> EventSourceResponse:
    """Stream analysis progress via SSE."""
    channel = f"workflow:{analysis_id}"

    logger.info(
        "sse_connection_started",
        analysis_id=str(analysis_id),
        channel=channel
    )

    async def event_generator() -> AsyncIterator[dict[str, str]]:
        try:
            # Subscribe to broadcaster channel
            async with aclosing(broadcaster.subscribe(channel)) as subscription:
                async for event in subscription:
                    # Format event for SSE
                    event_type = str(event.get("type", "message"))
                    yield {
                        "event": event_type,
                        "data": json.dumps(event)
                    }

                    # Close connection on complete event
                    if event.get("type") == "complete":
                        logger.info(
                            "sse_complete_event_sent",
                            analysis_id=str(analysis_id)
                        )
                        break

        except asyncio.CancelledError:
            # Client disconnected
            logger.info(
                "sse_connection_cancelled",
                analysis_id=str(analysis_id)
            )
            raise
        except Exception as e:
            logger.error(
                "sse_unexpected_error",
                analysis_id=str(analysis_id),
                error=str(e),
                exc_info=True
            )
            # Send error event to client
            yield {
                "event": "error",
                "data": json.dumps({
                    "type": "error",
                    "error_type": type(e).__name__,
                    "message": str(e),
                    "timestamp": datetime.now(UTC).isoformat()
                })
            }

    return EventSourceResponse(
        event_generator(),
        send_timeout=30.0  # Timeout for unresponsive clients
    )
```

## Event Buffering (Race Condition Solution)

### Problem: SSE Race Condition

**Scenario**: Workflow starts emitting events BEFORE client connects to SSE endpoint

```
POST /analyze         → Analysis created, workflow started
  ↓
  Workflow emits events: extraction_started, extraction_complete
  ↓
GET /stream          → Client connects (LATE!)
  ↓
  Client receives: chunking_started, chunking_complete
  ✗ Client never sees: extraction events (LOST!)
```

**Result**: Frontend shows "Waiting for agent activity..." while backend runs

### Solution: Event Buffering

**Pattern**: Buffer recent events per channel, replay to new subscribers

```python
from collections import deque
from datetime import datetime, timedelta, UTC

MAX_BUFFER_SIZE = 100  # Max events to buffer per channel
BUFFER_TTL_SECONDS = 300  # 5 minutes - events older than this are dropped

class EventBroadcaster:
    def __init__(self) -> None:
        self._channels: dict[str, list[asyncio.Queue]] = defaultdict(list)
        self._buffers: dict[str, deque[tuple[datetime, dict]]] = defaultdict(
            lambda: deque(maxlen=MAX_BUFFER_SIZE)
        )
        self._lock = asyncio.Lock()

    async def publish(self, channel: str, message: dict) -> None:
        """Publish message to channel AND buffer it."""
        now = datetime.now(UTC)

        async with self._lock:
            # Always buffer the event (even if no subscribers)
            self._buffers[channel].append((now, message))

            # Clean up old events (older than TTL)
            cutoff = now - timedelta(seconds=BUFFER_TTL_SECONDS)
            while self._buffers[channel] and self._buffers[channel][0][0] < cutoff:
                self._buffers[channel].popleft()

            # Broadcast to active subscribers
            queues = self._channels.get(channel, [])
            for queue in queues:
                await queue.put(message)

    async def subscribe(self, channel: str) -> AsyncIterator[dict]:
        """Subscribe to channel, replaying buffered events first."""
        queue = asyncio.Queue()
        buffered_events = []

        async with self._lock:
            # Add subscriber
            self._channels[channel].append(queue)

            # Capture buffered events for replay
            if channel in self._buffers:
                buffered_events = [event for _, event in self._buffers[channel]]

        logger.debug(
            "subscribe_created",
            channel=channel,
            buffered_events_count=len(buffered_events)
        )

        try:
            # 1. Replay buffered events (catch up)
            for event in buffered_events:
                yield event

            # 2. Stream live events
            while True:
                message = await queue.get()
                yield message

        finally:
            # Cleanup on disconnect
            async with self._lock:
                if channel in self._channels:
                    self._channels[channel].remove(queue)
                    if not self._channels[channel]:
                        del self._channels[channel]
```

**Benefits**:
- Clients receive ALL events, even if they connect late
- No race condition
- Bounded memory (maxlen=100)
- Auto-cleanup (5 minute TTL)

## Reconnection Strategies

### Automatic Reconnection (Built-in)

EventSource automatically reconnects on connection failure:

```javascript
const eventSource = new EventSource('/api/v1/stream');

// Browser automatically:
// 1. Detects connection loss
// 2. Waits 'retry' milliseconds (default: 3000ms)
// 3. Reconnects with Last-Event-ID header
```

**Server can control retry delay**:
```python
yield {
    "event": "message",
    "data": json.dumps({"status": "ok"}),
    "retry": 5000  # Client will wait 5 seconds before reconnecting
}
```

### Custom Reconnection (Exponential Backoff)

For more control, implement custom reconnection:

```typescript
class ReconnectingEventSource {
  private eventSource: EventSource | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private reconnectAttempts = 0;

  constructor(
    private url: string,
    private onMessage: (data: string) => void,
    private onError?: (error: Event) => void
  ) {
    this.connect();
  }

  private connect() {
    this.eventSource = new EventSource(this.url);

    this.eventSource.onmessage = (event) => {
      this.reconnectDelay = 1000; // Reset on success
      this.reconnectAttempts = 0;
      this.onMessage(event.data);
    };

    this.eventSource.onerror = (error) => {
      console.warn(
        `SSE error (attempt ${this.reconnectAttempts}):`,
        error
      );

      this.eventSource?.close();
      this.reconnectAttempts++;

      // Exponential backoff with max delay
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay
      );

      this.onError?.(error);
    };
  }

  close() {
    this.eventSource?.close();
    this.eventSource = null;
  }
}

// Usage
const sse = new ReconnectingEventSource(
  '/api/v1/stream',
  (data) => console.log('Message:', data),
  (error) => console.error('Error:', error)
);
```

### Last-Event-ID for Resume

**Server sends event IDs**:
```python
event_id = 0

async def event_generator():
    global event_id
    for item in data:
        event_id += 1
        yield {
            "id": str(event_id),
            "event": "progress",
            "data": json.dumps(item)
        }
```

**Client reconnects with Last-Event-ID**:
```javascript
// Browser automatically includes header on reconnect:
// Last-Event-ID: 42
```

**Server resumes from last ID**:
```python
@router.get("/stream")
async def stream_events(request: Request):
    last_event_id = request.headers.get("Last-Event-ID")
    start_id = int(last_event_id) if last_event_id else 0

    async def event_generator():
        for event_id in range(start_id + 1, 100):
            yield {
                "id": str(event_id),
                "data": json.dumps({"count": event_id})
            }

    return EventSourceResponse(event_generator())
```

## Keep-Alive / Heartbeat

### Problem: Proxy/Load Balancer Timeout

**Scenario**: No events for 60 seconds → Nginx/ALB closes connection

### Solution: Send Keep-Alive Comments

```python
async def event_generator():
    last_event_time = time.time()

    while True:
        # Send heartbeat every 30 seconds
        if time.time() - last_event_time > 30:
            yield {
                "comment": "keepalive"  # Special field: ignored by client
            }
            last_event_time = time.time()

        # Or send actual event
        if has_event():
            yield {
                "event": "progress",
                "data": json.dumps(get_event())
            }
            last_event_time = time.time()

        await asyncio.sleep(1)
```

**SSE comment format**:
```
: keepalive

```

Lines starting with `:` are comments (ignored by EventSource parser).

## Backpressure Handling

### Problem: Slow Consumer

**Scenario**: Server produces events faster than client can consume

### Solution: Monitor Queue Size

```python
MAX_QUEUE_SIZE = 100

async def event_generator(channel: str):
    queue = asyncio.Queue(maxsize=MAX_QUEUE_SIZE)

    async def producer():
        try:
            async for event in data_source():
                try:
                    # Non-blocking put with timeout
                    await asyncio.wait_for(
                        queue.put(event),
                        timeout=5.0
                    )
                except asyncio.TimeoutError:
                    logger.warning(
                        "backpressure_detected",
                        queue_size=queue.qsize()
                    )
                    # Drop event or pause producer
        finally:
            await queue.put(None)  # Sentinel

    # Start producer in background
    asyncio.create_task(producer())

    # Consume from queue
    while True:
        event = await queue.get()
        if event is None:  # Sentinel
            break
        yield event
```

## Error Handling

### Send Structured Error Events

```python
try:
    async for event in subscription:
        yield {"event": "progress", "data": json.dumps(event)}
except ConnectionError as e:
    yield {
        "event": "error",
        "data": json.dumps({
            "type": "error",
            "error_type": "ConnectionError",
            "message": str(e),
            "timestamp": datetime.now(UTC).isoformat()
        })
    }
```

**Client handling**:
```javascript
eventSource.addEventListener('error', (e) => {
  const error = JSON.parse(e.data);
  console.error(`Error (${error.error_type}):`, error.message);

  // Maybe close connection on specific errors
  if (error.error_type === 'FatalError') {
    eventSource.close();
  }
});
```

## Browser Limits

### Connection Limit: 6 per Domain

**Problem**: Browser limits SSE connections to 6 per domain (HTTP/1.1)

**Solutions**:
1. **Use HTTP/2**: No connection limit (multiplexing)
2. **Close old connections**: When opening new SSE, close previous
3. **Use single connection**: Multiplex multiple streams over one SSE

```javascript
// Close old connection before opening new one
if (window.currentSSE) {
  window.currentSSE.close();
}
window.currentSSE = new EventSource('/stream');
```

## Production Checklist

### Server Configuration

```python
return EventSourceResponse(
    event_generator(),
    headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",  # Disable nginx buffering
    },
    send_timeout=30.0,  # Timeout for unresponsive clients
    ping=15.0,  # Send ping every 15 seconds
)
```

### Nginx Configuration

```nginx
location /api/v1/stream {
    proxy_pass http://backend;
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    chunked_transfer_encoding on;
    proxy_read_timeout 3600s;  # Long timeout for SSE
}
```

### Load Balancer (AWS ALB)

```yaml
# Target group settings
idle_timeout: 3600  # 1 hour (default: 60s)
deregistration_delay: 30
```

## Testing SSE Endpoints

### cURL Test

```bash
curl -N -H "Accept: text/event-stream" \
  http://localhost:8500/api/v1/analyze/123/stream
```

**Output**:
```
event: progress
data: {"type":"progress","stage":"extraction","status":"running"}

event: progress
data: {"type":"progress","stage":"extraction","status":"complete"}

event: complete
data: {"type":"complete"}
```

### Python Test

```python
import httpx

async def test_sse():
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "GET",
            "http://localhost:8500/api/v1/analyze/123/stream",
            headers={"Accept": "text/event-stream"}
        ) as response:
            async for line in response.aiter_lines():
                print(line)
```

## Related Files

- See `examples/orchestkit-sse-implementation.md` for OrchestKit-specific patterns
- See `scripts/sse-endpoint-template.ts` for TypeScript client template
- See SKILL.md for WebSocket comparison and LLM streaming patterns
