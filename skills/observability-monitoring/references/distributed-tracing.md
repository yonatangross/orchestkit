# Distributed Tracing with OpenTelemetry

Track requests across microservices.

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

## Manual Spans

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('my-service');

async function processOrder(orderId: string) {
  const span = tracer.startSpan('process_order');
  span.setAttribute('order.id', orderId);

  try {
    await fetchOrder(orderId);
    await chargePayment(orderId);
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}
```

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

## Best Practices

1. **Sample smartly** - 10% for high traffic, 100% for errors
2. **Add attributes** - user_id, order_id, error_type
3. **Propagate context** - across HTTP, gRPC, message queues
4. **Tag errors** - `error=true` for filtering

See `templates/opentelemetry-tracing.ts` for complete setup.
