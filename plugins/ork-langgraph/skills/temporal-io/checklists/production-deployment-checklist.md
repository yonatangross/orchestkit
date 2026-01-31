# Temporal Production Deployment Checklist

Comprehensive checklist for deploying Temporal clusters and workers to production.

## Infrastructure Prerequisites

### Temporal Cluster

- [ ] **Temporal version**: Using supported version (1.20+ recommended)
- [ ] **Deployment method**: Kubernetes Helm, Docker Compose, or Temporal Cloud
- [ ] **High availability**: Multiple frontend, history, matching, and worker services
- [ ] **Load balancer**: For frontend service access

### Dependencies

- [ ] **Database**: PostgreSQL 13+ or MySQL 8+ (production) or Cassandra
- [ ] **Elasticsearch**: 7.x or 8.x for visibility (recommended)
- [ ] **Object storage**: S3/GCS for archival (optional)

### Networking

- [ ] **TLS enabled**: All internal and external communication
- [ ] **mTLS configured**: Client certificate authentication
- [ ] **Network policies**: Restrict traffic between components
- [ ] **DNS configured**: Stable hostnames for services

## Cluster Configuration

### Database Setup

```yaml
# Example: PostgreSQL configuration
persistence:
  default:
    driver: "sql"
    sql:
      driverName: "postgres"
      host: "postgres.example.com"
      port: 5432
      database: "temporal"
      user: "temporal"
      password: "${DB_PASSWORD}"
      maxConns: 20
      maxIdleConns: 20
      maxConnLifetime: "1h"

visibility:
  driver: "elasticsearch"
  elasticsearch:
    url:
      scheme: "https"
      host: "elasticsearch.example.com:9200"
    username: "${ES_USERNAME}"
    password: "${ES_PASSWORD}"
    indices:
      visibility: "temporal_visibility_v1"
```

- [ ] **Connection pooling**: Appropriate pool sizes
- [ ] **Connection timeouts**: Reasonable values
- [ ] **Read replicas**: For visibility queries (if using SQL)
- [ ] **Backup strategy**: Regular automated backups

### Namespace Configuration

```bash
# Create production namespace
temporal operator namespace create \
  --namespace production \
  --retention 30d \
  --description "Production workflows"
```

- [ ] **Namespaces created**: Separate for prod, staging, dev
- [ ] **Retention period**: Based on compliance requirements (7-90 days)
- [ ] **Global namespace**: If multi-region (advanced)

### Resource Limits

```yaml
# Kubernetes resource limits
resources:
  frontend:
    requests:
      cpu: "500m"
      memory: "512Mi"
    limits:
      cpu: "2"
      memory: "2Gi"

  history:
    requests:
      cpu: "1"
      memory: "1Gi"
    limits:
      cpu: "4"
      memory: "4Gi"

  matching:
    requests:
      cpu: "500m"
      memory: "512Mi"
    limits:
      cpu: "2"
      memory: "2Gi"
```

- [ ] **CPU limits**: Based on expected load
- [ ] **Memory limits**: History service needs more
- [ ] **HPA configured**: Auto-scaling for frontend/matching
- [ ] **PDB configured**: Pod disruption budgets

## Worker Deployment

### Worker Configuration

```python
# Production worker settings
worker = Worker(
    client,
    task_queue="production-queue",
    workflows=[OrderWorkflow, PaymentWorkflow],
    activities=[...],

    # Concurrency tuning
    max_concurrent_activities=100,
    max_concurrent_workflow_task_polls=100,
    max_concurrent_local_activities=100,

    # Graceful shutdown
    graceful_shutdown_timeout=timedelta(seconds=30),

    # Sticky execution (performance)
    max_cached_workflows=1000,
)
```

- [ ] **Concurrency limits**: Based on load testing
- [ ] **Multiple replicas**: At least 2 for HA
- [ ] **Sticky cache sized**: Memory-appropriate
- [ ] **Graceful shutdown**: Configured and tested

### Health Checks

```yaml
# Kubernetes health checks
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
```

- [ ] **Liveness probe**: Worker process alive
- [ ] **Readiness probe**: Connected to Temporal
- [ ] **Startup probe**: For slow-starting workers

### Task Queue Strategy

| Queue | Purpose | Workers |
|-------|---------|---------|
| `critical-queue` | Payment, core ops | Dedicated, high priority |
| `standard-queue` | Regular workflows | Shared workers |
| `batch-queue` | Background jobs | Separate, auto-scaled |

- [ ] **Queue isolation**: Separate queues for different SLAs
- [ ] **Worker assignment**: Right workers for right queues
- [ ] **Pollers configured**: Appropriate number per worker

## Security Configuration

### TLS Setup

```python
# Client TLS configuration
tls_config = TLSConfig(
    # Server CA certificate
    server_root_ca_cert=ca_cert,
    # Client certificate for mTLS
    client_cert=client_cert,
    client_private_key=client_key,
)

client = await Client.connect(
    "temporal.example.com:7233",
    tls=tls_config,
)
```

- [ ] **TLS certificates**: Valid and not expiring soon
- [ ] **Certificate rotation**: Automated renewal
- [ ] **mTLS enforced**: Client authentication required
- [ ] **Minimum TLS version**: 1.2 or higher

### Authentication & Authorization

- [ ] **Client auth**: mTLS or API keys
- [ ] **Namespace access**: RBAC configured
- [ ] **Admin access**: Limited to operators
- [ ] **Audit logging**: All admin operations logged

### Secrets Management

