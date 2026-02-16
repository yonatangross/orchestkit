---
title: "Defense: Zero Trust & Tenant Isolation"
category: defense
impact: CRITICAL
impactDescription: "Prevents cross-tenant data leakage through immutable request context and mandatory tenant filtering"
tags: zero-trust, tenant-isolation, multi-tenancy, request-context
---

# Zero Trust & Tenant Isolation

## Immutable Request Context

```python
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID
from typing import FrozenSet

@dataclass(frozen=True)
class RequestContext:
    """
    System context that NEVER appears in LLM prompts.
    Created at gateway, flows through all layers.
    """
    # Identity
    user_id: UUID
    tenant_id: UUID
    session_id: str
    permissions: FrozenSet[str]

    # Tracing
    request_id: str
    trace_id: str
    span_id: str

    # Resource
    resource_id: UUID | None = None
    resource_type: str | None = None

    # Metadata
    timestamp: datetime = None
    client_ip: str = ""
```

## Context Creation at Gateway

```python
from fastapi import Request, Depends

async def get_request_context(request: Request) -> RequestContext:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing authorization")

    token = auth_header[7:]
    claims = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])

    return RequestContext(
        user_id=UUID(claims["sub"]),
        tenant_id=UUID(claims["tenant_id"]),
        session_id=claims["session_id"],
        permissions=frozenset(claims.get("permissions", [])),
        request_id=request.headers.get("X-Request-ID", str(uuid4())),
        trace_id=generate_trace_id(),
        span_id=generate_span_id(),
        client_ip=request.client.host,
    )
```

## Tenant-Scoped Repository

```python
class TenantScopedRepository(Generic[T]):
    """Cannot be bypassed - tenant filter is mandatory."""

    def __init__(self, session: AsyncSession, ctx: RequestContext, model: type[T]):
        self.session = session
        self.ctx = ctx
        self.model = model

    def _base_query(self):
        return select(self.model).where(
            self.model.tenant_id == self.ctx.tenant_id
        )

    async def find_by_id(self, id: UUID) -> T | None:
        """Even by-ID lookup includes tenant check."""
        query = self._base_query().where(self.model.id == id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def find_by_user(self) -> list[T]:
        query = self._base_query().where(
            self.model.user_id == self.ctx.user_id
        )
        result = await self.session.execute(query)
        return result.scalars().all()
```

## Vector Search with Tenant Isolation

```python
async def semantic_search(query_embedding: list[float], ctx: RequestContext, limit: int = 10):
    return await db.execute("""
        SELECT id, content, 1 - (embedding <-> :query) as similarity
        FROM documents
        WHERE tenant_id = :tenant_id
          AND user_id = :user_id
          AND embedding <-> :query < 0.5
        ORDER BY embedding <-> :query
        LIMIT :limit
    """, {
        "tenant_id": ctx.tenant_id,
        "user_id": ctx.user_id,
        "query": query_embedding,
        "limit": limit,
    })
```

## Caching with Tenant Isolation

```python
def cache_key(ctx: RequestContext, operation: str, *args) -> str:
    """Cache keys MUST include tenant_id."""
    return f"{ctx.tenant_id}:{ctx.user_id}:{operation}:{':'.join(str(a) for a in args)}"
```

## Row-Level Security (PostgreSQL)

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON documents
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

SET app.tenant_id = 'tenant-uuid-here';
```

## Audit Logging

```python
class SanitizedLogger:
    REDACT_PATTERNS = {
        r"password": "[PASSWORD_REDACTED]",
        r"api[_-]?key": "[API_KEY_REDACTED]",
        r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}": "[EMAIL_REDACTED]",
    }
    HASH_FIELDS = {"prompt", "response", "content"}

    def audit(self, event: str, **kwargs):
        sanitized = self._sanitize(kwargs)
        self._logger.info(event, audit=True, **sanitized)
```

## Anti-Patterns

```python
# BAD: Mutable context
class RequestContext:
    user_id: UUID  # Can be changed!

# BAD: Context in prompt
prompt = f"User {ctx.user_id} wants to analyze..."

# BAD: Global query without tenant filter
async def find_all():
    return await db.execute("SELECT * FROM documents")

# BAD: Tenant filter as optional
async def find(tenant_id: UUID | None = None):
    if tenant_id:  # Can be bypassed!
        query += f" WHERE tenant_id = '{tenant_id}'"

# GOOD: Tenant from authenticated context only
async def find(ctx: RequestContext):
    return await db.find(tenant_id=ctx.tenant_id)
```

## Testing Tenant Isolation

```python
async def test_tenant_a_cannot_see_tenant_b_documents(tenant_a_ctx, tenant_b_ctx):
    doc = Document(tenant_id=tenant_b_ctx.tenant_id, content="Secret data")
    await db_session.add(doc)

    repo = TenantScopedRepository(db_session, tenant_a_ctx, Document)
    result = await repo.find_by_id(doc.id)

    assert result is None  # Tenant A cannot see tenant B's data
```

**Incorrect — Optional tenant filtering allows cross-tenant data access:**
```python
async def find_documents(tenant_id: UUID | None = None):
    query = select(Document)
    if tenant_id:  # Can be bypassed by omitting parameter
        query = query.where(Document.tenant_id == tenant_id)
    return await session.execute(query)
```

**Correct — Immutable RequestContext makes tenant filtering mandatory and tamper-proof:**
```python
async def find_documents(ctx: RequestContext):
    # Tenant filter is mandatory via immutable context
    query = select(Document).where(
        Document.tenant_id == ctx.tenant_id  # Cannot be bypassed
    )
    return await session.execute(query)
```
