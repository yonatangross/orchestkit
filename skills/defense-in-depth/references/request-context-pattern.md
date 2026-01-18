# Request Context Pattern

## Purpose

The RequestContext is an immutable object created at the gateway that carries identity and tracing information through the entire request lifecycle. It flows AROUND the LLM (never in prompts) and is used for:

1. **Authorization** - Who is making the request
2. **Data Filtering** - Scope queries to tenant/user
3. **Attribution** - Tag results with proper ownership
4. **Observability** - Correlate logs and traces

## Implementation

```python
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID
from typing import FrozenSet

@dataclass(frozen=True)  # Immutable!
class RequestContext:
    """
    System context that NEVER appears in LLM prompts.
    Created at gateway, flows through all layers.
    """

    # === Identity (WHO) ===
    user_id: UUID
    tenant_id: UUID  # For B2B multi-tenant
    session_id: str
    permissions: FrozenSet[str]

    # === Tracing (OBSERVABILITY) ===
    request_id: str  # Unique per request
    trace_id: str    # Distributed tracing
    span_id: str     # Current span

    # === Resource (WHAT) ===
    resource_id: UUID | None = None  # analysis_id, document_id, etc.
    resource_type: str | None = None

    # === Metadata (WHEN, WHERE) ===
    timestamp: datetime = None
    client_ip: str = ""
    user_agent: str = ""

    def __post_init__(self):
        if self.timestamp is None:
            object.__setattr__(self, 'timestamp', datetime.now(timezone.utc))
```

## Creation at Gateway

```python
from fastapi import Request, Depends
from jose import jwt

async def get_request_context(request: Request) -> RequestContext:
    """FastAPI dependency that creates RequestContext from JWT"""

    # 1. Extract and verify JWT
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing authorization")

    token = auth_header[7:]
    try:
        claims = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.JWTError:
        raise HTTPException(401, "Invalid token")

    # 2. Build immutable context
    return RequestContext(
        user_id=UUID(claims["sub"]),
        tenant_id=UUID(claims["tenant_id"]),
        session_id=claims["session_id"],
        permissions=frozenset(claims.get("permissions", [])),
        request_id=request.headers.get("X-Request-ID", str(uuid4())),
        trace_id=generate_trace_id(),
        span_id=generate_span_id(),
        client_ip=request.client.host,
        user_agent=request.headers.get("User-Agent", ""),
    )
```

## Usage in Endpoints

```python
@router.post("/api/v1/analyze")
async def create_analysis(
    request: AnalyzeRequest,
    ctx: RequestContext = Depends(get_request_context),
):
    # Context is available throughout the request
    # Pass it to services, repositories, etc.

    # Authorization uses context
    await authorize(ctx, "analysis:create", None)

    # Data access uses context for filtering
    documents = await repo.find_by_user(ctx)

    # LLM call does NOT receive context
    # (see llm-safety-patterns skill)

    # Attribution uses context
    result = await save_result(llm_output, ctx)

    return result
```

## SkillForge Parameters

In SkillForge, these identifiers should be in RequestContext:

| Parameter | Type | Source | Purpose |
|-----------|------|--------|---------|
| `user_id` | UUID | JWT | Data ownership |
| `tenant_id` | UUID | JWT | Multi-tenant isolation |
| `session_id` | str | JWT | Session tracking |
| `analysis_id` | UUID | Generated | Current analysis job |
| `trace_id` | str | Generated | Langfuse tracing |
| `request_id` | str | Header/Generated | Request correlation |

## Why Immutable?

The context is frozen (`frozen=True`) to prevent:

1. **Accidental modification** - Can't change user_id mid-request
2. **Security bypass** - Can't escalate permissions
3. **Thread safety** - Safe to pass between async tasks
4. **Hashability** - Can be used as dict key for caching

## Anti-Patterns

```python
# BAD: Mutable context
class RequestContext:
    user_id: UUID  # Can be changed!

# BAD: Context in prompt
prompt = f"User {ctx.user_id} wants to analyze..."

# BAD: Context not passed to services
result = await service.process(content)  # Missing ctx!

# BAD: Context created inside service
def process(self):
    ctx = RequestContext(...)  # Should come from gateway!
```