- [ ] **No hardcoded secrets**: Use env vars or secret stores
- [ ] **Secret rotation**: Automated where possible
- [ ] **Database credentials**: In secure vault
- [ ] **API keys**: Properly scoped and rotated

## Monitoring Setup

### Metrics (Prometheus)

```yaml
# Essential Temporal metrics to monitor
- temporal_workflow_started_total
- temporal_workflow_completed_total
- temporal_workflow_failed_total
- temporal_activity_execution_latency
- temporal_workflow_task_schedule_to_start_latency
- temporal_task_queue_poll_empty_total
- persistence_latency
- visibility_persistence_latency
```

- [ ] **Prometheus configured**: Scraping all components
- [ ] **Key metrics identified**: Workflows, activities, persistence
- [ ] **Histogram buckets**: Appropriate for latency tracking
- [ ] **Retention period**: Long enough for trending

### Dashboards

- [ ] **Cluster overview**: Health of all components
- [ ] **Workflow metrics**: Started, completed, failed by type
- [ ] **Activity metrics**: Duration, failures, retries
- [ ] **Queue depth**: Pending tasks per queue
- [ ] **Latency**: Schedule-to-start, execution times

### Alerting Rules

```yaml
# Example Prometheus alerts
groups:
  - name: temporal
    rules:
      - alert: TemporalFrontendDown
        expr: up{job="temporal-frontend"} == 0
        for: 1m
        labels:
          severity: critical

      - alert: HighWorkflowFailureRate
        expr: |
          rate(temporal_workflow_failed_total[5m])
          / rate(temporal_workflow_completed_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning

      - alert: LongScheduleToStartLatency
        expr: |
          histogram_quantile(0.99,
            rate(temporal_workflow_task_schedule_to_start_latency_bucket[5m])
          ) > 30
        for: 5m
        labels:
          severity: warning
```

- [ ] **Service down alerts**: All components
- [ ] **High failure rate**: By workflow type
- [ ] **Latency alerts**: Schedule-to-start > threshold
- [ ] **Queue buildup**: Tasks pending too long
- [ ] **Resource alerts**: CPU, memory, disk

### Logging

```python
# Structured logging for workers
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)
```

- [ ] **Structured logs**: JSON format
- [ ] **Correlation IDs**: Workflow ID, run ID
- [ ] **Log aggregation**: Centralized logging
- [ ] **Log retention**: Based on compliance

## Disaster Recovery

### Backup Strategy

- [ ] **Database backups**: Regular, tested restores
- [ ] **Configuration backups**: Namespace configs, schemas
- [ ] **Cross-region replication**: For critical deployments
- [ ] **Backup verification**: Regular restore tests

### Recovery Procedures

- [ ] **Runbook created**: Step-by-step recovery
- [ ] **RTO defined**: Recovery time objective
- [ ] **RPO defined**: Recovery point objective
- [ ] **Tested quarterly**: DR drills performed

### Failover

- [ ] **Multi-AZ deployment**: For cloud deployments
- [ ] **Database failover**: Automated promotion
- [ ] **DNS failover**: For client connectivity
- [ ] **Tested regularly**: Failover drills

## Performance Tuning

### Cluster Tuning

```yaml
# History service tuning
numHistoryShards: 512  # Power of 2, based on load

# Matching service tuning
matching:
  numTaskqueueReadPartitions: 4
  numTaskqueueWritePartitions: 4
```

- [ ] **History shards**: Sized for expected load (512-2048)
- [ ] **Task queue partitions**: Based on throughput needs
- [ ] **Cache settings**: Tuned for memory
- [ ] **Connection pools**: Sized appropriately

### Worker Tuning

- [ ] **Poller count**: Based on task queue load
- [ ] **Concurrency limits**: Tested under load
- [ ] **Sticky cache**: Memory vs. performance tradeoff
- [ ] **Activity timeouts**: Based on actual performance

### Load Testing

```bash
# Example: Temporal bench tool
temporal-bench \
  --server temporal.example.com:7233 \
  --namespace load-test \
  --workflow-count 10000 \
  --concurrent-count 100 \
  --scenario order-processing
```

- [ ] **Baseline established**: Normal load metrics
- [ ] **Peak load tested**: 2-3x normal
- [ ] **Failure tested**: Behavior under stress
- [ ] **Recovery tested**: After overload

## Pre-Go-Live

### Verification

- [ ] **Smoke tests passed**: Basic workflow execution
- [ ] **Integration tests passed**: End-to-end flows
- [ ] **Performance validated**: Meets SLAs
- [ ] **Security audit**: Passed review

### Documentation

- [ ] **Architecture documented**: Diagrams and descriptions
- [ ] **Runbooks created**: Operational procedures
- [ ] **Troubleshooting guide**: Common issues and fixes
- [ ] **On-call rotation**: Defined and staffed

### Rollback Plan

- [ ] **Rollback procedure**: Documented steps
- [ ] **Rollback tested**: Verified works
- [ ] **Rollback criteria**: When to trigger
- [ ] **Communication plan**: Stakeholder notification

## Post-Deployment

### First Week Monitoring

- [ ] **24/7 monitoring**: Close observation
- [ ] **Daily review**: Metrics and logs
- [ ] **Issue tracking**: Document any problems
- [ ] **Tuning adjustments**: Based on observations

### Ongoing Operations

- [ ] **Weekly metrics review**: Trends and anomalies
- [ ] **Monthly capacity planning**: Growth projections
- [ ] **Quarterly DR drill**: Test recovery
- [ ] **Upgrade planning**: Track new versions
