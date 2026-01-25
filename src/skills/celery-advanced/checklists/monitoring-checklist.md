# Celery Monitoring Setup Checklist

Complete guide for setting up Flower, Prometheus, and Grafana monitoring for Celery.

## Flower Dashboard Setup

### Installation

- [ ] **Install Flower**: `pip install flower>=2.0.0`
- [ ] **Add to requirements**: Include in production dependencies

### Basic Deployment

```bash
# Development
celery -A app flower --port=5555

# Production with auth
celery -A app flower \
    --port=5555 \
    --basic_auth=admin:${FLOWER_PASSWORD} \
    --broker_api=redis://localhost:6379/0

# With persistent storage (task history)
celery -A app flower \
    --port=5555 \
    --persistent=True \
    --db=/data/flower.db \
    --max_tasks=10000
```

### Flower Configuration

- [ ] **Authentication enabled**: `--basic_auth` or OAuth
- [ ] **Persistent storage**: `--persistent=True` for task history
- [ ] **URL prefix**: `--url_prefix=/flower` for reverse proxy
- [ ] **Task retention**: `--max_tasks=10000` to limit memory

### Kubernetes Deployment

```yaml
# flower-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: celery-flower
spec:
  replicas: 1
  selector:
    matchLabels:
      app: celery-flower
  template:
    metadata:
      labels:
        app: celery-flower
    spec:
      containers:
        - name: flower
          image: mher/flower:2.0
          ports:
            - containerPort: 5555
          env:
            - name: CELERY_BROKER_URL
              valueFrom:
                secretKeyRef:
                  name: celery-secrets
                  key: broker-url
            - name: FLOWER_BASIC_AUTH
              valueFrom:
                secretKeyRef:
                  name: celery-secrets
                  key: flower-auth
          command:
            - celery
            - flower
            - --broker=${CELERY_BROKER_URL}
            - --port=5555
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /healthcheck
              port: 5555
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /healthcheck
              port: 5555
            initialDelaySeconds: 5
            periodSeconds: 5
```

---

## Prometheus Metrics Setup

### Celery Exporter Installation

```bash
# Option 1: Standalone exporter
pip install celery-exporter

# Run exporter
celery-exporter \
    --broker-url=redis://localhost:6379/0 \
    --listen-address=0.0.0.0:9808
```

### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'celery'
    static_configs:
      - targets: ['celery-exporter:9808']
    scrape_interval: 15s
    metrics_path: /metrics

  - job_name: 'flower'
    static_configs:
      - targets: ['flower:5555']
    scrape_interval: 30s
    metrics_path: /metrics
```

### Custom Metrics with Signals

```python
# metrics.py
from prometheus_client import Counter, Histogram, Gauge, start_http_server
from celery import signals
import time

# Define metrics
TASK_COUNTER = Counter(
    "celery_tasks_total",
    "Total Celery tasks",
    ["task_name", "state"]
)

TASK_LATENCY = Histogram(
    "celery_task_latency_seconds",
    "Task execution latency",
    ["task_name"],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300]
)

QUEUE_LENGTH = Gauge(
    "celery_queue_length",
    "Number of tasks in queue",
    ["queue"]
)

ACTIVE_TASKS = Gauge(
    "celery_active_tasks",
    "Currently executing tasks",
    ["worker"]
)

# Track task start time
task_start_times = {}


@signals.task_prerun.connect
def on_task_start(sender, task_id, task, **kwargs):
    task_start_times[task_id] = time.time()
    TASK_COUNTER.labels(task_name=task.name, state="started").inc()


@signals.task_postrun.connect
def on_task_complete(sender, task_id, task, state, **kwargs):
    start_time = task_start_times.pop(task_id, None)
    if start_time:
        duration = time.time() - start_time
        TASK_LATENCY.labels(task_name=task.name).observe(duration)

    TASK_COUNTER.labels(task_name=task.name, state=state).inc()


@signals.task_failure.connect
def on_task_failure(sender, task_id, exception, **kwargs):
    TASK_COUNTER.labels(task_name=sender.name, state="failure").inc()


# Start metrics server
def start_metrics_server(port: int = 9100):
    start_http_server(port)
```

### Key Metrics to Track

- [ ] `celery_tasks_total`: Task counts by name and state
- [ ] `celery_task_latency_seconds`: Execution time histogram
- [ ] `celery_queue_length`: Queue depth by queue name
- [ ] `celery_active_tasks`: Currently running tasks
- [ ] `celery_worker_up`: Worker health status
- [ ] `celery_task_retry_total`: Retry counts

---

## Grafana Dashboard Setup

### Import Dashboard

1. Open Grafana
2. Go to Dashboards > Import
3. Enter dashboard ID: `16732` (Celery Tasks Overview)
4. Select Prometheus data source
5. Import

### Custom Dashboard Panels

#### Queue Depth Panel (Graph)

```promql
# Query
celery_queue_length{job="celery"}

# Legend: {{queue}}
```

#### Task Throughput Panel (Graph)

```promql
# Tasks per second by task name
rate(celery_tasks_total{state="success"}[5m])

