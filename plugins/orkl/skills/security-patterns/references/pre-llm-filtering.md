# Pre-LLM Filtering

## Purpose

Before ANY data reaches the LLM, it must be:
1. **Scoped** to the current tenant/user
2. **Filtered** for relevance
3. **Stripped** of identifiers
4. **Captured** for later attribution

```
┌────────────────────────────────────────────────────────────┐
│                    PRE-LLM PHASE                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  User Query ──► Tenant Filter ──► Content Extract ──► LLM  │
│       │              │                   │                 │
│       │              │                   │                 │
│       ▼              ▼                   ▼                 │
│  ┌─────────┐   ┌───────────┐     ┌─────────────┐          │
│  │ Query   │   │ Documents │     │ Text Only   │          │
│  │ Text    │   │ for THIS  │     │ (no IDs)    │          │
│  │         │   │ tenant    │     │             │          │
│  └─────────┘   └───────────┘     └─────────────┘          │
│                      │                                     │
│                      ▼                                     │
│              ┌─────────────┐                              │
│              │ Save Refs   │                              │
│              │ for Later   │  ◄── For post-LLM attribution│
│              │ Attribution │                              │
│              └─────────────┘                              │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Tenant-Scoped Retrieval

```python
from uuid import UUID
from dataclasses import dataclass

@dataclass
class SourceReference:
    """Tracks what was retrieved for attribution"""
    document_ids: list[UUID]
    chunk_ids: list[UUID]
    similarity_scores: list[float]
    retrieval_timestamp: datetime

async def retrieve_with_isolation(
    query: str,
    ctx: RequestContext,
    limit: int = 10,
) -> tuple[list[str], SourceReference]:
    """
    Retrieve documents scoped to tenant/user.
    Returns: (content_texts, source_references)
    """
    # Embed query
    query_embedding = await embed(query)

    # Search with MANDATORY tenant filter
    results = await db.execute(
        """
        SELECT id, chunk_id, content,
               1 - (embedding <-> :query) as similarity
        FROM document_chunks
        WHERE tenant_id = :tenant_id    -- REQUIRED
          AND user_id = :user_id        -- REQUIRED
          AND embedding <-> :query < 0.5
        ORDER BY embedding <-> :query
        LIMIT :limit
        """,
        {
            "tenant_id": ctx.tenant_id,  # From JWT
            "user_id": ctx.user_id,       # From JWT
            "query": query_embedding,
            "limit": limit,
        }
    )

    # Separate content from references
    content_texts = [r.content for r in results]
    source_refs = SourceReference(
        document_ids=[r.id for r in results],
        chunk_ids=[r.chunk_id for r in results],
        similarity_scores=[r.similarity for r in results],
        retrieval_timestamp=datetime.now(timezone.utc),
    )

    return content_texts, source_refs
```

### 2. Content Extraction (Strip IDs)

```python
def extract_content_only(documents: list[Document]) -> list[str]:
    """
    Extract text content, stripping any embedded IDs.
    """
    contents = []
    for doc in documents:
        # Get content
        text = doc.content

        # Remove any embedded IDs (defensive)
        text = strip_identifiers(text)

        contents.append(text)

    return contents

def strip_identifiers(text: str) -> str:
    """Remove any identifiers that might have leaked into content"""
    import re

    # Remove UUIDs
    text = re.sub(
        r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
        '[REDACTED]',
        text,
        flags=re.IGNORECASE
    )

    # Remove common ID patterns
    patterns = [
        r'user_id:\s*\S+',
        r'tenant_id:\s*\S+',
        r'doc_id:\s*\S+',
    ]
    for pattern in patterns:
        text = re.sub(pattern, '[REDACTED]', text, flags=re.IGNORECASE)

    return text
```

### 3. Full Pre-LLM Pipeline

```python
@dataclass
class PreLLMResult:
    """Complete pre-LLM preparation result"""
    query: str
    context_texts: list[str]
    source_refs: SourceReference
    preparation_time_ms: float

