# Scenario 2: Startup MVP

**Prompt:** "Build a SaaS dashboard for monitoring Non-Human Identities (NHIs)"
**Timeline:** 2-8 weeks
**Goal:** Validate product-market fit. Ship fast. Iterate faster.

---

## Right-Sized Architecture: Monolith with Simple Layers

An MVP exists to answer one question: "Will anyone pay for this?" Every hour spent on infrastructure is an hour not spent on the answer.

### The Monolith Wins

| Factor | Monolith | Microservices |
|--------|----------|---------------|
| **Deployment** | 1 deploy target | 5-10 deploy targets |
| **Debugging** | Stack trace | Distributed tracing |
| **Local dev** | `python main.py` | Docker Compose with 8 services |
| **Latency** | Function call | Network hop + serialization |
| **Cost** | $5-20/month | $50-200/month (managed services) |
| **Time to MVP** | 2-4 weeks | 8-16 weeks |

**Rule:** Start with a monolith. Extract services when you have evidence of where the boundaries are, not when you imagine where they might be.

### When Monolith Beats Microservices

- **0-1 product stage**: You are discovering the domain. Boundaries will shift.
- **Team < 5**: Communication overhead of microservices exceeds the benefit.
- **No independent scaling needs**: If everything scales together, a monolith is simpler.
- **No polyglot requirement**: If everything is Python, a monolith compiles and tests faster.

### When to Extract a Service

Only when at least 2 of these are true:
1. A component needs to scale independently (e.g., NHI scanning runs 100x more than the dashboard).
2. A component has a fundamentally different deployment cadence.
3. A team boundary exists that aligns with the component boundary.
4. The component could be replaced wholesale without touching other code.

## File Tree (Right-Sized: ~3,000 LOC)

```
nhi-dashboard/
  app/
    main.py                    # FastAPI app, lifespan, middleware
    config.py                  # Pydantic Settings
    database.py                # Engine, session factory
    models/
      __init__.py
      user.py                  # User + Organization models
      nhi.py                   # NHI, NHISecret, NHIAuditLog
    schemas/
      __init__.py
      user.py                  # Auth request/response
      nhi.py                   # NHI CRUD schemas
      dashboard.py             # Dashboard aggregation schemas
    routes/
      __init__.py
      auth.py                  # Login, register, refresh
      nhis.py                  # NHI CRUD + search
      dashboard.py             # Aggregated dashboard data
      webhooks.py              # Incoming webhook handlers
    services/
      nhi_service.py           # NHI business logic
      scanner_service.py       # NHI scanning/discovery
      alert_service.py         # Alert evaluation + notification
    core/
      security.py              # Password hashing, JWT
      deps.py                  # Shared dependencies
      exceptions.py            # 3-5 domain exceptions
  tests/
    conftest.py                # Fixtures
    test_auth.py               # Auth flow tests
    test_nhis.py               # NHI CRUD tests
    test_dashboard.py          # Dashboard aggregation tests
  alembic/                     # Database migrations
    versions/
  alembic.ini
  pyproject.toml
  Dockerfile                   # Single-stage for MVP
  .env.example
  README.md
```

**Total: ~25 files**

### Why This Structure Works

- **Routes are thin**: Parse request, call service, return response. No business logic.
- **Services contain rules**: NHI expiration checks, alert thresholds, scan scheduling.
- **No repository layer**: At MVP stage, services query the database directly via SQLAlchemy. Add repositories when you have 3+ consumers of the same queries.
- **Models and schemas are separate**: This separation earns its keep even in an MVP because Pydantic schemas define your API contract while SQLAlchemy models define your storage.
- **One Dockerfile**: No Docker Compose. Deploy to Railway, Render, or Fly.io with one command.

## The Build-vs-Buy Matrix for MVP

### Authentication: BUY

**Recommendation:** Use Supabase Auth, Clerk, or Auth0.

