# Monitoring Implementation Checklist

Complete guide for implementing production-grade monitoring, based on SkillForge's real setup.

## Prerequisites

- [ ] Application deployed (dev/staging/production)
- [ ] Docker or Kubernetes for monitoring stack
- [ ] Basic understanding of Prometheus, Grafana, Loki

## Phase 1: Structured Logging

### Python (structlog)

**Install dependencies:**
```bash
pip install structlog python-json-logger
```

- [ ] Install structlog and dependencies
- [ ] Add to requirements.txt

**Configure structlog:**

**File:** `backend/app/core/logging.py`

```python
import logging
import structlog
from structlog.processors import JSONRenderer, TimeStamper, add_log_level

def configure_logging():
    """Configure structured logging with JSON output."""

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,  # Merge correlation IDs
            add_log_level,
            TimeStamper(fmt="iso"),
            JSONRenderer()
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True
    )

def get_logger(name: str):
    """Get a structured logger instance."""
    return structlog.get_logger(name)
```

- [ ] Create logging configuration module
- [ ] Configure JSON output (not plain text)
- [ ] Set appropriate log level (INFO for production)
- [ ] Add timestamp processor
- [ ] Enable context variable merging

**Add correlation ID middleware:**

```python
import structlog
import uuid_utils  # pip install uuid-utils (UUID v7 for Python < 3.14)
from fastapi import Request

@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    """Add correlation ID to all logs."""

    # Get or generate correlation ID (UUID v7 for time-ordering in traces)
    correlation_id = request.headers.get("X-Correlation-ID") or str(uuid_utils.uuid7())

    # Bind to logger context
    structlog.contextvars.bind_contextvars(
        correlation_id=correlation_id,
        method=request.method,
        path=request.url.path
    )

    # Process request
    response = await call_next(request)

    # Add to response headers
    response.headers["X-Correlation-ID"] = correlation_id

    # Clear context
    structlog.contextvars.clear_contextvars()

    return response
```

- [ ] Add correlation ID middleware
- [ ] Generate UUID if not provided
- [ ] Bind correlation_id to all logs in request
- [ ] Return correlation_id in response headers
- [ ] Clear context after request

### Node.js (winston)

**Install dependencies:**
```bash
npm install winston express-winston uuid
```

- [ ] Install winston and dependencies
- [ ] Add to package.json

**Configure winston:**

**File:** `src/lib/logger.ts`

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export const getLogger = (name: string) => {
  return logger.child({ logger: name });
};
```

- [ ] Create logger configuration
- [ ] Use JSON format
- [ ] Add timestamp to all logs
- [ ] Support child loggers with context

## Phase 2: Metrics Collection

### Python (prometheus-client)

**Install:**
```bash
pip install prometheus-client
```

- [ ] Install prometheus-client
- [ ] Add to requirements.txt

**Create metrics module:**

**File:** `backend/app/core/metrics.py`

```python
from prometheus_client import Counter, Histogram, Gauge

# HTTP request metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
)

# Database metrics
db_query_duration_seconds = Histogram(
    'db_query_duration_seconds',
    'Database query latency',
    ['query_type'],
    buckets=[0.001, 0.01, 0.05, 0.1, 0.5, 1]
)

db_connections_active = Gauge(
    'db_connections_active',
    'Number of active database connections'
)

# LLM metrics
llm_tokens_used = Counter(
    'llm_tokens_used_total',
    'Total LLM tokens consumed',
    ['model', 'operation', 'token_type']
)

llm_cost_dollars = Counter(
    'llm_cost_dollars_total',
    'Total LLM cost in dollars',
    ['model', 'operation']
)

# Cache metrics
cache_operations = Counter(
    'cache_operations_total',
    'Cache operations',
    ['operation', 'result']  # result=hit|miss
)
```

- [ ] Define HTTP metrics (requests, latency)
- [ ] Define database metrics (query latency, connections)
- [ ] Define LLM metrics (tokens, cost)
- [ ] Define cache metrics (hits, misses)
- [ ] Use appropriate metric types (Counter, Histogram, Gauge)
- [ ] Choose meaningful bucket boundaries

**Add metrics middleware:**

```python
from fastapi import Request
import time
from app.core.metrics import http_requests_total, http_request_duration_seconds

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Track HTTP request metrics."""

    start_time = time.time()

    # Process request
    response = await call_next(request)

    # Record metrics
    duration = time.time() - start_time

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
```

- [ ] Add metrics middleware
- [ ] Track request count
- [ ] Track request duration
- [ ] Label by method, endpoint, status

**Expose metrics endpoint:**

```python
from fastapi import Response
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

@app.get("/metrics")
async def metrics():
    """Expose Prometheus metrics."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )
