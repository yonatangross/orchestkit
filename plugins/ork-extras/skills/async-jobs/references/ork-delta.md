# Async Jobs: our delta

House thresholds, working config and ordering constraints for background jobs in OrchestKit projects. Everything here is the part vendor docs cannot supply: the numbers we picked and the order we do things in. Product mechanics live upstream, linked per entry. Neighbouring skills: `ork:python-backend` (FastAPI, asyncio, SQLAlchemy runtime), `ork:distributed-systems` (circuit breakers around the queue), `ork:monitoring-observability` (the alerting layer these thresholds feed), `ork:langgraph` (LLM workflows, which never belong in Celery).

Provenance: the retired reference files carried no issue, PR or commit reference, so no entry below claims one. Each names the retired file it was distilled from.

## Run exactly five named queues: critical, high, default, low, bulk
Why: house queue taxonomy. Three queues under-separate payment work from reporting; past five nobody can keep the worker fleet straight. `task_default_queue` stays `default` and `task_default_priority` stays 5, so an unrouted task lands mid-pack instead of starving. Distilled from the retired task-routing.md; no traced incident.
Upstream: https://docs.celeryq.dev/en/stable/userguide/routing.html

## Set prefetch per queue tier, never globally
Why: house numeric budget, one worker process per queue: `--prefetch-multiplier=1` on critical, 2 on high, 4 on default, 8 on low and bulk. A single global prefetch either starves the latency-sensitive queues or wastes round trips on bulk. Distilled from the retired task-routing.md; no traced incident.
Upstream: https://docs.celeryq.dev/en/stable/userguide/optimizing.html

## Turn on Redis priority explicitly before using priority=
Why: ordering constraint. On a Redis broker `priority=` is silently ignored unless `broker_transport_options` sets `priority_steps: list(range(10))`, `sep: ":"` and `queue_order_strategy: "priority"`, with `x-max-priority: 10` in `queue_arguments`. House default is all four together, configured before the first `apply_async`; setting one of them is the failure mode that looks like priority working. Distilled from the retired task-routing.md; no traced incident.
Upstream: https://docs.celeryq.dev/en/stable/userguide/routing.html

## Alert and autoscale on queue depth with tier-specific thresholds
Why: house numbers. Autoscale trigger at depth > 500, generic queue alert at depth > 1000, then tier overrides: critical queue > 100 is a critical alert because that queue should never back up, default queue > 5000 is a warning, and fewer than 1 active worker is a critical alert. Distilled from the retired task-routing.md and monitoring-health.md; no traced incident.
Upstream: https://docs.celeryq.dev/en/stable/userguide/monitoring.html

## Wire metrics off task signals with our latency buckets
Why: house observability budget. Metrics hang off `task_prerun`, `task_postrun`, `task_failure` and `task_retry`, with a duration histogram bucketed at `[0.1, 0.5, 1, 5, 10, 30, 60, 300, 600]` so the top bucket lines up with our 600s hard time limit, and a queue-depth gauge refreshed every 30s by a beat task. Ordering constraint: `task_prerun` stores the start time and `task_postrun` reads it, so registering one without the other yields a histogram that never observes. Distilled from the retired monitoring-health.md; no traced incident.
Upstream: https://docs.celeryq.dev/en/stable/userguide/signals.html

## Cap retry backoff at 600s and always jitter
Why: house retry budget. `retry_backoff=True`, `retry_backoff_max=600`, `retry_jitter=True`, with `max_retries` 3 to 5 for transient failures and 0 for anything a retry cannot fix. Uncapped exponential backoff pushes the last attempt hours out, and unjittered backoff reconverges the whole fleet on the recovering dependency. Distilled from the retired retry-strategies.md; no traced incident.
Upstream: https://docs.celeryq.dev/en/stable/userguide/tasks.html

## Make a retried task idempotent at two layers
Why: house rule for money-moving and record-creating tasks. Layer one is a Redis marker keyed `processed:<domain>:<id>` with an 86400s TTL, checked before the side effect; layer two is the vendor's own idempotency key on the outbound call. Layer one alone loses the race between a worker crash and the marker write, so both are required, in that order. Distilled from the retired retry-strategies.md; no traced incident.
Upstream: https://docs.celeryq.dev/en/stable/userguide/tasks.html

## Give every lock a TTL longer than the task hard time limit
Why: ordering constraint. Singleton task locks use `SET key 1 NX EX 300`; scheduled-task locks use 3600 by default and 7200 for known-long jobs. The TTL must exceed `task_time_limit` (600 in our house config) or the lock expires while the first run is still executing and a second run starts on top of it. Always release in a `finally`. Distilled from the retired retry-strategies.md and scheduled-tasks.md; no traced incident.
Upstream: https://redis.io/docs/latest/commands/set/

## Return a reference from a task, never a payload
Why: house decision, and the reason the result backend stays small. Working `result_expires` and `global_keyprefix` values live in `references/celery-config.md` and the prohibition lives in `references/anti-patterns.md`; what this entry adds is the contract: bytes go to S3 or the database and the task returns a reference dict (key, size, generated_at), so a task result always fits a Redis value. Distilled from the retired result-backends.md; no traced incident.
Upstream: https://docs.celeryq.dev/en/stable/userguide/configuration.html

