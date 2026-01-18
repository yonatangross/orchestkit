# Celery Production Deployment Checklist

Comprehensive checklist for deploying Celery to production with Redis broker.

## Pre-Deployment

### Broker Configuration

- [ ] **Redis version**: Redis 5.0+ for priority queue support
- [ ] **Redis persistence**: AOF enabled for durability (`appendonly yes`)
- [ ] **Redis memory**: `maxmemory-policy allkeys-lru` or `volatile-lru` set
- [ ] **Connection limits**: `maxclients` configured appropriately
- [ ] **TLS enabled**: Production Redis uses `rediss://` protocol

### Celery Configuration

- [ ] **Serializer set to JSON**: `task_serializer = "json"` (never pickle)
- [ ] **Accept content restricted**: `accept_content = ["json"]`
- [ ] **Task acknowledgment late**: `task_acks_late = True`
- [ ] **Reject on worker lost**: `task_reject_on_worker_lost = True`
- [ ] **Prefetch multiplier**: Set to 1 for priority queues
- [ ] **Time limits set**:
  - [ ] `task_soft_time_limit`: Warning before hard kill
  - [ ] `task_time_limit`: Hard limit to prevent stuck tasks
- [ ] **Result backend configured**: Separate Redis instance recommended
- [ ] **Result expiry set**: `result_expires = 86400` (24 hours typical)

### Queue Setup

- [ ] **Priority queues defined**: `x-max-priority` argument set
- [ ] **Queue routing configured**: `task_routes` maps tasks to queues
- [ ] **Default queue set**: `task_default_queue = "default"`
- [ ] **Dead letter queue**: Configure for failed tasks (optional)

### Task Design

- [ ] **Idempotent tasks**: All tasks can be safely retried
- [ ] **No blocking on results**: Tasks don't call `.get()` synchronously
- [ ] **Serializable arguments**: All args/kwargs are JSON-serializable
- [ ] **Reasonable payloads**: Task args < 1MB (use references for large data)
- [ ] **Error handling**: All tasks have explicit error handling
- [ ] **Retry configuration**: `autoretry_for`, `max_retries`, `retry_backoff` set

### Monitoring Setup

- [ ] **Flower deployed**: `celery -A app flower --basic_auth=user:pass`
- [ ] **Task events enabled**: `worker_send_task_events = True`
- [ ] **Metrics exported**: Prometheus exporter or custom signals
- [ ] **Health check task**: Periodic task to verify system health
- [ ] **Alerting configured**: Alerts for queue depth, failures, latency

---

## Deployment

### Worker Configuration

- [ ] **Concurrency appropriate**: Match CPU cores for CPU-bound, higher for I/O
- [ ] **Pool type correct**: `prefork` for CPU, `gevent/eventlet` for I/O
- [ ] **Queue assignment**: Workers assigned to specific queues
- [ ] **Autoscaling configured**: Kubernetes HPA or Celery autoscaler
- [ ] **Graceful shutdown**: `SIGTERM` handling with warm shutdown

### Worker Commands

```bash
# High priority workers (more workers, low prefetch)
celery -A app worker -Q critical,high -c 8 --prefetch-multiplier=1 \
    --hostname=high@%h --loglevel=INFO

# Default workers
celery -A app worker -Q default -c 4 --prefetch-multiplier=2 \
    --hostname=default@%h --loglevel=INFO

# Bulk workers (fewer workers, high prefetch)
celery -A app worker -Q low,bulk -c 2 --prefetch-multiplier=4 \
    --hostname=bulk@%h --loglevel=INFO

# Beat scheduler (single instance only!)
celery -A app beat --loglevel=INFO
```

### Kubernetes Deployment

- [ ] **Separate deployments**: One per queue type
- [ ] **Resource limits set**: CPU and memory limits defined
- [ ] **Liveness probe**: `/health` endpoint checking worker status
- [ ] **Readiness probe**: Queue connectivity check
- [ ] **PodDisruptionBudget**: Ensure minimum workers available
- [ ] **HPA configured**: Scale based on queue depth or CPU