```

- [ ] Add `/metrics` endpoint
- [ ] Return Prometheus format
- [ ] Secure endpoint (internal network only)

### Node.js (prom-client)

**Install:**
```bash
npm install prom-client
```

- [ ] Install prom-client
- [ ] Add to package.json

**Create metrics:**

```typescript
import { Counter, Histogram, register } from 'prom-client';

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'endpoint', 'status']
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'endpoint'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

- [ ] Define metrics with prom-client
- [ ] Add `/metrics` endpoint
- [ ] Use consistent label names

## Phase 3: Prometheus Setup

### Docker Compose

**File:** `monitoring/docker-compose.yml`

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./prometheus/alerts:/etc/prometheus/alerts
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources
      - grafana-data:/var/lib/grafana

  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - ./loki/loki.yml:/etc/loki/local-config.yaml
      - loki-data:/loki

  promtail:
    image: grafana/promtail:latest
    volumes:
      - ./promtail/promtail.yml:/etc/promtail/config.yml
      - /var/log:/var/log
    command: -config.file=/etc/promtail/config.yml

volumes:
  prometheus-data:
  grafana-data:
  loki-data:
```

- [ ] Create docker-compose.yml
- [ ] Add Prometheus service
- [ ] Add Grafana service
- [ ] Add Loki + Promtail for logs
- [ ] Configure volumes for persistence
- [ ] Set retention periods

### Prometheus Configuration

**File:** `monitoring/prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'backend'
    static_configs:
      - targets: ['backend:8500']  # Your app's /metrics endpoint

  - job_name: 'frontend'
    static_configs:
      - targets: ['frontend:3000']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

# Load alerting rules
rule_files:
  - '/etc/prometheus/alerts/*.yml'

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

- [ ] Create Prometheus config
- [ ] Add scrape targets for all services
- [ ] Configure scrape interval (15s recommended)
- [ ] Load alerting rules
- [ ] Configure Alertmanager

## Phase 4: Alerting Rules

**File:** `monitoring/prometheus/alerts/service.yml`

```yaml
groups:
- name: service-health
  interval: 30s
  rules:
  - alert: ServiceDown
    expr: up == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Service {{ $labels.job }} is down"

  - alert: HighErrorRate
    expr: |
      sum(rate(http_requests_total{status=~"5.."}[5m])) /
      sum(rate(http_requests_total[5m])) > 0.05
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Error rate above 5%"

  - alert: HighLatency
    expr: |
      histogram_quantile(0.95,
        rate(http_request_duration_seconds_bucket[5m])
      ) > 2
    for: 10m
    labels:
      severity: high
    annotations:
      summary: "p95 latency above 2s"
```

- [ ] Create alerting rules file
- [ ] Add service availability alerts
- [ ] Add error rate alerts
- [ ] Add latency alerts
- [ ] Set appropriate thresholds
- [ ] Add meaningful annotations

**File:** `monitoring/prometheus/alerts/application.yml`

```yaml
groups:
- name: application-metrics
  interval: 1m
  rules:
  # Cache performance
  - alert: LowCacheHitRate
    expr: |
      sum(rate(cache_operations_total{result="hit"}[30m])) /
      sum(rate(cache_operations_total[30m])) < 0.70
    for: 1h
    labels:
      severity: medium
    annotations:
      summary: "Cache hit rate below 70%"

  # Database performance
  - alert: SlowQueries
    expr: |
      histogram_quantile(0.95,
        rate(db_query_duration_seconds_bucket[5m])
      ) > 0.5
    for: 10m
    labels:
      severity: high
    annotations:
      summary: "Database queries slow (p95 > 500ms)"

  # LLM cost
  - alert: HighDailyCost
    expr: sum(increase(llm_cost_dollars_total[24h])) > 50
    labels:
      severity: high
    annotations:
      summary: "Daily LLM cost exceeded $50"
```

- [ ] Add cache alerts
- [ ] Add database alerts
- [ ] Add LLM cost alerts
- [ ] Set severity levels correctly

## Phase 5: Grafana Dashboards

### Datasource Configuration

**File:** `monitoring/grafana/datasources/prometheus.yml`

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
```

- [ ] Configure Prometheus datasource
- [ ] Configure Loki datasource
- [ ] Set Prometheus as default

### Service Overview Dashboard

**Create dashboard with:**

1. **Golden Signals Row:**
   - [ ] Latency (p50, p95, p99)
   - [ ] Traffic (requests/second)
   - [ ] Errors (error rate %)
   - [ ] Saturation (CPU, memory)

2. **Request Breakdown:**
   - [ ] Requests by endpoint
   - [ ] Requests by status code
   - [ ] Request rate over time

3. **Dependencies:**
   - [ ] Database query latency
   - [ ] Redis latency
   - [ ] External API latency

4. **Resources:**
   - [ ] CPU usage
   - [ ] Memory usage
   - [ ] Disk I/O
   - [ ] Network I/O

### Example Panel Queries

**Latency Panel:**
```promql
# p50 latency
histogram_quantile(0.5, rate(http_request_duration_seconds_bucket[5m]))

