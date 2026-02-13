---
name: async-jobs
license: MIT
compatibility: "Claude Code 2.1.34+."
description: Async job processing patterns for background tasks, Celery workflows, task scheduling, retry strategies, and distributed task execution. Use when implementing background job processing, task queues, or scheduled task systems.
tags: [async, jobs, celery, background-tasks, scheduling, queues]
context: fork
agent: python-performance-engineer
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: medium
metadata:
  category: workflow-automation
---

# Async Jobs

Patterns for background task processing with Celery, ARQ, and Redis. Covers task queues, canvas workflows, scheduling, retry strategies, rate limiting, and production monitoring. Each category has individual rule files in `references/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Configuration](#configuration) | celery-config | HIGH | Celery app setup, broker, serialization, worker tuning |
| [Task Routing](#task-routing) | task-routing | HIGH | Priority queues, multi-queue workers, dynamic routing |
| [Canvas Workflows](#canvas-workflows) | canvas-workflows | HIGH | Chain, group, chord, nested workflows |
| [Retry Strategies](#retry-strategies) | retry-strategies | HIGH | Exponential backoff, idempotency, dead letter queues |
| [Scheduling](#scheduling) | scheduled-tasks | MEDIUM | Celery Beat, crontab, database-backed schedules |
| [Monitoring](#monitoring) | monitoring-health | MEDIUM | Flower, custom events, health checks, metrics |
| [Result Backends](#result-backends) | result-backends | MEDIUM | Redis results, custom states, progress tracking |
| [ARQ Patterns](#arq-patterns) | arq-patterns | MEDIUM | Async Redis Queue for FastAPI, lightweight jobs |
| [Temporal Workflows](#temporal-workflows) | temporal-workflows | HIGH | Durable workflow definitions, sagas, signals, queries |
| [Temporal Activities](#temporal-activities) | temporal-activities | HIGH | Activity patterns, workers, heartbeats, testing |

**Total: 10 rules across 9 categories**

## Quick Start

```python
# Celery task with retry
from celery import shared_task

@shared_task(
    bind=True,
    max_retries=3,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
)
def process_order(self, order_id: str) -> dict:
    result = do_processing(order_id)
    return {"order_id": order_id, "status": "completed"}
```

```python
# ARQ task with FastAPI
from arq import create_pool
from arq.connections import RedisSettings

async def generate_report(ctx: dict, report_id: str) -> dict:
    data = await ctx["db"].fetch_report_data(report_id)
    pdf = await render_pdf(data)
    return {"report_id": report_id, "size": len(pdf)}

@router.post("/api/v1/reports")
async def create_report(data: ReportRequest, arq: ArqRedis = Depends(get_arq_pool)):
    job = await arq.enqueue_job("generate_report", data.report_id)
    return {"job_id": job.job_id}
