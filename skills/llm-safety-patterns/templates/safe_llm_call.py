"""
Safe LLM Call Template

This template demonstrates the complete pattern for making
LLM calls with proper context separation, filtering, and attribution.

Copy and adapt for SkillForge workflows.
"""

import re
from dataclasses import dataclass
from datetime import datetime
from typing import TypeVar
from uuid import UUID, uuid4

from pydantic import BaseModel

# Type variable for schema
T = TypeVar("T", bound=BaseModel)

# ============================================================
# FORBIDDEN PATTERNS
# ============================================================

UUID_PATTERN = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

FORBIDDEN_IN_PROMPTS = {
    "user_id",
    "tenant_id",
    "analysis_id",
    "document_id",
    "artifact_id",
    "chunk_id",
    "session_id",
    "trace_id",
    "workflow_run_id",
    "api_key",
}


# ============================================================
# DATA CLASSES
# ============================================================

@dataclass(frozen=True)
class RequestContext:
    """Immutable context from JWT - flows AROUND LLM"""
    user_id: UUID
    tenant_id: UUID
    trace_id: str
    session_id: str
    resource_id: UUID | None = None


@dataclass
class SourceReference:
    """References captured pre-LLM for post-LLM attribution"""
    document_ids: list[UUID]
    chunk_ids: list[UUID]
    retrieval_timestamp: datetime


@dataclass
class ContentPayload:
    """What goes TO the LLM - content only"""
    query: str
    context_texts: list[str]
    instructions: str


# ============================================================
# AUDIT FUNCTIONS
# ============================================================

def audit_prompt(prompt: str) -> list[str]:
    """Check prompt for forbidden patterns"""
    violations = []

    # Check for UUIDs
    if re.search(UUID_PATTERN, prompt, re.IGNORECASE):
        violations.append("UUID in prompt")

    # Check for forbidden field names
    for field in FORBIDDEN_IN_PROMPTS:
        pattern = rf'\b{field}\b'
        if re.search(pattern, prompt, re.IGNORECASE):
            violations.append(f"Field '{field}' in prompt")

    return violations


def strip_identifiers(text: str) -> str:
    """Remove any IDs from content"""
    return re.sub(UUID_PATTERN, '[REDACTED]', text, flags=re.IGNORECASE)


# ============================================================
# PRE-LLM PHASE
# ============================================================

async def prepare_for_llm(
    query: str,
    ctx: RequestContext,
    db_session,
) -> tuple[ContentPayload, SourceReference]:
    """
    Phase 1: Pre-LLM Preparation
    - Retrieve with tenant isolation
    - Extract content only
    - Capture source references
    """
    # Tenant-isolated retrieval
    results = await db_session.execute(
        """
        SELECT id, chunk_id, content
        FROM document_chunks
        WHERE tenant_id = :tenant_id
          AND user_id = :user_id
        ORDER BY embedding <-> :query_embedding
        LIMIT 10
        """,
        {
            "tenant_id": ctx.tenant_id,
            "user_id": ctx.user_id,
            "query_embedding": embed(query),
        }
    )

    # Separate content from references
    content_texts = [strip_identifiers(r.content) for r in results]
    source_refs = SourceReference(
        document_ids=[r.id for r in results],
        chunk_ids=[r.chunk_id for r in results],
        retrieval_timestamp=datetime.utcnow(),
    )

    # Build content payload
    content = ContentPayload(
        query=query,
        context_texts=content_texts,
        instructions="Analyze the content and provide insights.",
    )

    return content, source_refs


# ============================================================
# LLM CALL PHASE
# ============================================================

def build_prompt(content: ContentPayload) -> str:
    """
    Phase 2: Build prompt from content only
    NO IDs allowed in this function!
    """
    prompt = f"""
{content.instructions}

USER QUERY:
{content.query}

RELEVANT CONTEXT:
{chr(10).join(f"- {text}" for text in content.context_texts)}

Provide your analysis:
"""

    # CRITICAL: Audit before returning
    violations = audit_prompt(prompt)
    if violations:
        raise SecurityError(f"Prompt audit failed: {violations}")

    return prompt


async def call_llm(prompt: str, schema: type[T]) -> T:
    """
    Phase 2: Call LLM with audited prompt
    """
    # Call LLM (replace with actual LLM client)
    response = await llm_client.generate(
        prompt=prompt,
        temperature=0.7,
        max_tokens=2000,
    )

    # Parse response
    return schema.model_validate(response)


# ============================================================
# POST-LLM PHASE
# ============================================================

@dataclass
class AttributedResult:
    """Complete result with attribution"""
    id: UUID
    content: str
    user_id: UUID
    tenant_id: UUID
    source_document_ids: list[UUID]
    created_at: datetime


async def attribute_and_save(
    llm_output: BaseModel,
    ctx: RequestContext,
    source_refs: SourceReference,
    db_session,
) -> AttributedResult:
    """
    Phase 3: Attach context and save
    Attribution is DETERMINISTIC, not from LLM!
    """
    # Validate no IDs in output
    output_str = llm_output.model_dump_json()
    if re.search(UUID_PATTERN, output_str):
        raise SecurityError("LLM output contains hallucinated IDs")

    # Create attributed result
    result = AttributedResult(
        id=uuid4(),  # We generate the ID
        content=llm_output.content,
        user_id=ctx.user_id,  # From context
        tenant_id=ctx.tenant_id,  # From context
        source_document_ids=source_refs.document_ids,  # From pre-LLM
        created_at=datetime.utcnow(),
    )

    # Save to database
    await db_session.execute(
        """
        INSERT INTO artifacts (id, content, user_id, tenant_id, created_at)
        VALUES (:id, :content, :user_id, :tenant_id, :created_at)
        """,
        {
            "id": result.id,
            "content": result.content,
            "user_id": result.user_id,
            "tenant_id": result.tenant_id,
            "created_at": result.created_at,
        }
    )

    # Save source links
    for doc_id in result.source_document_ids:
        await db_session.execute(
            """
            INSERT INTO artifact_sources (artifact_id, document_id, tenant_id)
            VALUES (:artifact_id, :document_id, :tenant_id)
            """,
            {
                "artifact_id": result.id,
                "document_id": doc_id,
                "tenant_id": result.tenant_id,
            }
        )

    await db_session.commit()

    return result


# ============================================================
# COMPLETE WORKFLOW
# ============================================================

class AnalysisOutput(BaseModel):
    """Expected LLM output schema"""
    content: str
    key_concepts: list[str]
    difficulty: str


async def safe_analyze(
    query: str,
    ctx: RequestContext,
    db_session,
) -> AttributedResult:
    """
    Complete safe LLM workflow:
    1. Pre-LLM: Filter and extract content
    2. LLM: Generate with content only
    3. Post-LLM: Attribute and save
    """
    # Phase 1: Pre-LLM
    content, source_refs = await prepare_for_llm(query, ctx, db_session)

    # Phase 2: LLM Call
    prompt = build_prompt(content)
    llm_output = await call_llm(prompt, AnalysisOutput)

    # Phase 3: Post-LLM
    result = await attribute_and_save(
        llm_output=llm_output,
        ctx=ctx,
        source_refs=source_refs,
        db_session=db_session,
    )

    return result