# p95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# p99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

**Traffic Panel:**
```promql
sum(rate(http_requests_total[5m]))
```

**Error Rate Panel:**
```promql
sum(rate(http_requests_total{status=~"5.."}[5m])) /
sum(rate(http_requests_total[5m]))
```

- [ ] Add all key panels
- [ ] Use appropriate visualization types
- [ ] Add thresholds for red/yellow/green
- [ ] Set refresh interval (10s-30s)

## Phase 6: Log Aggregation (Loki)

### Loki Configuration

**File:** `monitoring/loki/loki.yml`

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1

schema_config:
  configs:
    - from: 2024-01-01
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/index
    cache_location: /loki/cache
  filesystem:
    directory: /loki/chunks

limits_config:
  retention_period: 168h  # 7 days
```

- [ ] Create Loki config
- [ ] Set retention period
- [ ] Configure storage backend
- [ ] Set appropriate limits

### Promtail Configuration

**File:** `monitoring/promtail/promtail.yml`

```yaml
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        target_label: 'container'
      - source_labels: ['__meta_docker_container_log_stream']
        target_label: 'stream'
```

- [ ] Create Promtail config
- [ ] Configure log sources (Docker, files, etc.)
- [ ] Add labels for filtering
- [ ] Point to Loki endpoint

## Phase 7: Testing & Validation

### Test Metrics Collection

```bash
# Check metrics endpoint
curl http://localhost:8500/metrics

# Verify Prometheus scraping
curl http://localhost:9090/api/v1/targets

# Query metrics
curl 'http://localhost:9090/api/v1/query?query=http_requests_total'
```

- [ ] Verify `/metrics` endpoint works
- [ ] Check Prometheus targets are up
- [ ] Query metrics via API
- [ ] Verify labels are correct

### Test Logging

```bash
# Check logs in Loki
curl -G 'http://localhost:3100/loki/api/v1/query' \
  --data-urlencode 'query={job="backend"}' \
  --data-urlencode 'limit=10'
```

- [ ] Verify logs appear in Loki
- [ ] Check JSON parsing works
- [ ] Verify labels are correct
- [ ] Test LogQL queries

### Test Alerting

```bash
# Check alert rules loaded
curl http://localhost:9090/api/v1/rules

# Check active alerts
curl http://localhost:9090/api/v1/alerts
```

- [ ] Verify alert rules loaded
- [ ] Trigger test alert (cause error)
- [ ] Verify alert fires
- [ ] Check alert appears in Alertmanager

## Phase 8: Production Deployment

### Security Checklist

- [ ] Restrict `/metrics` endpoint to internal network
- [ ] Enable authentication for Grafana
- [ ] Use HTTPS for all dashboards
- [ ] Rotate Grafana admin password
- [ ] Set up RBAC for Grafana users
- [ ] Enable audit logging

### Performance Checklist

- [ ] Set appropriate retention periods (Prometheus: 30d, Loki: 7d)
- [ ] Configure metric cardinality limits
- [ ] Enable query caching
- [ ] Set memory limits for Prometheus
- [ ] Monitor monitoring stack resource usage

### Alerting Checklist

- [ ] Configure Alertmanager receivers (Slack, PagerDuty, email)
- [ ] Set up alert routing rules
- [ ] Add inhibition rules (suppress noisy alerts)
- [ ] Test alert delivery
- [ ] Create runbooks for all critical alerts
- [ ] Set up on-call schedule

## Phase 9: Ongoing Maintenance

### Daily Checks

- [ ] Review active alerts
- [ ] Check dashboard for anomalies
- [ ] Verify all scrape targets are up

### Weekly Checks

- [ ] Review top 10 slowest endpoints
- [ ] Check error rate trends
- [ ] Review LLM cost trends
- [ ] Update dashboards as needed

### Monthly Checks

- [ ] Review alert thresholds (tune for accuracy)
- [ ] Clean up unused metrics
- [ ] Update Prometheus/Grafana versions
- [ ] Review retention policies
- [ ] Audit dashboard access

## References

- Template: `../templates/structured-logging.ts`
- Template: `../templates/prometheus-metrics.ts`
- Template: `../templates/alerting-rules.yml`
- Example: `../examples/skillforge-monitoring-dashboard.md`
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