### Beat Scheduler

- [ ] **Single instance only**: Beat should never run multiple instances
- [ ] **Database scheduler** (optional): For dynamic schedule management
- [ ] **Timezone configured**: `timezone = "UTC"` recommended
- [ ] **Schedule tested**: All periodic tasks have correct schedules

---

## Post-Deployment

### Verification

- [ ] **Workers registered**: Visible in Flower dashboard
- [ ] **Test task succeeds**: Submit test task and verify completion
- [ ] **Priority routing works**: High-priority task processed first
- [ ] **Retries work**: Failed task retries with backoff
- [ ] **Metrics flowing**: Grafana/Prometheus receiving data
- [ ] **Alerts fire**: Test alert triggers correctly

### Monitoring Dashboards

- [ ] **Queue depth panel**: All queues with thresholds
- [ ] **Task throughput**: Tasks/second by task name
- [ ] **Task latency**: p50, p95, p99 latency by task
- [ ] **Error rate**: Failures/minute with breakdown
- [ ] **Worker status**: Active workers and their load

### Runbook Items

- [ ] **Scale up procedure**: How to add workers
- [ ] **Scale down procedure**: Graceful worker removal
- [ ] **Queue drain procedure**: How to drain a queue
- [ ] **Restart procedure**: Rolling restart without task loss
- [ ] **Incident response**: Steps for common failure scenarios

---

## Security Checklist

### Broker Security

- [ ] **Authentication enabled**: Redis AUTH or ACL configured
- [ ] **TLS in transit**: `rediss://` with valid certificates
- [ ] **Network isolated**: Redis not exposed to internet
- [ ] **Firewall rules**: Only workers can access Redis

### Application Security

- [ ] **No pickle**: `accept_content = ["json"]` only
- [ ] **Secrets in env vars**: Not in task arguments
- [ ] **Input validation**: Tasks validate all inputs
- [ ] **Rate limiting**: Per-user rate limits configured

### Access Control

- [ ] **Flower protected**: Basic auth or OAuth enabled
- [ ] **Admin API secured**: Control commands require authentication
- [ ] **Logs sanitized**: Sensitive data not logged

---

## Scaling Guidelines

| Queue Type | Workers | Prefetch | Use Case |
|------------|---------|----------|----------|
| Critical | 4-8 | 1 | Payments, security |
| High | 2-4 | 2 | User-triggered actions |
| Default | 2-4 | 4 | General processing |
| Low | 1-2 | 4 | Analytics, logging |
| Bulk | 1-2 | 8 | Reports, batch jobs |

### Scaling Triggers

| Metric | Threshold | Action |
|--------|-----------|--------|
| Queue depth | > 1000 | Scale up workers |
| Task latency p95 | > 30s | Scale up or investigate |
| Worker CPU | > 80% | Scale up workers |
| Error rate | > 5% | Investigate and fix |
| Memory usage | > 85% | Scale up or optimize |

---

## Rollback Procedure

1. **Stop beat scheduler first** (prevents new periodic tasks)
2. **Wait for current tasks** to complete (check Flower)
3. **Deploy previous version** workers
4. **Verify workers register** in Flower
5. **Start beat scheduler** with previous version
6. **Monitor for errors** for 15 minutes

---

## Common Issues

### Workers Not Processing

1. Check Redis connectivity: `redis-cli PING`
2. Verify queue names match: `celery -A app inspect active_queues`
3. Check for stuck tasks: `celery -A app inspect reserved`
4. Restart workers: `celery -A app control shutdown`

### Tasks Stuck in Queue

1. Check worker count: `celery -A app inspect active`
2. Verify routing: Task queue matches worker queue
3. Check rate limits: May be throttling
4. Check for deadlocks: Task waiting on another task

### High Memory Usage

1. Check task payload sizes
2. Enable `worker_max_tasks_per_child` for memory leaks
3. Use `worker_max_memory_per_child` to auto-restart
4. Profile task memory usage

---

**Last Updated**: 2026-01-18
**Celery Version**: 5.4+
**Redis Version**: 5.0+