## Own the ARQ pool in the FastAPI lifespan, never in a per-request dependency
Why: ordering constraint. A dependency shaped `async def get_arq_pool(): return await create_pool(...)` opens a fresh Redis pool on every request and never closes it. Create the pool once in the lifespan handler, stash it on `app.state`, and have the dependency read it back. The per-request shape appears in `rules/jobs-task-queue.md` and `rules/jobs-scheduling.md` snippets for brevity; production wiring uses the lifespan. Distilled from the retired arq-patterns.md; no traced incident.
Upstream: https://fastapi.tiangolo.com/advanced/events/

## Budget ARQ workers at max_jobs 10 and job_timeout 300
Why: house numbers for the lightweight lane. ARQ is chosen for FastAPI-native async work that finishes inside five minutes; anything needing chains, chords, RabbitMQ or SQS, per-task rate limits or a dead letter queue goes to Celery, and LLM workflows go to LangGraph. Shared resources (DB pool, HTTP client) are built in `on_startup` and torn down in `on_shutdown` on the worker `ctx`, not per job, and deferral uses `_defer_by` or `_defer_until` (not `_delay`). Distilled from the retired arq-patterns.md; no traced incident.
Upstream: https://arq-docs.helpmanual.io/

## Run Celery Beat as its own process, in UTC
Why: house decision. `celery -A app beat` runs standalone with a pidfile; the embedded `worker --beat` form is development only, because a worker restart silently stops the schedule. `celery_app.conf.timezone = "UTC"` everywhere so DST never shifts a schedule, and dynamic per-tenant schedules use the `django-celery-beat` DatabaseScheduler rather than hand-rolled schedule tables. Distilled from the retired scheduled-tasks.md; no traced incident.
Upstream: https://django-celery-beat.readthedocs.io/en/latest/

## Rate limit at the tier that owns the quota
Why: house decision. `@task(rate_limit="100/m")` is per worker process, so it only bounds a real external quota when a single worker owns the queue; fleet-wide quotas need a Redis token bucket in a Lua script (one round trip, atomic) or `app.control.rate_limit()` for a temporary load shed. Pick the tier deliberately, because the static decorator quietly multiplies by worker count. Distilled from the retired result-backends.md; no traced incident.
Upstream: https://docs.celeryq.dev/en/stable/userguide/workers.html

## Token-bucket rate limiter: bucket 100, 10 tokens per second, 25 for the Stripe lane

Why: distilled from the retired `references/result-backends.md`; these are the house
numbers behind the Redis Lua bucket. Defaults are `bucket_size=100` with
`tokens_per_second=10.0`, and the Stripe lane runs at `tokens_per_second=25` because that
provider tolerates it. The Lua script sets `EXPIRE 3600` on the bucket key so an idle
tenant's key does not persist forever, and a rejected task re-queues with an exponential
countdown capped by `2 ** min(retries, 6)`. Without the numbers the prose "a Redis token
bucket in a Lua script" is not implementable.
Upstream: https://docs.celeryq.dev/en/stable/userguide/tasks.html#Task.rate_limit

## Adaptive polling: re-poll at 30s on activity, double when idle, cap at 300s

Why: distilled from the retired `references/scheduled-tasks.md`; the house shape is
`self.apply_async(args=(resource_id,), countdown=30)` when the poll found activity, and
`next_delay = min(current_delay * 2, 300)` when it did not. A fixed-interval poller either
burns the worker pool on quiet resources or lags behind a busy one; the 30s floor and the
5 minute ceiling are the bounds we hold.
Upstream: https://docs.celeryq.dev/en/stable/userguide/calling.html#eta-and-countdown

## Count beat_sent, and route alerts by task-name prefix

Why: distilled from the retired `references/monitoring-health.md`. Two things no vendor
doc supplies. First, a `celery_beat_tasks_sent_total` counter wired to the `beat_sent`
signal is the only way to detect a schedule that silently stopped firing, because a task
that is never sent produces no failure to alert on. Second, alert severity is routed by
task-name prefix: `sender.name.startswith("tasks.payment")` raises a critical alert on
`task_failure`, while other prefixes stay at warning.
Upstream: https://docs.celeryq.dev/en/stable/userguide/signals.html

## /health/celery returns 503 when unhealthy, and probes the broker with max_retries=3

Why: distilled from the retired `references/monitoring-health.md`; the endpoint returns
`200` only when healthy and `503` otherwise, so a load balancer or Kubernetes probe can
act on it without parsing the body. The broker check is
`conn.ensure_connection(max_retries=3)`, bounded so the health endpoint cannot itself hang
on a dead broker and turn a readiness probe into a timeout.
Upstream: https://docs.celeryq.dev/en/stable/userguide/monitoring.html

## Use the named house task states VALIDATING, PROCESSING, UPLOADING

Why: distilled from the retired `references/result-backends.md`; the house lifecycle is a
named vocabulary, not a single generic PROGRESS state, with meta shaped
`{step, total, description}`. `rules/jobs-monitoring.md` retains only PROGRESS, so the
named stages live here. A polling client that has to infer progress from a percentage
cannot tell "still validating" from "stuck uploading", which is the distinction the
vocabulary exists to expose. Custom states also require `result_expires=86400` to stay
readable for the 24 hours the house keeps results.
Upstream: https://docs.celeryq.dev/en/stable/userguide/tasks.html#custom-states