```

## Configuration

Production Celery app configuration with secure defaults and worker tuning.

### Key Patterns

- **JSON serialization** with `task_serializer="json"` for safety
- **Late acknowledgment** with `task_acks_late=True` to prevent task loss on crash
- **Time limits** with both `task_time_limit` (hard) and `task_soft_time_limit` (soft)
- **Fair distribution** with `worker_prefetch_multiplier=1`
- **Reject on lost** with `task_reject_on_worker_lost=True`

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Serializer | JSON (never pickle) |
| Ack mode | Late ack (`task_acks_late=True`) |
| Prefetch | 1 for fair, 4-8 for throughput |
| Time limit | soft < hard (e.g., 540/600) |
| Timezone | UTC always |

## Task Routing

Priority queue configuration with multi-queue workers and dynamic routing.

### Key Patterns

- **Named queues** for critical/high/default/low/bulk separation
- **Redis priority** with `queue_order_strategy: "priority"` and 0-9 levels
- **Task router classes** for dynamic routing based on task attributes
- **Per-queue workers** with tuned concurrency and prefetch settings
- **Content-based routing** for dynamic workflow dispatch

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Queue count | 3-5 (critical/high/default/low/bulk) |
| Priority levels | 0-9 with Redis `x-max-priority` |
| Worker assignment | Dedicated workers per queue |
| Prefetch | 1 for critical, 4-8 for bulk |
| Routing | Router class for 5+ routing rules |

## Canvas Workflows

Celery canvas primitives for sequential, parallel, and fan-in/fan-out workflows.

### Key Patterns

- **Chain** for sequential ETL pipelines with result passing
- **Group** for parallel execution of independent tasks
- **Chord** for fan-out/fan-in with aggregation callback
- **Immutable signatures** (`si()`) for steps that ignore input
- **Nested workflows** combining groups inside chains
- **Link error** callbacks for workflow-level error handling

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Sequential | Chain with `s()` |
| Parallel | Group for independent tasks |
| Fan-in | Chord (all must succeed for callback) |
| Ignore input | Use `si()` immutable signature |
| Error in chain | Reject stops chain, retry continues |
| Partial failures | Return error dict in chord tasks |

## Retry Strategies

Retry patterns with exponential backoff, idempotency, and dead letter queues.

### Key Patterns

- **Exponential backoff** with `retry_backoff=True` and `retry_backoff_max`
- **Jitter** with `retry_jitter=True` to prevent thundering herd
- **Idempotency keys** in Redis to prevent duplicate processing
- **Dead letter queues** for failed tasks requiring manual review
- **Task locking** to prevent concurrent execution of singleton tasks
- **Base task classes** with shared retry configuration

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Retry delay | Exponential backoff with jitter |
| Max retries | 3-5 for transient, 0 for permanent |
| Idempotency | Redis key with TTL |
| Failed tasks | DLQ for manual review |
| Singleton | Redis lock with TTL |

## Scheduling

Celery Beat periodic task configuration with crontab, database-backed schedules, and overlap prevention.

### Key Patterns

- **Crontab** for time-based schedules (daily, weekly, monthly)
- **Interval** for fixed-frequency tasks (every N seconds)
- **Database scheduler** with `django-celery-beat` for dynamic schedules
- **Schedule locks** to prevent overlapping long-running scheduled tasks
- **Adaptive polling** with self-rescheduling tasks

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Schedule type | Crontab for time-based, interval for frequency |
| Dynamic | Database scheduler (`django-celery-beat`) |
| Overlap | Redis lock with timeout |
| Beat process | Separate process (not embedded) |
| Timezone | UTC always |

## Monitoring

Production monitoring with Flower, custom signals, health checks, and Prometheus metrics.

### Key Patterns

- **Flower** dashboard for real-time task monitoring
- **Celery signals** (`task_prerun`, `task_postrun`, `task_failure`) for metrics
- **Health check** endpoint verifying broker connection and active workers
- **Queue depth** monitoring for autoscaling decisions
- **Beat monitoring** for scheduled task dispatch tracking

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Dashboard | Flower with persistent storage |
| Metrics | Prometheus via celery signals |
| Health | Broker + worker + queue depth |
| Alerting | Signal on task_failure |
| Autoscale | Queue depth > threshold |

## Result Backends

Task result storage, custom states, and progress tracking patterns.

### Key Patterns

- **Redis backend** for task status and small results
- **Custom task states** (VALIDATING, PROCESSING, UPLOADING) for progress
- **`update_state()`** for real-time progress reporting
- **S3/database** for large result storage (never Redis)
- **AsyncResult** for querying task state and progress

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Status storage | Redis result backend |
| Large results | S3 or database (never Redis) |
| Progress | Custom states with `update_state()` |
| Result query | AsyncResult with state checks |

## ARQ Patterns

Lightweight async Redis Queue for FastAPI and simple background tasks.

### Key Patterns

- **Native async/await** with `arq` for FastAPI integration
- **Worker lifecycle** with `startup`/`shutdown` hooks for resource management
- **Job enqueue** from FastAPI routes with `enqueue_job()`
- **Job status** tracking with `Job.status()` and `Job.result()`
- **Delayed tasks** with `_delay=timedelta()` for deferred execution

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Simple async | ARQ (native async) |
| Complex workflows | Celery (chains, chords) |
| In-process quick | FastAPI BackgroundTasks |
| LLM workflows | LangGraph (not Celery) |

## Tool Selection

| Tool | Best For | Complexity |
|------|----------|------------|
| ARQ | FastAPI, simple async jobs | Low |
| Celery | Complex workflows, enterprise | High |
| RQ | Simple Redis queues | Low |
| Dramatiq | Reliable messaging | Medium |
| FastAPI BackgroundTasks | In-process quick tasks | Minimal |

## Anti-Patterns (FORBIDDEN)

```python
# NEVER run long tasks synchronously in request handlers
@router.post("/api/v1/reports")
async def create_report(data: ReportRequest):
    pdf = await generate_pdf(data)  # Blocks for minutes!

# NEVER block on results inside tasks (causes deadlock)
@celery_app.task
def bad_task():
    result = other_task.delay()
    return result.get()  # Blocks worker!

# NEVER store large results in Redis
@shared_task
def process_file(file_id: str) -> bytes:
    return large_file_bytes  # Store in S3/DB instead!

# NEVER skip idempotency for retried tasks
@celery_app.task(max_retries=3)
def create_order(order):
    Order.create(order)  # Creates duplicates on retry!

# NEVER use BackgroundTasks for distributed work
background_tasks.add_task(long_running_job)  # Lost if server restarts

# NEVER ignore task acknowledgment settings
celery_app.conf.task_acks_late = False  # Default loses tasks on crash

# ALWAYS use immutable signatures in chords
chord([task.s(x) for x in items], callback.si())  # si() prevents arg pollution
```

## Temporal Workflows

Durable execution engine for reliable distributed applications with Temporal.io.

### Key Patterns

- **Workflow definitions** with `@workflow.defn` and deterministic code
- **Saga pattern** with compensation for multi-step transactions
- **Signals and queries** for external interaction with running workflows
- **Timers** with `workflow.wait_condition()` for human-in-the-loop
- **Parallel activities** via `asyncio.gather` inside workflows

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Workflow ID | Business-meaningful, idempotent |
| Determinism | Use `workflow.random()`, `workflow.now()` |
| I/O | Always via activities, never directly |

## Temporal Activities

Activity and worker patterns for Temporal.io I/O operations.

### Key Patterns

- **Activity definitions** with `@activity.defn` for all I/O
- **Heartbeating** for long-running activities (> 60s)
- **Error classification** with `ApplicationError(non_retryable=True)` for business errors
- **Worker configuration** with dedicated task queues
- **Testing** with `WorkflowEnvironment.start_local()`

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Activity timeout | `start_to_close` for most cases |
| Error handling | Non-retryable for business errors |
| Testing | WorkflowEnvironment for integration tests |

## Related Skills

- `python-backend` - FastAPI, asyncio, SQLAlchemy patterns
- `langgraph` - LangGraph workflow patterns (use for LLM workflows, not Celery)
- `distributed-systems` - Resilience patterns, circuit breakers
- `monitoring-observability` - Metrics and alerting

## Capability Details

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
