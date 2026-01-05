# Post-LLM Attribution

## The Principle

> **Attribution is DETERMINISTIC, not LLM-generated.**
>
> The LLM produces content. We attach context from our records.

```
┌────────────────────────────────────────────────────────────┐
│                   POST-LLM PHASE                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                ┌─────────────────────┐                     │
│                │       LLM           │                     │
│                │                     │                     │
│                │  Output: content    │                     │
│                │  (text, analysis)   │                     │
│                └──────────┬──────────┘                     │
│                           │                                │
│                           ▼                                │
│              ┌────────────────────────┐                    │
│              │   ATTRIBUTION LAYER    │                    │
│              │                        │                    │
│  From Pre-LLM:                        From Context:        │
│  ├─ source_refs ─────────────────────► source_ids         │
│  └─ chunk_ids                          │                   │
│                                        │                   │
│  From RequestContext:                  │                   │
│  ├─ user_id ─────────────────────────► user_id            │
│  ├─ tenant_id ───────────────────────► tenant_id          │
│  ├─ trace_id ────────────────────────► trace_id           │
│  └─ analysis_id ─────────────────────► analysis_id        │
│                                        │                   │
│  Generated:                            │                   │
│  ├─ new UUID ────────────────────────► artifact_id        │
│  └─ timestamp ───────────────────────► created_at         │
│              │                        │                    │
│              └────────────┬───────────┘                    │
│                           │                                │
│                           ▼                                │
│              ┌────────────────────────┐                    │
│              │    COMPLETE RESULT     │                    │
│              │                        │                    │
│              │  content + attribution │                    │
│              │  (ready for storage)   │                    │
│              └────────────────────────┘                    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Attribution Data Structure

```python
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

@dataclass
class AttributedResult:
    """LLM output with deterministic attribution"""

    # Generated identifier
    id: UUID

    # From RequestContext (system-provided)
    user_id: UUID
    tenant_id: UUID
    analysis_id: UUID
    trace_id: str

    # From Pre-LLM refs (deterministic)
    source_document_ids: list[UUID]
    source_chunk_ids: list[UUID]

    # From LLM (content only)
    content: str
    key_concepts: list[str]
    difficulty_level: str
    summary: str

    # Metadata
    created_at: datetime
    model_used: str
    processing_time_ms: float
```

### 2. Attribution Function

```python
async def attribute_llm_output(
    llm_output: dict,
    ctx: RequestContext,
    source_refs: SourceReference,
    model_name: str,
    processing_time_ms: float,
) -> AttributedResult:
    """
    Attach context to LLM output.
    All attribution comes from our records, not the LLM.
    """

    # Validate LLM output has no IDs
    if contains_identifiers(llm_output):
        raise SecurityError("LLM output contains identifiers")

    return AttributedResult(
        # New ID for this artifact
        id=uuid4(),

        # From RequestContext (verified from JWT)
        user_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        analysis_id=ctx.resource_id,
        trace_id=ctx.trace_id,

        # From Pre-LLM capture (deterministic)
        source_document_ids=source_refs.document_ids,
        source_chunk_ids=source_refs.chunk_ids,

        # From LLM (content only)
        content=llm_output["analysis"],
        key_concepts=llm_output.get("key_concepts", []),
        difficulty_level=llm_output.get("difficulty", "intermediate"),
        summary=llm_output.get("summary", ""),

        # Metadata
        created_at=datetime.utcnow(),
        model_used=model_name,
        processing_time_ms=processing_time_ms,
    )

def contains_identifiers(output: dict) -> bool:
    """Check if LLM output contains any identifiers"""
    import re

    output_str = str(output)

    # Check for UUIDs
    if re.search(UUID_PATTERN, output_str):
        return True

    # Check for ID field names in content
    for field in ["user_id", "tenant_id", "document_id"]:
        if field in output_str.lower():
            return True

    return False
```

### 3. Storage with Attribution

```python
async def save_attributed_result(
    result: AttributedResult,
    db: AsyncSession,
) -> None:
    """
    Save result with all attribution intact.
    Attribution comes from our context, not LLM.
    """

    # Create artifact record
    artifact = Artifact(
        id=result.id,
        user_id=result.user_id,
        tenant_id=result.tenant_id,
        analysis_id=result.analysis_id,
        content=result.content,
        key_concepts=result.key_concepts,
        difficulty_level=result.difficulty_level,
        summary=result.summary,
        created_at=result.created_at,
        model_used=result.model_used,
    )
    db.add(artifact)

    # Create source links
    for doc_id in result.source_document_ids:
        link = ArtifactSourceLink(
            artifact_id=result.id,
            document_id=doc_id,
            tenant_id=result.tenant_id,  # Denormalized for RLS
        )
        db.add(link)

    await db.commit()

    # Audit log
    logger.audit(
        "artifact.created",
        artifact_id=result.id,
        user_id=result.user_id,
        tenant_id=result.tenant_id,
        source_count=len(result.source_document_ids),
    )
