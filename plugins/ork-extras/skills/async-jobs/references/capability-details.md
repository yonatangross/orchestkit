# Capability Details

### celery-config
**Keywords:** celery, configuration, broker, worker, setup
**Solves:**
- Production Celery app configuration
- Broker and backend setup
- Worker tuning and time limits

### task-routing
**Keywords:** priority, queue, routing, high priority, worker
**Solves:**
- Premium user task prioritization
- Multi-queue worker deployment
- Dynamic task routing

### canvas-workflows
**Keywords:** chain, group, chord, signature, canvas, workflow, pipeline
**Solves:**
- Complex multi-step task pipelines
- Parallel task execution with aggregation
- Sequential task dependencies

### retry-strategies
**Keywords:** retry, backoff, idempotency, dead letter, resilience
**Solves:**
- Exponential backoff with jitter
- Duplicate prevention for retried tasks
- Failed task handling with DLQ

### scheduled-tasks
**Keywords:** periodic, scheduled, cron, celery beat, interval
**Solves:**
- Run tasks on schedule (crontab)
- Dynamic schedule management
- Overlap prevention for long tasks

### monitoring-health
**Keywords:** flower, monitoring, health check, metrics, alerting
**Solves:**
- Production task monitoring dashboard
- Worker health checks
- Queue depth autoscaling

### result-backends
**Keywords:** result, state, progress, AsyncResult, status
**Solves:**
- Task progress tracking with custom states
- Result storage strategies
- Job status API endpoints

### arq-patterns
**Keywords:** arq, async queue, redis queue, fastapi background
**Solves:**
- Lightweight async background tasks for FastAPI
- Simple Redis job queue with async/await
- Job status tracking
