# Tenant Isolation Patterns

## The Golden Rule

> **Every database query MUST include a tenant filter. There is no "global" query.**

## Why This Matters

Without tenant isolation:
- User A could see User B's documents
- LLM could mix data from different tenants
- A bug could expose all customers' data
- Compliance violations (GDPR, HIPAA, SOC2)

## Implementation Pattern: Tenant-Scoped Repository

```python
from uuid import UUID
from typing import TypeVar, Generic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")

class TenantScopedRepository(Generic[T]):
    """
    Base repository that ALWAYS filters by tenant.
    Cannot be bypassed - tenant filter is mandatory.
    """

    def __init__(self, session: AsyncSession, ctx: RequestContext, model: type[T]):
        self.session = session
        self.ctx = ctx
        self.model = model

    def _base_query(self):
        """Every query starts with tenant filter"""
        return select(self.model).where(
            self.model.tenant_id == self.ctx.tenant_id
        )

    async def find_all(self, **filters) -> list[T]:
        """Find all matching records (tenant-scoped)"""
        query = self._base_query()
        for key, value in filters.items():
            query = query.where(getattr(self.model, key) == value)
        result = await self.session.execute(query)
        return result.scalars().all()

    async def find_by_id(self, id: UUID) -> T | None:
        """
        Find by ID (tenant-scoped).
        Even by-ID lookup includes tenant check!
        """
        query = self._base_query().where(self.model.id == id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def find_by_user(self) -> list[T]:
        """Find records owned by current user (tenant + user scoped)"""
        query = self._base_query().where(
            self.model.user_id == self.ctx.user_id
        )
        result = await self.session.execute(query)
        return result.scalars().all()
```

## Vector Search with Tenant Isolation

```python
async def semantic_search(
    query_embedding: list[float],
    ctx: RequestContext,
    limit: int = 10,
) -> list[Document]:
    """
    Semantic search with mandatory tenant isolation.
    """
    return await db.execute(
        """
        SELECT id, content, metadata,
               1 - (embedding <-> :query) as similarity
        FROM documents
        WHERE tenant_id = :tenant_id          -- ALWAYS filtered!
          AND user_id = :user_id              -- User's docs only
          AND embedding <-> :query < 0.5      -- Similarity threshold
        ORDER BY embedding <-> :query
        LIMIT :limit
        """,
        {
            "tenant_id": ctx.tenant_id,  # From context
            "user_id": ctx.user_id,       # From context
            "query": query_embedding,
            "limit": limit,
        }
    )
```

## Full-Text Search with Tenant Isolation

```python
async def fulltext_search(
    query: str,
    ctx: RequestContext,
    limit: int = 20,
) -> list[Analysis]:
    """
    Full-text search with mandatory tenant isolation.
    """
    return await db.execute(
        """
        SELECT id, title, url,
               ts_rank(search_vector, plainto_tsquery(:query)) as rank
        FROM analyses
        WHERE tenant_id = :tenant_id          -- ALWAYS filtered!
          AND user_id = :user_id              -- User's analyses only
          AND status = 'complete'
          AND search_vector @@ plainto_tsquery(:query)
        ORDER BY rank DESC
        LIMIT :limit
        """,
        {
            "tenant_id": ctx.tenant_id,
            "user_id": ctx.user_id,
            "query": query,
            "limit": limit,
        }
    )
```

## Caching with Tenant Isolation

```python
def cache_key(ctx: RequestContext, operation: str, *args) -> str:
    """
    Cache keys MUST include tenant_id to prevent cross-tenant leakage.
    """
    return f"{ctx.tenant_id}:{ctx.user_id}:{operation}:{':'.join(str(a) for a in args)}"

# Usage
key = cache_key(ctx, "analysis", analysis_id)
# Result: "tenant_abc:user_123:analysis:analysis_456"
```

## Testing Tenant Isolation

```python
import pytest
from uuid import uuid4

class TestTenantIsolation:
    """Every repository MUST have these tests"""

    @pytest.fixture
    def tenant_a_ctx(self):
        return RequestContext(
            user_id=uuid4(),
            tenant_id=uuid4(),  # Tenant A
            ...
        )

    @pytest.fixture
    def tenant_b_ctx(self):
        return RequestContext(
            user_id=uuid4(),
            tenant_id=uuid4(),  # Tenant B (different!)
            ...
        )

    async def test_tenant_a_cannot_see_tenant_b_documents(
        self,
        tenant_a_ctx,
        tenant_b_ctx,
        db_session,
    ):
        # Create document for Tenant B
        doc = Document(
            id=uuid4(),
            tenant_id=tenant_b_ctx.tenant_id,
            content="Secret data",
        )
        await db_session.add(doc)
        await db_session.commit()

        # Tenant A tries to access
        repo = TenantScopedRepository(db_session, tenant_a_ctx, Document)
        result = await repo.find_by_id(doc.id)

        # MUST be None - tenant A cannot see tenant B's data
        assert result is None

    async def test_tenant_a_cannot_search_tenant_b_documents(
        self,
        tenant_a_ctx,
        tenant_b_ctx,
    ):
        # Create and embed document for Tenant B
        await create_document(
            tenant_id=tenant_b_ctx.tenant_id,
            content="Machine learning tutorial",
        )

        # Tenant A searches for "machine learning"
        results = await semantic_search(
            query_embedding=embed("machine learning"),
            ctx=tenant_a_ctx,
        )

        # MUST be empty - tenant A cannot find tenant B's data
        assert len(results) == 0
```

## Common Mistakes

```python
# BAD: Global query without tenant filter
async def find_all():
    return await db.execute("SELECT * FROM documents")

# BAD: Tenant filter as optional parameter
async def find(tenant_id: UUID | None = None):
    query = "SELECT * FROM documents"
    if tenant_id:  # Can be bypassed!
        query += f" WHERE tenant_id = '{tenant_id}'"

# BAD: Trusting client-provided tenant_id
async def find(request: Request):
    tenant_id = request.query_params["tenant_id"]  # User controls this!
    return await db.find(tenant_id=tenant_id)

# GOOD: Tenant from authenticated context only
async def find(ctx: RequestContext):
    return await db.find(tenant_id=ctx.tenant_id)  # From JWT
```

## Row-Level Security (PostgreSQL)

For additional protection, use PostgreSQL RLS:

```sql
-- Enable RLS on table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY tenant_isolation ON documents
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Set tenant before queries
SET app.tenant_id = 'tenant-uuid-here';
```

This provides database-level enforcement even if application code has bugs.