```

## SkillForge Integration

### Content Analysis Workflow

```python
# backend/app/workflows/agents/content_analyzer.py

async def create_analysis_artifact(state: AnalysisState) -> AnalysisState:
    """Create artifact with proper attribution"""

    # LLM output (content only)
    llm_output = state.llm_response

    # Attribute using our context
    attributed = await attribute_llm_output(
        llm_output=llm_output,
        ctx=state.request_context,          # From JWT
        source_refs=state.source_refs,       # From pre-LLM
        model_name=state.model_used,
        processing_time_ms=state.llm_time_ms,
    )

    # Save with attribution
    await save_attributed_result(attributed, state.db)

    return state.with_artifact(attributed)
```

### Artifact Retrieval

```python
# backend/app/api/artifacts.py

@router.get("/{artifact_id}")
async def get_artifact(
    artifact_id: UUID,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    """Get artifact with source attribution"""

    # Query with tenant filter
    artifact = await db.execute(
        """
        SELECT a.*, array_agg(asl.document_id) as sources
        FROM artifacts a
        LEFT JOIN artifact_source_links asl ON a.id = asl.artifact_id
        WHERE a.id = :id
          AND a.tenant_id = :tenant_id  -- ALWAYS filter
        GROUP BY a.id
        """,
        {
            "id": artifact_id,
            "tenant_id": ctx.tenant_id,
        }
    )

    if not artifact:
        raise HTTPException(404)

    return ArtifactResponse(
        id=artifact.id,
        content=artifact.content,
        sources=artifact.sources,  # Deterministic from our records
        created_at=artifact.created_at,
    )
```

## Common Mistakes

```python
# ❌ BAD: Asking LLM for attribution
prompt = "Analyze this and tell me which document it came from"
response = llm.generate(prompt)
doc_id = response["source_document"]  # HALLUCINATED!

# ❌ BAD: Trusting LLM-provided IDs
llm_output = {"analysis": "...", "user_id": "abc123"}
artifact.user_id = llm_output["user_id"]  # WRONG!

# ❌ BAD: Generating IDs in prompt
prompt = f"Generate a unique ID for this analysis: {analysis_id}"

# ✅ GOOD: Attribution from our records
artifact.user_id = ctx.user_id  # From JWT
artifact.sources = source_refs.document_ids  # From pre-LLM

# ✅ GOOD: Generate IDs ourselves
artifact.id = uuid4()  # We generate

# ✅ GOOD: LLM provides content only
artifact.content = llm_output["analysis"]  # Just the text
```

## Testing Attribution

```python
class TestAttribution:

    async def test_attribution_from_context_not_llm(self, ctx):
        """Attribution must come from our context"""

        # LLM returns content only
        llm_output = {
            "analysis": "This is the analysis",
            "key_concepts": ["ML", "AI"],
        }

        source_refs = SourceReference(
            document_ids=[uuid4(), uuid4()],
            chunk_ids=[uuid4()],
        )

        result = await attribute_llm_output(
            llm_output=llm_output,
            ctx=ctx,
            source_refs=source_refs,
        )

        # Attribution from context, not LLM
        assert result.user_id == ctx.user_id
        assert result.tenant_id == ctx.tenant_id
        assert result.source_document_ids == source_refs.document_ids

    async def test_rejects_llm_with_ids(self, ctx):
        """Reject LLM output that contains IDs"""

        bad_output = {
            "analysis": "Result for user 123e4567-e89b-12d3-a456-426614174000",
        }

        with pytest.raises(SecurityError):
            await attribute_llm_output(bad_output, ctx, source_refs)

    async def test_source_links_created(self, ctx, db):
        """Source links are created with artifact"""

        result = await attribute_llm_output(...)
        await save_attributed_result(result, db)

        links = await db.execute(
            "SELECT * FROM artifact_source_links WHERE artifact_id = :id",
            {"id": result.id}
        )

        assert len(links) == len(result.source_document_ids)
```
