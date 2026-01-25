# OrchestKit SSE Implementation

Real-world Server-Sent Events implementation from OrchestKit, documenting the EventBroadcaster service, SSE endpoint handler, event buffering, and workflow integration.

## Project Context

**OrchestKit**: Multi-agent analysis workflow with real-time progress streaming

**Tech Stack**:
- Backend: FastAPI + sse-starlette 3.0.3
- Frontend: React 19 with native EventSource API
- Event Bus: Custom EventBroadcaster (in-memory pub/sub)

**SSE Endpoint**: `GET /api/v1/analyze/{analysis_id}/stream`

## Architecture Overview

```
┌─────────────────┐
│ Workflow Tasks  │ (extraction, analysis, chunking, etc.)
└────────┬────────┘
         │ publish events
         ↓
┌─────────────────────────────────┐
│ EventBroadcaster (Pub/Sub)      │
│ - In-memory queues              │
│ - Event buffering (deque)       │
│ - Channel-based routing         │
└────────┬────────────────────────┘
         │ subscribe
         ↓
┌─────────────────┐
│ SSE Handler     │ (sse_handler.py)
└────────┬────────┘
         │ stream over HTTP
         ↓
┌─────────────────┐
│ Frontend Client │ (EventSource)
└─────────────────┘
```

## EventBroadcaster Service

**Location**: `backend/app/shared/services/messaging/broadcaster.py`

### Core Implementation

```python
"""Event broadcaster service for pub/sub messaging.

Provides in-memory pub/sub functionality for SSE events using asyncio.Queue.
Channels are keyed by string identifiers (e.g., "workflow:{analysis_id}").

Issue #SSE-RACE: Added event buffering to solve the race condition where
events are published before subscribers connect. Recent events are buffered
per channel and replayed to new subscribers.
"""

import asyncio
from collections import defaultdict, deque
from collections.abc import AsyncIterator
from contextlib import suppress
from datetime import UTC, datetime, timedelta

from app.core.logging import get_logger

logger = get_logger(__name__)

# Buffer configuration
MAX_BUFFER_SIZE = 100  # Max events to buffer per channel
BUFFER_TTL_SECONDS = 300  # 5 minutes - events older than this are dropped


class EventBroadcaster:
    """In-memory pub/sub broadcaster for SSE events with event buffering.

    Issue #SSE-RACE: Implements event buffering to solve race condition where
    workflow starts emitting events before frontend SSE connection is established.
    Recent events are buffered per channel and replayed to new subscribers.
    """

    def __init__(self) -> None:
        """Initialize event broadcaster with empty channels and buffers."""
        self._channels: dict[str, list[asyncio.Queue]] = defaultdict(list)
        self._buffers: dict[str, deque[tuple[datetime, dict]]] = defaultdict(
            lambda: deque(maxlen=MAX_BUFFER_SIZE)
        )
        self._lock = asyncio.Lock()

    async def publish(self, channel: str, message: dict) -> None:
        """Publish message to all subscribers of a channel.

        Issue #SSE-RACE: Events are now buffered for late-joining subscribers.
        Even if no subscribers exist, events are stored in the buffer.
        """
        now = datetime.now(UTC)

        async with self._lock:
            queues = self._channels.get(channel, [])

            # Always buffer the event (even if no subscribers)
            # This solves the race condition where workflow starts before SSE connects
            self._buffers[channel].append((now, message))

            # Clean up old events from buffer (older than TTL)
            cutoff = now - timedelta(seconds=BUFFER_TTL_SECONDS)
            while self._buffers[channel] and self._buffers[channel][0][0] < cutoff:
                self._buffers[channel].popleft()

        if not queues:
            logger.debug(
                "publish_buffered_no_subscribers",
                channel=channel,
                buffer_size=len(self._buffers[channel])
            )
            return

        # Broadcast to all subscribers
        for queue in queues:
            try:
                await queue.put(message)
            except (asyncio.CancelledError, RuntimeError) as e:
                logger.warning(
                    "publish_failed",
                    channel=channel,
                    error=str(e),
                    exc_info=True
                )

        logger.debug(
            "publish_success",
            channel=channel,
            subscribers=len(queues),
            buffer_size=len(self._buffers[channel])
        )

    async def subscribe(self, channel: str) -> AsyncIterator[dict]:
        """Subscribe to a channel and yield messages.

        Issue #SSE-RACE: New subscribers first receive all buffered events
        (events published before the subscriber connected), then receive
        live events as they are published.
        """
        queue: asyncio.Queue = asyncio.Queue()
        buffered_events: list[dict] = []

        # Add queue to channel subscribers and capture buffered events
        async with self._lock:
            self._channels[channel].append(queue)

            # Capture buffered events for replay (copy to avoid mutation during iteration)
            if channel in self._buffers:
                buffered_events = [event for _, event in self._buffers[channel]]

        logger.debug(
            "subscribe_created",
            channel=channel,
            buffered_events_count=len(buffered_events)
        )

        try:
            # First, replay all buffered events to catch up the subscriber
            for event in buffered_events:
                yield event

            if buffered_events:
                logger.debug(
                    "subscribe_buffer_replayed",
                    channel=channel,
                    events_replayed=len(buffered_events)
                )

            # Then, yield live events as they arrive
            while True:
                message = await queue.get()
                yield message
        except asyncio.CancelledError:
            logger.debug("subscribe_cancelled", channel=channel)
            raise
        finally:
            # Cleanup: remove queue from subscribers
            async with self._lock:
                if channel in self._channels:
                    with suppress(ValueError):
                        self._channels[channel].remove(queue)

                    # Clean up empty channels
                    if not self._channels[channel]:
                        del self._channels[channel]

            logger.debug("subscribe_cleaned", channel=channel)

    def get_subscriber_count(self, channel: str) -> int:
        """Get number of active subscribers for a channel."""
        return len(self._channels.get(channel, []))

    async def clear_buffer(self, channel: str) -> None:
        """Clear the event buffer for a channel.

        Call this when an analysis is complete to free memory.
        """
        async with self._lock:
            if channel in self._buffers:
                cleared_count = len(self._buffers[channel])
                del self._buffers[channel]
                logger.debug(
                    "buffer_cleared",
                    channel=channel,
                    events_cleared=cleared_count
                )


# Global broadcaster instance
broadcaster = EventBroadcaster()
```

