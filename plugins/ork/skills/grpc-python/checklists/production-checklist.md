# gRPC Production Deployment Checklist

Essential considerations for deploying gRPC services to production.

## Server Configuration

### Connection Management

- [ ] **Keepalive settings configured**
  ```python
  ("grpc.keepalive_time_ms", 30000),      # Send ping every 30s
  ("grpc.keepalive_timeout_ms", 10000),   # Wait 10s for pong
  ("grpc.keepalive_permit_without_calls", True),
  ("grpc.http2.max_pings_without_data", 0),
  ```

- [ ] **Message size limits set**
  ```python
  ("grpc.max_send_message_length", 50 * 1024 * 1024),     # 50MB
  ("grpc.max_receive_message_length", 50 * 1024 * 1024),
  ```

- [ ] **Concurrent streams limited**
  ```python
  ("grpc.max_concurrent_streams", 100),
  ```

### Health Checks

- [ ] **Health service registered** - `grpc_health.v1.HealthServicer`
- [ ] **Per-service health status** - Not just overall
- [ ] **Health status updated on failures** - Database down = NOT_SERVING
- [ ] **Kubernetes probes configured**
  ```yaml
  livenessProbe:
    grpc:
      port: 50051
      service: ""  # Overall health
    initialDelaySeconds: 10
    periodSeconds: 10
  readinessProbe:
    grpc:
      port: 50051
      service: "user.v1.UserService"
    periodSeconds: 5
  ```

### Graceful Shutdown

- [ ] **Signal handlers installed** - SIGTERM, SIGINT
- [ ] **Health status set to NOT_SERVING first** - Stop new traffic
- [ ] **Drain period configured** - Allow in-flight requests to complete
- [ ] **Maximum drain timeout** - Don't wait forever (30-60s)

```python
async def graceful_shutdown(server, health_servicer, timeout=30):
    # 1. Mark as not serving
    health_servicer.set("", health_pb2.NOT_SERVING)

    # 2. Stop accepting new connections and drain
    await server.stop(timeout)
```

## Client Configuration

### Timeouts (CRITICAL)

- [ ] **Deadline set on EVERY call** - Never call without timeout
- [ ] **Appropriate timeout values**:
  - Simple reads: 1-5 seconds
  - Complex queries: 10-30 seconds
  - Streaming: Per-message timeout or overall

```python
# ALWAYS set timeout
response = await stub.GetUser(request, timeout=5.0)
```

### Retry Configuration

- [ ] **Retryable status codes defined**
  ```python
  RETRYABLE = {
      grpc.StatusCode.UNAVAILABLE,
      grpc.StatusCode.DEADLINE_EXCEEDED,
      grpc.StatusCode.RESOURCE_EXHAUSTED,
      grpc.StatusCode.ABORTED,
  }
  ```

- [ ] **Exponential backoff with jitter**
  ```python
  delay = min(base * 2**attempt, max_delay)
  delay += random.uniform(-jitter, jitter)
  ```

- [ ] **Maximum retry attempts** - 3-5 attempts typically
- [ ] **Retry budget** - Don't overwhelm failing service

### Connection Pooling

- [ ] **Channel reuse** - Don't create per-request
- [ ] **Pool size appropriate** - 1 channel handles many concurrent RPCs
- [ ] **Load balancing configured** - round_robin for multiple backends

```python
("grpc.lb_policy_name", "round_robin"),
```

## Security

### TLS Configuration

- [ ] **TLS enabled in production** - Never insecure_channel in prod
- [ ] **Certificate validation enabled** - Don't skip verification
- [ ] **mTLS for service-to-service** - Client certs for internal services

```python
# Server
credentials = grpc.ssl_server_credentials(
    [(private_key, certificate_chain)],
    root_certificates=ca_cert,
    require_client_auth=True,
)
server.add_secure_port('[::]:50051', credentials)

# Client
credentials = grpc.ssl_channel_credentials(
    root_certificates=ca_cert,
    private_key=client_key,
    certificate_chain=client_cert,
)
channel = aio.secure_channel('server:50051', credentials)
```

### Authentication

- [ ] **Token in metadata** - Not in request body
- [ ] **Server interceptor validates** - Before processing request
- [ ] **Public methods allowlisted** - Health check typically public