async def prepare_for_llm(
    query: str,
    ctx: RequestContext,
) -> PreLLMResult:
    """
    Complete pre-LLM preparation:
    1. Retrieve with tenant isolation
    2. Extract content only
    3. Save references for attribution
    """
    start = time.monotonic()

    # Step 1: Tenant-scoped retrieval
    raw_results, source_refs = await retrieve_with_isolation(
        query=query,
        ctx=ctx,
    )

    # Step 2: Extract and clean content
    context_texts = [strip_identifiers(text) for text in raw_results]

    # Step 3: Audit for any remaining IDs
    for text in context_texts:
        violations = audit_prompt(text)
        if violations:
            logger.warning(
                "ID found in content, redacting",
                violations=violations,
            )

    elapsed = (time.monotonic() - start) * 1000

    return PreLLMResult(
        query=query,
        context_texts=context_texts,
        source_refs=source_refs,
        preparation_time_ms=elapsed,
    )
```

## OrchestKit Integration

### In Content Analysis Workflow

```python
# backend/app/workflows/agents/retriever.py

async def retrieve_context(state: AnalysisState) -> AnalysisState:
    """RAG retrieval with tenant isolation"""

    ctx = state.request_context

    # Pre-LLM preparation
    pre_llm = await prepare_for_llm(
        query=state.analysis_request.query,
        ctx=ctx,
    )

    # Store for later phases
    return state.copy(
        context_texts=pre_llm.context_texts,
        source_refs=pre_llm.source_refs,
        # NO IDs in state that goes to LLM
    )
```

### In Library Search

```python
# backend/app/services/search.py

async def search_libraries(
    query: str,
    ctx: RequestContext,
) -> SearchResult:
    """Search golden dataset with isolation"""

    # Always filter by tenant
    results = await db.execute(
        """
        SELECT id, title, url, summary, content
        FROM golden_dataset
        WHERE tenant_id = :tenant_id
          AND search_vector @@ plainto_tsquery(:query)
        ORDER BY ts_rank(search_vector, plainto_tsquery(:query)) DESC
        LIMIT 20
        """,
        {
            "tenant_id": ctx.tenant_id,
            "query": query,
        }
    )

    # Return content and refs separately
    return SearchResult(
        items=[r.content for r in results],  # Content for LLM
        refs=[r.id for r in results],         # IDs for attribution
    )
```

## Common Mistakes

```python
# ❌ BAD: Query without tenant filter
results = await db.execute("SELECT * FROM documents")

# ❌ BAD: Tenant filter as optional
async def search(tenant_id: UUID | None = None):
    query = "SELECT * FROM documents"
    if tenant_id:  # Can be bypassed!
        query += f" WHERE tenant_id = '{tenant_id}'"

# ❌ BAD: Trusting client-provided tenant
async def search(request: Request):
    tenant_id = request.query_params["tenant_id"]  # Attacker controls!

# ❌ BAD: Including IDs in content
results = [{"id": doc.id, "content": doc.content} for doc in docs]

# ✅ GOOD: Mandatory tenant filter from context
results = await db.execute(
    "SELECT content FROM documents WHERE tenant_id = :tid",
    {"tid": ctx.tenant_id}  # From verified JWT
)

# ✅ GOOD: Content separate from refs
content = [doc.content for doc in docs]  # For LLM
refs = [doc.id for doc in docs]           # For attribution
```

## Testing Pre-LLM Filtering

```python
class TestPreLLMFiltering:

    async def test_retrieval_respects_tenant(
        self,
        tenant_a_ctx,
        tenant_b_ctx,
    ):
        # Create doc for tenant B
        await create_document(
            tenant_id=tenant_b_ctx.tenant_id,
            content="Secret data",
        )

        # Search as tenant A
        result = await prepare_for_llm(
            query="secret",
            ctx=tenant_a_ctx,
        )

        # Must not find tenant B's data
        assert len(result.context_texts) == 0

    async def test_content_has_no_uuids(self, ctx):
        result = await prepare_for_llm(
            query="test query",
            ctx=ctx,
        )

        for text in result.context_texts:
            assert not re.search(UUID_PATTERN, text)

    async def test_source_refs_captured(self, ctx):
        result = await prepare_for_llm(
            query="test query",
            ctx=ctx,
        )

        # Refs saved for attribution
        assert len(result.source_refs.document_ids) > 0
        assert result.source_refs.retrieval_timestamp is not None
```