### Key Design Decisions

**1. Event Buffering (Issue #SSE-RACE)**

**Problem**: Workflow starts → Events published → Frontend connects (late) → Events lost

**Solution**: Buffer recent 100 events per channel with 5-minute TTL
- Late-joining subscribers receive buffered events first
- Then receive live events
- Bounded memory (deque with maxlen=100)
- Auto-cleanup (5-minute TTL)

**2. Channel-Based Routing**

**Pattern**: `workflow:{analysis_id}` → Each analysis has its own event channel
- Isolated event streams per analysis
- Multiple analyses can run concurrently
- No cross-contamination

**3. Asyncio.Queue for Pub/Sub**

**Why not Redis Pub/Sub?**
- In-memory is sufficient for single-instance deployment
- Lower latency (no network overhead)
- Simpler setup (no external dependency)

**When to use Redis?**
- Multi-instance backend (horizontal scaling)
- Event persistence across restarts
- Cross-service event bus

## SSE Handler

**Location**: `backend/app/api/v1/analysis/sse_handler.py`

### Core Implementation

```python
"""SSE endpoint handler for analysis progress streaming."""

import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from contextlib import aclosing
from datetime import UTC, datetime

from fastapi import Request
from sse_starlette.sse import EventSourceResponse

from app.core.logging import get_logger
from app.shared.services.messaging.broadcaster import broadcaster

logger = get_logger(__name__)


async def stream_analysis_progress(
    analysis_id: uuid.UUID,
    request: Request,
) -> EventSourceResponse:
    """Stream real-time analysis progress via Server-Sent Events (SSE).

    Establishes an SSE connection for the specified analysis and streams
    progress events as they occur during workflow execution. Events include
    stage updates, status changes, and completion notifications.

    Event Types:
        - progress: Stage status updates (running, complete)
        - error: Error notifications with error details
        - complete: Final workflow completion

    Example Server Events:
        ```
        event: progress
        data: {"type": "progress", "stage": "extraction", "status": "running"}

        event: progress
        data: {"type": "progress", "stage": "extraction", "status": "complete", "word_count": 5234}

        event: complete
        data: {"type": "complete", "stage": "artifact_generation"}
        ```
    """
    channel = f"workflow:{analysis_id}"

    logger.info(
        "sse_connection_started",
        analysis_id=str(analysis_id),
        channel=channel
    )

    async def client_close_handler(message: dict) -> None:
        """Handle client disconnect with cleanup logging.

        Called automatically by sse-starlette 3.0.3 when client disconnects.
        """
        logger.info(
            "sse_client_disconnected",
            analysis_id=str(analysis_id),
            channel=channel,
            message=str(message)
        )

    async def event_generator() -> AsyncIterator[dict[str, str]]:
        """Generate SSE events from broadcaster subscription.

        Leverages sse-starlette 3.0.3 features:
        - Automatic disconnect detection (no manual checks needed)
        - Better exception propagation for clearer error messages
        - Improved cancellation handling with asyncio.CancelledError

        Uses aclosing() to ensure proper cleanup of the broadcaster subscription
        even if streaming is interrupted.
        """
        try:
            # Use aclosing() to ensure proper cleanup of async generator
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
                            analysis_id=str(analysis_id),
                            channel=channel
                        )
                        break

        except asyncio.CancelledError:
            # sse-starlette 3.0.3 automatically cancels on client disconnect
            logger.info(
                "sse_connection_cancelled",
                analysis_id=str(analysis_id),
                channel=channel
            )
            raise
        except ConnectionError as e:
            logger.warning(
                "sse_connection_error",
                analysis_id=str(analysis_id),
                error=str(e)
            )
            # Send structured error event
            yield {
                "event": "error",
                "data": json.dumps({
                    "type": "error",
                    "error_type": "ConnectionError",
                    "analysis_id": str(analysis_id),
                    "error": "Connection error occurred",
                    "message": str(e),
                    "timestamp": datetime.now(UTC).isoformat()
                })
            }
        except Exception as e:
            logger.error(
                "sse_unexpected_error",
                analysis_id=str(analysis_id),
                error_type=type(e).__name__,
                error=str(e),
                exc_info=True
            )
            yield {
                "event": "error",
                "data": json.dumps({
                    "type": "error",
                    "error_type": type(e).__name__,
                    "analysis_id": str(analysis_id),
                    "error": "Unexpected error occurred",
                    "message": str(e),
                    "timestamp": datetime.now(UTC).isoformat()
                })
            }
        finally:
            logger.debug(
                "sse_event_generator_exiting",
                analysis_id=str(analysis_id),
                channel=channel
            )

    # Configure EventSourceResponse with sse-starlette 3.0.3 enhancements
    return EventSourceResponse(
        event_generator(),
        client_close_handler_callable=client_close_handler,
        send_timeout=30.0  # 30 seconds timeout for unresponsive clients
    )
```

### Key Design Decisions

**1. aclosing() for Cleanup**

**Why**: Ensures broadcaster.subscribe() generator is properly closed even if SSE connection is interrupted
```python
async with aclosing(broadcaster.subscribe(channel)) as subscription:
    async for event in subscription:
        yield event
```

**2. Structured Error Events**

**Pattern**: Send error as SSE event (not HTTP error)
```python
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

**Benefit**: Frontend can display error in UI without losing connection

**3. Auto-close on Complete**

**Pattern**: Break generator loop when `complete` event is received
```python
if event.get("type") == "complete":
    logger.info("sse_complete_event_sent")
    break
```

**Benefit**: Clean connection closure, no lingering connections

## Workflow Integration

### Publishing Events from Workflow

**Location**: `backend/app/domains/analysis/workflows/nodes/*.py`

```python
from app.shared.services.messaging.broadcaster import broadcaster

async def extraction_node(state: WorkflowState) -> dict[str, Any]:
    """Extract content from URL."""
    analysis_id = state["analysis_id"]
    channel = f"workflow:{analysis_id}"

    # Publish start event
    await broadcaster.publish(channel, {
        "type": "progress",
        "stage": "extraction",
        "status": "running",
        "timestamp": datetime.now(UTC).isoformat()
    })

    # Do extraction work
    try:
        content = await extract_content(state["url"])

        # Publish success event
        await broadcaster.publish(channel, {
            "type": "progress",
            "stage": "extraction",
            "status": "complete",
            "word_count": len(content.split()),
            "timestamp": datetime.now(UTC).isoformat()
        })

        return {"content": content}

    except Exception as e:
        # Publish error event
        await broadcaster.publish(channel, {
            "type": "error",
            "stage": "extraction",
            "error": str(e),
            "timestamp": datetime.now(UTC).isoformat()
        })
        raise
```

### Final Complete Event

**Location**: `backend/app/api/v1/analysis/workflow_runner.py`

```python
async def run_workflow_task(
    analysis_id: uuid.UUID,
    url: str,
    skill_level: str
) -> None:
    """Run analysis workflow and publish completion event."""
    channel = f"workflow:{analysis_id}"

    try:
        # Run workflow
        result = await workflow.ainvoke(initial_state)

        # Publish final complete event
        await broadcaster.publish(channel, {
            "type": "complete",
            "stage": "artifact_generation",
            "timestamp": datetime.now(UTC).isoformat()
        })

        # Clear buffer to free memory
        await broadcaster.clear_buffer(channel)

    except Exception as e:
        logger.error(
            "workflow_failed",
            analysis_id=str(analysis_id),
            error=str(e),
            exc_info=True
        )
        # Error event already published by failing node
```

## Frontend Integration (React)

### EventSource Hook

**Location**: `frontend/src/features/analysis/hooks/useAnalysisProgress.ts`

```typescript
import { useEffect, useState } from 'react';

interface ProgressEvent {
  type: 'progress' | 'error' | 'complete';
  stage: string;
  status?: string;
  message?: string;
  timestamp: string;
}

export function useAnalysisProgress(analysisId: string) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(
      `http://localhost:8500/api/v1/analyze/${analysisId}/stream`
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
      setError(event.message || 'Unknown error');
      setEvents((prev) => [...prev, event]);
    });

    // Connection error handler
    eventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
      eventSource.close();
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [analysisId]);

  return { events, isComplete, error };
}
```

### UI Component

```typescript
import { useAnalysisProgress } from '@/features/analysis/hooks/useAnalysisProgress';

export function AnalysisProgress({ analysisId }: { analysisId: string }) {
  const { events, isComplete, error } = useAnalysisProgress(analysisId);

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div>
      <h3>Analysis Progress</h3>
      {events.map((event, idx) => (
        <div key={idx} className="event">
          <strong>{event.stage}</strong>: {event.status}
        </div>
      ))}
      {isComplete && <div className="success">✓ Analysis complete!</div>}
    </div>
  );
}
```

## Testing

### Manual Test (cURL)

```bash
curl -N -H "Accept: text/event-stream" \
  http://localhost:8500/api/v1/analyze/550e8400-e29b-41d4-a716-446655440000/stream
```

**Expected output**:
```
event: progress
data: {"type":"progress","stage":"extraction","status":"running","timestamp":"2025-12-21T10:30:15Z"}

event: progress
data: {"type":"progress","stage":"extraction","status":"complete","word_count":5234}

event: complete
data: {"type":"complete","stage":"artifact_generation","timestamp":"2025-12-21T10:32:45Z"}
```

### Unit Test (Broadcaster)

**Location**: `backend/tests/unit/test_event_broadcaster.py`

```python
import pytest
from app.shared.services.messaging.broadcaster import EventBroadcaster

@pytest.mark.asyncio
async def test_event_buffering():
    """Test that events are buffered for late-joining subscribers."""
    broadcaster = EventBroadcaster()
    channel = "test:123"

    # Publish events BEFORE subscriber connects
    await broadcaster.publish(channel, {"type": "event1"})
    await broadcaster.publish(channel, {"type": "event2"})

    # Subscribe AFTER events were published
    events = []
    async for event in broadcaster.subscribe(channel):
        events.append(event)
        if len(events) == 2:
            break

    # Verify subscriber received buffered events
    assert len(events) == 2
    assert events[0]["type"] == "event1"
    assert events[1]["type"] == "event2"
```

## Event Types

### 1. Progress Event

```json
{
  "type": "progress",
  "stage": "extraction",
  "status": "running",
  "timestamp": "2025-12-21T10:30:15Z"
}
```

### 2. Progress Complete Event

```json
{
  "type": "progress",
  "stage": "extraction",
  "status": "complete",
  "word_count": 5234,
  "timestamp": "2025-12-21T10:30:45Z"
}
```

### 3. Error Event

```json
{
  "type": "error",
  "stage": "extraction",
  "error": "Failed to fetch URL: Connection timeout",
  "timestamp": "2025-12-21T10:30:20Z"
}
```

### 4. Complete Event

```json
{
  "type": "complete",
  "stage": "artifact_generation",
  "timestamp": "2025-12-21T10:32:45Z"
}
```

## Best Practices Learned

### 1. Always Buffer Events

**Lesson**: Even with "fast" workflows, race conditions happen
**Solution**: Always buffer recent events (OrchestKit: 100 events, 5-minute TTL)

### 2. Use aclosing() for Generators

**Lesson**: Async generators don't auto-close on exception
**Solution**: Wrap with `aclosing()` for guaranteed cleanup

### 3. Send Errors as Events

**Lesson**: HTTP errors close SSE connection
**Solution**: Send errors as SSE events, keep connection alive

### 4. Include Timestamps

**Lesson**: Hard to debug timing issues without timestamps
**Solution**: Include ISO 8601 timestamp in every event

### 5. Clear Buffers After Completion

**Lesson**: Buffers consume memory indefinitely
**Solution**: Clear buffer after `complete` event

## Related Files

- **Broadcaster**: `backend/app/shared/services/messaging/broadcaster.py`
- **SSE Handler**: `backend/app/api/v1/analysis/sse_handler.py`
- **Endpoint**: `backend/app/api/v1/analysis/endpoints.py`
- **Workflow Runner**: `backend/app/api/v1/analysis/workflow_runner.py`
- **Tests**: `backend/tests/unit/test_event_broadcaster.py`

## References

- See `references/sse-deep-dive.md` for protocol details
- See `scripts/sse-endpoint-template.ts` for TypeScript client template
- See sse-starlette documentation: https://github.com/sysid/sse-starlette