```python
class AuthInterceptor(aio.ServerInterceptor):
    PUBLIC_METHODS = {"/grpc.health.v1.Health/Check"}

    async def intercept_service(self, continuation, handler_call_details):
        if handler_call_details.method in self.PUBLIC_METHODS:
            return await continuation(handler_call_details)

        metadata = dict(handler_call_details.invocation_metadata)
        token = metadata.get("authorization", "").replace("Bearer ", "")

        if not validate_token(token):
            # Return unauthenticated handler
            ...
```

## Observability

### Logging

- [ ] **Structured logging** - JSON format for aggregation
- [ ] **Request ID in context** - For distributed tracing
- [ ] **Method and status logged** - For debugging
- [ ] **Duration logged** - For performance analysis
- [ ] **Sensitive data masked** - Passwords, tokens

### Metrics

- [ ] **Request count by method** - `grpc_server_handled_total`
- [ ] **Latency histogram** - `grpc_server_handling_seconds`
- [ ] **Error rate** - By status code
- [ ] **Active connections** - Connection pool health

```python
from prometheus_client import Counter, Histogram

grpc_requests = Counter(
    'grpc_requests_total',
    'Total gRPC requests',
    ['method', 'status']
)

grpc_latency = Histogram(
    'grpc_request_duration_seconds',
    'gRPC request latency',
    ['method']
)
```

### Tracing

- [ ] **OpenTelemetry integration** - Distributed tracing
- [ ] **Trace context propagated** - Via metadata
- [ ] **Span per RPC** - With method, status
- [ ] **Sampling configured** - 1-10% for high traffic

## Load Balancing

### Service Discovery

- [ ] **DNS or service mesh** - Kubernetes Service or Istio
- [ ] **Client-side LB** - round_robin, pick_first
- [ ] **Health-aware routing** - Exclude unhealthy instances

```python
# DNS-based with round_robin
channel = grpc.insecure_channel(
    "dns:///my-service.namespace.svc.cluster.local:50051",
    options=[("grpc.lb_policy_name", "round_robin")],
)
```

### Rate Limiting

- [ ] **Server-side rate limiting** - Protect from overload
- [ ] **Client-side throttling** - Respect RESOURCE_EXHAUSTED
- [ ] **Retry-After header** - When rate limited

## Deployment

### Container Configuration

- [ ] **Non-root user** - Security best practice
- [ ] **Read-only filesystem** - Where possible
- [ ] **Resource limits set** - CPU, memory
- [ ] **Port exposed** - 50051 default

```dockerfile
FROM python:3.11-slim

# Install dependencies
RUN pip install grpcio grpcio-tools grpcio-health-checking

# Run as non-root
RUN useradd -m -u 1000 appuser
USER appuser

EXPOSE 50051
CMD ["python", "-m", "app.server"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
      - name: grpc-service
        ports:
        - containerPort: 50051
          protocol: TCP
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          grpc:
            port: 50051
        readinessProbe:
          grpc:
            port: 50051
```

## Testing

### Integration Tests

- [ ] **Test with real proto messages** - Not mocked
- [ ] **Test all RPC types** - Unary, streaming
- [ ] **Test error scenarios** - NOT_FOUND, validation errors
- [ ] **Test deadlines** - Ensure timeouts work

### Load Testing

- [ ] **ghz or grpcurl for load testing**
- [ ] **Test concurrent connections** - Find limits
- [ ] **Test streaming under load** - Memory, goroutines
- [ ] **Document performance baseline** - Latency, throughput

```bash
# Load test with ghz
ghz --insecure \
  --proto ./protos/user.proto \
  --call user.v1.UserService.GetUser \
  -d '{"user_id": "123"}' \
  -n 10000 \
  -c 50 \
  localhost:50051
```

## Common Production Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| Missing deadline | Requests hang forever | Always set timeout |
| No health check | LB sends to dead pods | Add health service |
| Channel per request | Connection exhaustion | Reuse channels |
| No retry | Single failure = error | Add retry interceptor |
| Insecure in prod | Security vulnerability | Enable TLS |
| No graceful shutdown | Lost requests on deploy | Handle SIGTERM |
