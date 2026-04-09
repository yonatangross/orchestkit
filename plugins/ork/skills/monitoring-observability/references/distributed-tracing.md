# Distributed Tracing

Track requests across microservices with OpenTelemetry.

## Basic Setup (Node.js)

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

## Span Relationships

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

# Parent span
with tracer.start_as_current_span("analyze_content") as parent_span:
    parent_span.set_attribute("content.url", url)
    parent_span.set_attribute("content.type", "article")

    # Child span (sequential)
    with tracer.start_as_current_span("fetch_content") as fetch_span:
        content = await fetch_url(url)
        fetch_span.set_attribute("content.size_bytes", len(content))

    # Another child span (sequential)
    with tracer.start_as_current_span("generate_embedding") as embed_span:
        embedding = await embed_text(content)
        embed_span.set_attribute("embedding.dimensions", len(embedding))

    # Parallel child spans (using asyncio.gather)
    async def analyze_with_span(agent_name: str, content: str):
        with tracer.start_as_current_span(f"agent_{agent_name}"):
            return await agent.analyze(content)

    results = await asyncio.gather(
        analyze_with_span("tech_comparator", content),
        analyze_with_span("security_auditor", content),
        analyze_with_span("implementation_planner", content)
    )
```

## Trace Sampling Strategies

**Head-based sampling** (decide at trace start):
```python
from opentelemetry.sdk.trace.sampling import (
    TraceIdRatioBased,  # Sample X% of traces
    ParentBased,        # Follow parent's sampling decision
    ALWAYS_ON,          # Always sample
    ALWAYS_OFF          # Never sample
)

# Sample 10% of traces
sampler = TraceIdRatioBased(0.1)
```

**Tail-based sampling** (decide after trace completes):
- Keep all traces with errors
- Keep slow traces (p95+ latency)
- Sample 1% of successful fast traces

**Recommended sampling:**
- Development: 100% sampling
- Production: 10% sampling, 100% for errors

## Context Propagation

```typescript
// Service A: Create trace context
const ctx = context.active();

// Service B: Extract trace context from headers
const propagatedCtx = propagation.extract(ctx, request.headers);
context.with(propagatedCtx, () => {
  // This span will be child of Service A's span
  const span = tracer.startSpan('service_b_operation');
  // ...
  span.end();
});
```

## Trace Analysis Queries

**Find slow traces:**
```
duration > 2s
```

**Find traces with errors:**
```
status = error
```

**Find traces for specific user:**
```
user.id = "abc-123"
```

**Find traces hitting specific service:**
```
service.name = "analysis-worker"
```

## Claude Code TRACEPARENT Propagation (CC 2.1.97)

CC 2.1.97 injects a W3C `TRACEPARENT` env var into all Bash subprocesses when OTEL tracing is enabled. This enables end-to-end distributed tracing from Claude Code through to your services.

**Format:** `TRACEPARENT=00-{trace_id}-{parent_id}-{trace_flags}`

```typescript
// In a subprocess spawned by Claude Code's Bash tool:
const traceparent = process.env.TRACEPARENT;
if (traceparent) {
  // Parse W3C Trace Context header
  const [version, traceId, parentId, traceFlags] = traceparent.split('-');

  // Propagate to downstream HTTP calls
  fetch('https://api.example.com/data', {
    headers: { 'traceparent': traceparent },
  });
}
```

**OrchestKit hook telemetry correlation:**
Hook events forwarded to HQ include the `TRACEPARENT` value when available, enabling correlation between CC tool spans and downstream service traces in Langfuse/Jaeger.

```typescript
// Telemetry payload includes traceparent for cross-system correlation
{
  "event": "PostToolUse",
  "tool": "Bash",
  "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  "session_id": "...",
  "timestamp": "..."
}
```

## Best Practices

1. **Sample smartly** - 10% for high traffic, 100% for errors
2. **Add attributes** - user_id, order_id, error_type
3. **Propagate context** - across HTTP, gRPC, message queues
4. **Tag errors** - `error=true` for filtering
5. **Capture TRACEPARENT** - in subprocesses spawned by CC for end-to-end traces (CC 2.1.97)

See `scripts/opentelemetry-tracing.ts` for complete setup.