| Approach | Setup Time | Maintenance | Security Risk |
|----------|-----------|-------------|---------------|
| **Supabase Auth** | 2 hours | Zero | Low (battle-tested) |
| **Clerk** | 1 hour | Zero | Low |
| **Auth0** | 4 hours | Low | Low |
| **Roll your own JWT** | 2-3 days | Ongoing | HIGH |

Rolling your own auth for an MVP is the single most common waste of time. You will spend 3 days building login, registration, password reset, email verification, session management, and token refresh. Then you will spend another day fixing the security bugs.

**If you must build auth** (e.g., the assignment requires it):

```python
# Minimal JWT auth - ~60 LOC total
from datetime import datetime, timedelta, timezone
from jose import jwt
from passlib.context import CryptContext

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
pwd_context = CryptContext(schemes=["bcrypt"])

def create_token(user_id: str, expires_delta: timedelta = timedelta(hours=24)) -> str:
    return jwt.encode(
        {"sub": user_id, "exp": datetime.now(timezone.utc) + expires_delta},
        SECRET_KEY,
        algorithm="HS256",
    )

def verify_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("sub")
    except jwt.JWTError:
        return None
```

24-hour tokens with no refresh. Good enough for MVP. Add refresh tokens when you have paying customers.

### Database: Supabase vs Build Your Own

| Factor | Supabase (Postgres) | Firebase | Build Your Own PG |
|--------|--------------------|-----------|--------------------|
| **Setup** | 5 minutes | 5 minutes | 30 minutes |
| **Auth included** | Yes | Yes | No |
| **Row-level security** | Yes | Yes (rules) | DIY |
| **Real-time** | Yes (subscriptions) | Yes | DIY (SSE/WebSocket) |
| **Migrations** | Dashboard or SQL | No schema | Alembic |
| **Vendor lock-in** | Low (standard PG) | HIGH | None |
| **Free tier** | 500MB, 50K requests | Generous | $0 (local) |
| **When to use** | MVP needs auth + DB + realtime | Mobile-first, NoSQL OK | Full control needed |

**Recommendation for NHI dashboard:** Supabase. You get Postgres, auth, real-time subscriptions, and row-level security. When you outgrow it, it is standard Postgres -- you can migrate without rewriting queries.

**Use Firebase when:** Your data is document-shaped, you need offline sync, or your primary client is mobile.

**Build your own when:** You need full control over the database (complex queries, extensions, custom types), or your team already has Postgres expertise.

### Background Jobs: Simple Before Celery

For an MVP, use FastAPI's BackgroundTasks before reaching for Celery:

```python
from fastapi import BackgroundTasks

@router.post("/nhis/{nhi_id}/scan")
async def trigger_scan(
    nhi_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    nhi = await db.get(NHI, nhi_id)
    if not nhi:
        raise HTTPException(404)

    background_tasks.add_task(run_nhi_scan, nhi_id)
    return {"status": "scan_queued"}
```

Celery adds: Redis broker, worker process, beat scheduler, Flower monitoring. That is 4 new infrastructure components for an MVP.

**Upgrade to Celery/ARQ when:**
- Background jobs take > 30 seconds
- You need job retry with backoff
- Jobs must survive server restart
- You need scheduled/periodic tasks

## Serverless-First?

### When Serverless Makes Sense for MVP

| Platform | Strengths | Weaknesses |
|----------|-----------|------------|
| **Vercel + Supabase** | Zero-config deploy, great DX | Cold starts, 10s function limit |
| **AWS Lambda + DynamoDB** | Auto-scaling, pay-per-use | Cold starts, DynamoDB learning curve |
| **Railway/Render** | Simple deploy, always-on | Not serverless (you pay for idle) |

**For NHI dashboard:** Railway or Render with a standard FastAPI app. Serverless functions are poorly suited for:
- Long-running NHI scans
- WebSocket connections for real-time alerts
- Background job processing

Serverless shines for stateless request-response with low latency requirements and bursty traffic. A monitoring dashboard has steady traffic and long-running operations.

