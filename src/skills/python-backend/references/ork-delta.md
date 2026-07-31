# ork delta: python-backend

OrchestKit-specific decisions rescued during the wrap-plus-delta thinning of
src/skills/python-backend (2026-07-31). The asyncio, FastAPI, SQLAlchemy, and
connection-pool tutorials that used to sit beside these entries were deleted;
the "Upstream coverage (do not restate)" table in SKILL.md points at their
first-party sources. Only rules with a house decision behind them live here.
Every rule the 12 files in `rules/` already teach in full stays there, not here.

## Create the semaphore once and pair every acquisition with a timeout

Why: The retired references/semaphore-patterns.md carried exactly one thing the
vendor docs do not say. A `asyncio.Semaphore(10)` constructed inside the
coroutine reads correctly, type-checks, and limits nothing, because every call
gets a fresh counter; and an untimed acquisition converts one slow downstream
call into a stall for every task waiting on that semaphore. House rule: the
semaphore is built once at client or module scope, and the acquisition is always
nested inside `asyncio.timeout(...)`. `rules/asyncio-structured.md` keeps the
semaphore pattern itself, so only this pairing constraint lives here. Distilled
from the retired references/semaphore-patterns.md; no traced incident.
Upstream: Python asyncio synchronization primitives, https://docs.python.org/3/library/asyncio-sync.html

## Cap fleet-wide pool size against the server max_connections, not just per process

Why: Both pool-sizing formulas OrchestKit has shipped size a single process.
The retired references/pool-sizing.md added the fleet-level check that
`rules/pooling-database.md` does not: reserve roughly 10 connections for admin
and superuser access, then divide the remainder by the number of running app
instances before setting `pool_size`. `pool_size=20` on five replicas against
PostgreSQL's default `max_connections=100` exhausts the server while every
instance looks individually well tuned, and the first symptom is a connection
refusal on deploy, not under load. Distilled from the retired
references/pool-sizing.md; no traced incident.
Upstream: PostgreSQL connection settings (max_connections, superuser_reserved_connections), https://www.postgresql.org/docs/current/runtime-config-connection.html

## Alert on pool utilization at 70 percent and checkout wait at 100 ms

Why: House alert thresholds from the retired references/pool-sizing.md.
Utilization above 70 percent is a warning and above 90 percent is critical;
connection checkout wait above 100 ms is a warning and above 1 s is critical;
overflow usage above 50 percent is a warning and above 80 percent is critical.
Size the HTTP-client pool by the same arithmetic the retired file used:
`limit = num_external_services * connections_per_service * safety_factor`.
`rules/pooling-tuning.md` ships
the Prometheus gauges and the checkout/checkin listeners but only says to alert
when available connections approach zero, which fires after the request queue
has already backed up. These numbers are OrchestKit defaults, not a vendor
recommendation. Distilled from the retired references/pool-sizing.md; no traced
incident.
Upstream: SQLAlchemy connection pool events (checkout, checkin), https://docs.sqlalchemy.org/en/20/core/events.html

## Put cross-cutting concerns in middleware and per-route concerns in dependencies

Why: The retired references/middleware-stack.md is the only place the split was
written down. Middleware runs before route matching and cannot see path
parameters, so request ID, timing, structured logging, and CORS belong there,
while authentication, per-endpoint rate limiting, request validation, and
database sessions belong in `Depends()`. Teams that put auth in middleware lose
per-route scoping and end up re-implementing route exclusion lists inside the
middleware. `rules/fastapi-middleware.md` keeps the middleware implementations
and ordering, and `rules/fastapi-dependencies.md` keeps the DI patterns; this
entry is only the routing decision between them. Distilled from the retired
references/middleware-stack.md; no traced incident.
Upstream: FastAPI middleware, https://fastapi.tiangolo.com/tutorial/middleware/ and FastAPI dependencies, https://fastapi.tiangolo.com/tutorial/dependencies/

## Close lifespan resources in reverse acquisition order

Why: The retired examples/fastapi-lifespan.md tore down embeddings, LLM
clients, the task queue, Redis, and the database engine in the exact reverse of
the startup order, and that ordering is load-bearing: a task queue that flushes
on close still needs the Redis connection it was built on, so disposing Redis
first turns a clean shutdown into a shutdown-time exception that hides the real
stop reason. `rules/fastapi-background.md` keeps the lifespan shape but states
no ordering constraint, so the constraint lives here. Distilled from the retired
examples/fastapi-lifespan.md; no traced incident.
Upstream: FastAPI lifespan events, https://fastapi.tiangolo.com/advanced/events/

## Drain in-flight requests on SIGTERM behind a 503, for up to 30 seconds

Why: The retired examples/fastapi-lifespan.md carried the house shutdown
contract, and nothing in `rules/` restates it. On SIGTERM or SIGINT, set
`app.state.shutting_down = True`, have the health endpoint answer `503` from
that moment so the load balancer stops routing new work, then wait up to 30
seconds for active requests to finish before tearing resources down (in reverse
acquisition order, per the entry above). Exiting immediately on SIGTERM drops
in-flight requests during every rolling deploy, and the failure is invisible in
app logs because the process is already gone. Distilled from the retired
examples/fastapi-lifespan.md; no traced incident.
Upstream: FastAPI lifespan events, https://fastapi.tiangolo.com/advanced/events/ and Uvicorn deployment, https://www.uvicorn.org/deployment/

## Order the middleware stack six deep, with auth at 5 and rate limiting at 6

Why: `rules/fastapi-middleware.md` documents only the outer four layers (CORS,
RequestID, Timing, Logging). The retired references/middleware-stack.md carried
the full house order, and the last two are the ones that matter for correctness:
authentication sits at position 5 and rate limiting at position 6, closest to
the route, returning `429` with rate-limit headers. Rate limiting placed outside
auth cannot key a limit on the authenticated principal, so a per-user quota
silently degrades into a per-IP one. Distilled from the retired
references/middleware-stack.md; no traced incident.
Upstream: FastAPI middleware, https://fastapi.tiangolo.com/tutorial/middleware/

## Size read and write pools separately, and set lock_timeout on the connection

Why: The retired examples/connection-pooling-examples.md held the house working
config that no rule file repeats: split the primary and replica pools rather
than sharing one (primary 20, read replica 30 for read-heavy traffic, 5 for
analytics), pass `lock_timeout: '10000'` in `connect_args` alongside the
`statement_timeout` that `rules/pooling-database.md` already sets, and cap
asyncpg connection reuse with `max_queries=50000` so long-lived connections get
recycled. `statement_timeout` alone bounds query execution but not the time
spent waiting to acquire a lock, which is the failure mode during migrations.
Distilled from the retired examples/connection-pooling-examples.md; no traced
incident.
Upstream: SQLAlchemy engine and pool configuration, https://docs.sqlalchemy.org/en/20/core/pooling.html and PostgreSQL client connection defaults, https://www.postgresql.org/docs/current/runtime-config-client.html

## Treat more than 100 ms of event-loop blocking as a defect

Why: The retired checklists/async-implementation-checklist.md carried the only
number OrchestKit has ever put on this: monitor for event-loop blocking above
100 ms and treat a breach as a bug to fix, not a latency figure to accept. The
fix is always the same, move the blocking call to `asyncio.to_thread()` or a
process pool. `rules/asyncio-structured.md` teaches the bridge itself; the
threshold that says when to reach for it is the house part. Distilled from the
retired checklists/async-implementation-checklist.md; no traced incident.
Upstream: Python asyncio developer guide (debug mode and slow callback detection), https://docs.python.org/3/library/asyncio-dev.html