# Legend: {{task_name}}
```

#### Task Latency Panel (Heatmap)

```promql
# P95 latency by task
histogram_quantile(0.95,
  rate(celery_task_latency_seconds_bucket[5m])
) by (task_name)
```

#### Error Rate Panel (Stat)

```promql
# Error rate percentage
100 * (
  rate(celery_tasks_total{state="failure"}[5m]) /
  rate(celery_tasks_total[5m])
)
```

#### Active Workers Panel (Table)

```promql
# Active tasks per worker
celery_active_tasks

# Columns: worker, value
```

### Dashboard JSON Template

```json
{
  "title": "Celery Monitoring",
  "panels": [
    {
      "title": "Queue Depth",
      "type": "timeseries",
      "targets": [
        {
          "expr": "celery_queue_length",
          "legendFormat": "{{queue}}"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "thresholds": {
            "steps": [
              {"color": "green", "value": 0},
              {"color": "yellow", "value": 100},
              {"color": "orange", "value": 500},
              {"color": "red", "value": 1000}
            ]
          }
        }
      }
    },
    {
      "title": "Task Success Rate",
      "type": "stat",
      "targets": [
        {
          "expr": "100 * rate(celery_tasks_total{state='success'}[5m]) / rate(celery_tasks_total[5m])"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "thresholds": {
            "steps": [
              {"color": "red", "value": 0},
              {"color": "yellow", "value": 95},
              {"color": "green", "value": 99}
            ]
          }
        }
      }
    }
  ]
}
```

---

## Alerting Rules

### Prometheus Alerts

```yaml
# celery-alerts.yml
groups:
  - name: celery
    interval: 30s
    rules:
      # No active workers
      - alert: CeleryNoWorkers
        expr: count(celery_worker_up == 1) == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "No Celery workers running"
          description: "All Celery workers are down"

      # High queue depth
      - alert: CeleryQueueBacklog
        expr: celery_queue_length > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Celery queue backlog"
          description: "Queue {{ $labels.queue }} has {{ $value }} pending tasks"

      # Critical queue backlog
      - alert: CeleryCriticalBacklog
        expr: celery_queue_length{queue="critical"} > 100
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Critical queue backlog"
          description: "Critical queue has {{ $value }} pending tasks"

      # High failure rate
      - alert: CeleryHighFailureRate
        expr: |
          100 * rate(celery_tasks_total{state="failure"}[5m]) /
          rate(celery_tasks_total[5m]) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High Celery task failure rate"
          description: "{{ $value }}% of tasks are failing"

      # Task taking too long
      - alert: CelerySlowTasks
        expr: |
          histogram_quantile(0.95,
            rate(celery_task_latency_seconds_bucket[5m])
          ) > 60
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow Celery tasks"
          description: "Task {{ $labels.task_name }} p95 latency is {{ $value }}s"
```

### Slack Alert Configuration

```yaml
# alertmanager.yml
receivers:
  - name: 'celery-alerts'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#celery-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        send_resolved: true

route:
  receiver: 'celery-alerts'
  group_by: ['alertname', 'queue']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: 'celery-alerts'
      repeat_interval: 15m
```

---

## Health Check Implementation

### FastAPI Health Endpoint

```python
# health.py
from fastapi import APIRouter, HTTPException
from celery import current_app
import redis

router = APIRouter()


@router.get("/health/celery")
async def celery_health():
    """Celery health check for Kubernetes probes."""
    try:
        # Check broker connectivity
        conn = current_app.connection()
        conn.ensure_connection(max_retries=3)

        # Check for active workers
        inspector = current_app.control.inspect()
        active = inspector.active()

        if not active:
            raise HTTPException(
                status_code=503,
                detail="No active Celery workers"
            )

        # Get queue depths
        redis_client = redis.from_url(current_app.conf.broker_url)
        queue_depths = {
            "critical": redis_client.llen("critical"),
            "high": redis_client.llen("high"),
            "default": redis_client.llen("default"),
            "low": redis_client.llen("low"),
        }

        return {
            "status": "healthy",
            "workers": len(active),
            "active_tasks": sum(len(tasks) for tasks in active.values()),
            "queue_depths": queue_depths,
        }

    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/ready/celery")
async def celery_ready():
    """Readiness probe - can accept tasks."""
    try:
        inspector = current_app.control.inspect()
        stats = inspector.stats()
        if stats:
            return {"status": "ready", "workers": len(stats)}
        raise HTTPException(status_code=503, detail="Workers not ready")
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
```

---

## Verification Checklist

### Flower

- [ ] Dashboard accessible with authentication
- [ ] All workers visible in Workers tab
- [ ] Task history populating
- [ ] Queue depth showing correctly
- [ ] Can inspect individual tasks

### Prometheus

- [ ] Scraping celery-exporter successfully
- [ ] All metrics showing in Prometheus UI
- [ ] No gaps in metric data
- [ ] Recording rules working (if configured)

### Grafana

- [ ] Dashboard imported and showing data
- [ ] All panels rendering correctly
- [ ] Thresholds configured appropriately
- [ ] Alerts configured and tested

### Alerting

- [ ] Test alert fires correctly
- [ ] Alert reaches Slack/PagerDuty
- [ ] Resolution notification received
- [ ] Runbook links included in alerts

---

**Last Updated**: 2026-01-18
**Celery Version**: 5.4+
**Flower Version**: 2.0+
**Prometheus Version**: 2.45+
