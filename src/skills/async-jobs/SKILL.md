---
name: async-jobs
license: MIT
compatibility: "Claude Code 2.1.220+."
description: Async job processing patterns for background tasks, Celery workflows, task scheduling, retry strategies, and distributed task execution. Use when implementing background job processing, task queues, or scheduled task systems.
tags: [async, jobs, celery, background-tasks, scheduling, queues]
context: fork
agent: python-performance-engineer
version: 2.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
persuasion-type: reference
metadata:
  category: workflow-automation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Async Jobs

Background task processing with Celery, ARQ, Redis and Temporal. This skill is a wrapper, not a
manual: Celery and ARQ document their own product well, so what lives here is our delta, the
thresholds, working config, ordering constraints and tool-choice rules we picked. Product
mechanics are linked, not restated.

Start with `Read("${CLAUDE_SKILL_DIR}/references/ork-delta.md")`.

## Quick Reference

| Topic | Where our part lives |
|-------|----------------------|
| [Configuration](#configuration) | `references/celery-config.md`, `rules/jobs-task-queue.md` |
| [Task Routing](#task-routing) | `references/ork-delta.md` (queue taxonomy, prefetch tiers, Redis priority) |
| [Canvas Workflows](#canvas-workflows) | `rules/celery-canvas.md` |
| [Retry Strategies](#retry-strategies) | `references/ork-delta.md` (backoff cap, idempotency layers, lock TTLs) |
| [Scheduling](#scheduling) | `rules/jobs-scheduling.md`, `references/ork-delta.md` (beat process model) |
| [Monitoring](#monitoring) | `references/ork-delta.md` (alert thresholds, histogram buckets) |
| [Result Backends](#result-backends) | `rules/jobs-monitoring.md`, `references/ork-delta.md` (return contract) |
| [ARQ Patterns](#arq-patterns) | `rules/jobs-task-queue.md`, `references/ork-delta.md` (budgets, pool ownership) |
| [Temporal Workflows](#temporal-workflows) | `rules/temporal-workflows.md` |
| [Temporal Activities](#temporal-activities) | `rules/temporal-activities.md` |

10 topic areas, 6 rule files in `rules/`, house delta in `references/ork-delta.md`.

## Quick Start

```python
@app.task(bind=True, max_retries=3, default_retry_delay=60)
def process_payment(self, order_id: str):
    try:
        return gateway.charge(order_id)
    except TransientError as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 60)
```

Load more examples: `Read("${CLAUDE_SKILL_DIR}/references/quick-start-examples.md")` for Celery
retry task and ARQ/FastAPI integration patterns.

## Upstream coverage (do not restate)

Fetch these when you need product mechanics. The right-hand column is the part we keep, because
it is a house threshold, a working config or an ordering constraint that upstream cannot know.

| Topic | First-party source | House subset stays in |
|-------|--------------------|-----------------------|
| Celery settings, serializers, time limits, worker flags | https://docs.celeryq.dev/en/stable/userguide/configuration.html and .../optimizing.html | `references/celery-config.md`, `rules/jobs-task-queue.md` |
| Queue declarations, router classes, Redis priority mechanics | https://docs.celeryq.dev/en/stable/userguide/routing.html | `references/ork-delta.md` |
| chain / group / chord / signature semantics | https://docs.celeryq.dev/en/stable/userguide/canvas.html | `rules/celery-canvas.md` keeps the house canvas subset. Its `si()`-in-chords guidance is UNVERIFIED and contested: confirm the argument-passing behaviour against the upstream canvas page before relying on it |
| `autoretry_for`, `retry_backoff`, `Reject`, task base classes | https://docs.celeryq.dev/en/stable/userguide/tasks.html | `references/ork-delta.md`, `rules/jobs-task-queue.md` |
| Beat schedules, crontab syntax, DatabaseScheduler | https://docs.celeryq.dev/en/stable/userguide/periodic-tasks.html and https://django-celery-beat.readthedocs.io/en/latest/ | `rules/jobs-scheduling.md` keeps our `beat_schedule` shapes; `references/ork-delta.md` keeps the process model |
| Flower flags, `inspect`, signal names | https://docs.celeryq.dev/en/stable/userguide/monitoring.html, https://docs.celeryq.dev/en/stable/userguide/signals.html, https://flower.readthedocs.io/en/latest/config.html | `references/ork-delta.md` |
| Result backend, `AsyncResult`, custom states | https://docs.celeryq.dev/en/stable/userguide/configuration.html | `rules/jobs-monitoring.md` keeps our status endpoints and `update_state()` usage |
| Per-task `rate_limit`, `control.rate_limit`, Redis Lua | https://docs.celeryq.dev/en/stable/userguide/workers.html, https://redis.io/docs/latest/develop/programmability/eval-intro/ | `references/ork-delta.md` |
| ARQ `WorkerSettings`, `enqueue_job`, `_defer_by` / `_defer_until`, `Job` status | https://arq-docs.helpmanual.io/ | `rules/jobs-task-queue.md` keeps the worker skeleton; `references/ork-delta.md` keeps the budgets |
| FastAPI lifespan and dependency wiring | https://fastapi.tiangolo.com/advanced/events/ | `references/ork-delta.md` |
| Distributed locks with `SET NX EX` | https://redis.io/docs/latest/commands/set/ | `references/ork-delta.md` |

## Configuration

Load: `Read("${CLAUDE_SKILL_DIR}/references/celery-config.md")`.

| Decision | Recommendation |
|----------|----------------|
| Serializer | JSON (never pickle) |
| Ack mode | Late ack (`task_acks_late=True`) |
| Prefetch | 1 for fair, 4-8 for throughput |
| Time limit | soft < hard (540 / 600) |
| Timezone | UTC always |

## Task Routing

| Decision | Recommendation |
|----------|----------------|
| Queue count | 5: critical / high / default / low / bulk |
| Priority levels | 0-9, with all four Redis priority switches set together |
| Worker assignment | Dedicated worker per queue |
| Prefetch | 1 critical, 2 high, 4 default, 8 low/bulk |
| Routing | Router class once past 5 routing rules |

## Canvas Workflows

Load: `Read("${CLAUDE_SKILL_DIR}/rules/celery-canvas.md")`.

| Decision | Recommendation |
|----------|----------------|
| Sequential | Chain with `s()` |
| Parallel | Group for independent tasks |
| Fan-in | Chord (all header tasks must succeed for the body to run) |
| Ignore input | Use `si()` immutable signature |
| Error in chain | `Reject` stops the chain, `retry` continues it |
| Partial failures | Return an error dict from chord header tasks |

## Retry Strategies

| Decision | Recommendation |
|----------|----------------|
| Retry delay | Exponential backoff, jitter on, capped at 600s |
| Max retries | 3-5 for transient, 0 for permanent |
| Idempotency | Redis marker (86400s TTL) plus the vendor idempotency key |
| Failed tasks | DLQ for manual review |
| Singleton | Redis lock with a TTL longer than the hard time limit |

## Scheduling

Load: `Read("${CLAUDE_SKILL_DIR}/rules/jobs-scheduling.md")`.

| Decision | Recommendation |
|----------|----------------|
| Schedule type | Crontab for time-based, float interval for frequency |
| Dynamic | DatabaseScheduler (`django-celery-beat`) |
| Overlap | Redis lock, 3600s default and 7200s for long jobs |
| Beat process | Separate process; embedded `--beat` is development only |
| Timezone | UTC always |

## Monitoring

| Decision | Recommendation |
|----------|----------------|
| Dashboard | Flower with persistent storage |
| Metrics | Prometheus wired to `task_prerun` / `task_postrun` / `task_failure` |
| Health | Broker reachable, at least one worker, queue depths |
| Alerting | critical > 100, default > 5000, workers < 1 |
| Autoscale | Queue depth > 500 |

## Result Backends

Load: `Read("${CLAUDE_SKILL_DIR}/rules/jobs-monitoring.md")`.

| Decision | Recommendation |
|----------|----------------|
| Status storage | Redis result backend, status and small JSON only |
| Large results | S3 or database, task returns a reference dict |
| Progress | Custom states with `update_state()` |
| Result query | `AsyncResult` with state checks |

## ARQ Patterns

Load: `Read("${CLAUDE_SKILL_DIR}/rules/jobs-task-queue.md")`.

| Decision | Recommendation |
|----------|----------------|
| Simple async | ARQ (native async), `max_jobs=10`, `job_timeout=300` |
| Pool ownership | FastAPI lifespan, never a per-request `create_pool` |
| Complex workflows | Celery (chains, chords, DLQ, per-task rate limits) |
| In-process quick | FastAPI BackgroundTasks, under 30s, non-critical only |
| LLM workflows | LangGraph, not Celery |

## Tool Selection

Load: `Read("${CLAUDE_SKILL_DIR}/references/quick-start-examples.md")` for the full tool
comparison table (ARQ, Celery, RQ, Dramatiq, FastAPI BackgroundTasks).

## Anti-Patterns (FORBIDDEN)

Load details: `Read("${CLAUDE_SKILL_DIR}/references/anti-patterns.md")` for the full list.

Key rules: never run long tasks in request handlers, never block on results inside tasks, never
store large results in Redis, always use idempotency for retried tasks.

## Temporal Workflows

Load: `Read("${CLAUDE_SKILL_DIR}/rules/temporal-workflows.md")`.

| Decision | Recommendation |
|----------|----------------|
| Workflow ID | Business-meaningful, idempotent |
| Determinism | Use `workflow.random()`, `workflow.now()` |
| I/O | Always via activities, never directly |

## Temporal Activities

Load: `Read("${CLAUDE_SKILL_DIR}/rules/temporal-activities.md")`.

| Decision | Recommendation |
|----------|----------------|
| Activity timeout | `start_to_close` for most cases |
| Error handling | Non-retryable for business errors |
| Testing | `WorkflowEnvironment.start_local()` for integration tests |

## Related Skills

- `ork:python-backend` - FastAPI, asyncio, SQLAlchemy patterns
- `ork:langgraph` - LangGraph workflow patterns (use for LLM workflows, not Celery)
- `ork:distributed-systems` - Resilience patterns, circuit breakers
- `ork:monitoring-observability` - Metrics and alerting

## Capability Details

Load details: `Read("${CLAUDE_SKILL_DIR}/references/capability-details.md")` for the keyword index
and problem-to-capability mapping.