## Over-Engineering Traps

### Trap 1: Microservices Day One (+10,000 LOC, +8 weeks)

```
What you add:
  services/
    auth-service/          # Separate auth microservice
    nhi-service/           # NHI CRUD
    scanner-service/       # NHI scanning
    alert-service/         # Alert evaluation
    gateway/               # API gateway
  shared/
    proto/                 # gRPC definitions
    events/                # Event schemas
  infra/
    docker-compose.yml     # 8 services
    k8s/                   # Kubernetes manifests

What happens:
  Week 1-2: Setting up service communication
  Week 3-4: Debugging distributed transactions
  Week 5-6: Building the actual NHI features
  Week 7-8: Fixing deployment pipeline
  Result: Half the features, 4x the complexity
```

### Trap 2: Event Sourcing (+2,000 LOC)

```
"We need an audit trail for NHI changes."

Simple solution (30 LOC):
  CREATE TABLE nhi_audit_log (
      id SERIAL PRIMARY KEY,
      nhi_id UUID,
      action VARCHAR(20),
      changed_by UUID,
      changes JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
  );

Event sourcing solution (2,000 LOC):
  Event store, event handlers, projections,
  snapshot strategy, replay mechanism,
  eventual consistency handling...
```

An audit log table solves 95% of audit trail needs. Event sourcing is for when you need to reconstruct state at any point in time AND your domain has complex state transitions. A monitoring dashboard has neither requirement.

### Trap 3: CQRS for Identical Models (+500 LOC)

```
Read model:
  class NHIDashboardView:
      id, name, type, status, last_scan, secret_count, risk_score

Write model:
  class NHI:
      id, name, type, status, last_scan, secret_count, risk_score

These are the same model.
```

CQRS earns its keep when read and write models diverge significantly: different fields, different shapes, different query patterns. When they are identical, CQRS is just two files instead of one.

### Trap 4: Kubernetes for One Container (+500 LOC config)

```
What you add:
  k8s/
    deployment.yaml
    service.yaml
    ingress.yaml
    configmap.yaml
    hpa.yaml
    pdb.yaml
    network-policy.yaml

What Railway gives you:
  railway up
  Done. Auto-scaling, TLS, custom domain, zero config.
```

Kubernetes is a team sport. Below 5 engineers and 3 services, the operational overhead exceeds the benefit.

## Right-Sized vs Over-Engineered Comparison

| Aspect | Right-Sized MVP | Over-Engineered MVP |
|--------|----------------|---------------------|
| **Architecture** | Monolith | 4 microservices |
| **Files** | ~25 | 80-120 |
| **LOC** | 2,000-5,000 | 15,000-30,000 |
| **Time to ship** | 2-4 weeks | 10-16 weeks |
| **Deploy** | `railway up` | K8s cluster setup |
| **Monthly cost** | $5-20 | $100-300 |
| **Auth** | Supabase Auth (2 hours) | Custom JWT (3 days) |
| **Background jobs** | FastAPI BackgroundTasks | Celery + Redis + Flower |
| **Database** | Single Postgres | Postgres + Redis + message queue |
| **Monitoring** | stdout logs + Sentry | Prometheus + Grafana + Loki + Jaeger |

## The MVP Upgrade Path

When the MVP succeeds and you need to scale, here is the order of operations:

```
Phase 1 (MVP): Monolith on Railway
  |
  | Signal: Response times > 500ms, 1000+ users
  v
Phase 2: Add caching layer (Redis)
  |
  | Signal: Scanner takes > 60s, blocking requests
  v
Phase 3: Extract scanner to background worker (ARQ/Celery)
  |
  | Signal: 5+ engineers, teams forming around features
  v
Phase 4: Extract first microservice (scanner-service)
  |
  | Signal: SOC2 audit, enterprise customers
  v
Phase 5: Add observability, proper auth, API versioning
```

Each phase is triggered by actual pain, not anticipated pain. This is the difference between engineering and speculation.
