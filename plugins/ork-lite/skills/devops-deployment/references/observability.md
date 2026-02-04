# Observability & Monitoring

Prometheus metrics, Grafana dashboards, and alerting patterns.

## Prometheus Metrics Exposition

```python
from prometheus_client import Counter, Histogram, generate_latest

# Define metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint']
)

@app.middleware("http")
async def prometheus_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time

    # Record metrics
    http_requests_total.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()

    http_request_duration_seconds.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)

    return response

@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type="text/plain")
```

## Grafana Dashboard Queries

```promql
# Request rate (requests per second)
rate(http_requests_total[5m])

# Error rate (4xx/5xx as percentage)
sum(rate(http_requests_total{status=~"4..|5.."}[5m])) /
sum(rate(http_requests_total[5m])) * 100

# p95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Pod CPU usage
sum(rate(container_cpu_usage_seconds_total{pod=~"myapp-.*"}[5m])) by (pod)
```

## Alerting Rules

```yaml
groups:
- name: app-alerts
  rules:
  - alert: HighErrorRate
    expr: |
      sum(rate(http_requests_total{status=~"5.."}[5m])) /
      sum(rate(http_requests_total[5m])) > 0.05
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value | humanizePercentage }}"

  - alert: HighLatency
    expr: |
      histogram_quantile(0.95,
        rate(http_request_duration_seconds_bucket[5m])
      ) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High p95 latency detected"
      description: "p95 latency is {{ $value }}s"

  - alert: PodCrashLooping
    expr: |
      increase(kube_pod_container_status_restarts_total[1h]) > 5
    for: 10m
    labels:
      severity: critical
    annotations:
      summary: "Pod is crash looping"
      description: "{{ $labels.pod }} has restarted {{ $value }} times"
```

## Key Metrics to Monitor

| Metric | Purpose | Alert Threshold |
|--------|---------|-----------------|
| Request rate | Traffic volume | Anomaly detection |
| Error rate | Service health | > 5% (critical) |
| p95 latency | User experience | > 2s (warning) |
| CPU usage | Resource utilization | > 80% sustained |
| Memory usage | Resource utilization | > 85% sustained |
| Pod restarts | Stability | > 3 in 1 hour |

## Golden Signals (SRE)

1. **Latency** - Time to serve a request
2. **Traffic** - Requests per second
3. **Errors** - Rate of failed requests
4. **Saturation** - Resource utilization

## Log Aggregation

Structured logging for observability:

```python
import structlog

logger = structlog.get_logger()

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())

    with structlog.contextvars.bound_contextvars(
        request_id=request_id,
        method=request.method,
        path=request.url.path,
    ):
        logger.info("request_started")
        response = await call_next(request)
        logger.info("request_completed", status=response.status_code)

    response.headers["X-Request-ID"] = request_id
    return response
```

## Distributed Tracing

OpenTelemetry integration:

```python
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

# Auto-instrument FastAPI
FastAPIInstrumentor.instrument_app(app)

# Manual spans for business logic
tracer = trace.get_tracer(__name__)

async def process_order(order_id: str):
    with tracer.start_as_current_span("process_order") as span:
        span.set_attribute("order_id", order_id)
        # Processing logic here
```