# Context Separation Pattern

## The Problem

When identifiers appear in LLM prompts, several security issues arise:

```
┌─────────────────────────────────────────────────────────┐
│  WHAT HAPPENS WHEN IDs GO INTO PROMPTS                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  "Analyze document doc_abc123 for user usr_xyz789"      │
│                     │                    │              │
│                     ▼                    ▼              │
│              ┌──────────────────────────────┐           │
│              │           LLM                │           │
│              │                              │           │
│              │  May hallucinate:            │           │
│              │  - doc_abc124 (off by one)   │           │
│              │  - doc_xyz789 (mixed up)     │           │
│              │  - usr_other (cross-tenant)  │           │
│              └──────────────────────────────┘           │
│                                                         │
│  RISKS:                                                 │
│  • Hallucinated IDs don't exist → crashes              │
│  • Mixed IDs → wrong data attribution                  │
│  • Cross-tenant IDs → security breach                  │
│  • IDs in logs/traces → data leakage                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## The Solution: Context Separation

```
┌─────────────────────────────────────────────────────────┐
│  CORRECT: CONTEXT FLOWS AROUND LLM                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  RequestContext ─────────────────────────────────────►  │
│  (user_id, tenant_id, etc.)                    │        │
│         │                                      │        │
│         │   ┌──────────────────────┐          │        │
│         │   │                      │          │        │
│         ▼   │       LLM            │          ▼        │
│  ┌──────────┤                      ├─────────────┐     │
│  │ Content  │  Sees ONLY:          │  Content +  │     │
│  │ (text)   │  - Document text     │  Context    │     │
│  │          │  - Query text        │  (merged)   │     │
│  └──────────┤  - Instructions      ├─────────────┘     │
│             │                      │                    │
│             │  NO IDs!             │                    │
│             └──────────────────────┘                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Define What's Forbidden

```python
# OrchestKit parameters that NEVER go in prompts
FORBIDDEN_IN_PROMPTS = {
    # User identity
    "user_id",      # UUID - hallucination risk
    "tenant_id",    # UUID - cross-tenant risk
    "session_id",   # String - auth context

    # Resource references
    "analysis_id",  # UUID - job tracking
    "document_id",  # UUID - source tracking
    "artifact_id",  # UUID - output tracking
    "chunk_id",     # UUID - RAG reference

    # System context
    "trace_id",     # String - observability
    "request_id",   # String - request tracking
    "workflow_run_id",  # UUID - workflow tracking

    # Secrets
    "api_key",      # String - never!
    "token",        # String - never!
}
```

### 2. Separate Context from Content

```python
from dataclasses import dataclass
from uuid import UUID

@dataclass
class ContentPayload:
    """What the LLM sees - content only"""
    query: str
    context_texts: list[str]
    instructions: str

@dataclass
class ContextPayload:
    """What flows around the LLM - never in prompt"""
    user_id: UUID
    tenant_id: UUID
    analysis_id: UUID
    source_refs: list[UUID]
    trace_id: str

async def analyze_content(
    content: ContentPayload,
    context: ContextPayload,
) -> AnalysisResult:
    """
    Content goes TO the LLM.
    Context goes AROUND the LLM.
    """
    # Build prompt from content only
    prompt = build_prompt(
        query=content.query,
        context_texts=content.context_texts,
        instructions=content.instructions,
        # NO context payload fields here!
    )

    # LLM sees content only
    llm_output = await llm.generate(prompt)

    # Reattach context to output
    return AnalysisResult(
        content=llm_output,
        user_id=context.user_id,      # From context
        tenant_id=context.tenant_id,   # From context
        analysis_id=context.analysis_id,  # From context
        sources=context.source_refs,   # From context
    )
```

### 3. Audit Prompts Before Sending

```python
import re

UUID_PATTERN = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

def audit_prompt(prompt: str) -> list[str]:
    """
    Check for forbidden patterns before sending to LLM.
    Raises if any IDs detected.
    """
    violations = []

    # Check for UUIDs
    if re.search(UUID_PATTERN, prompt, re.IGNORECASE):
        violations.append("UUID detected in prompt")

    # Check for ID field names
    for forbidden in FORBIDDEN_IN_PROMPTS:
        pattern = rf'\b{forbidden}\b'
        if re.search(pattern, prompt, re.IGNORECASE):
            violations.append(f"Forbidden field '{forbidden}' in prompt")

    return violations

# Usage in prompt building
def build_safe_prompt(content: ContentPayload) -> str:
    prompt = f"""
    Analyze the following content:

    {content.query}

    Context:
    {chr(10).join(content.context_texts)}
    """

    # Audit before returning
    violations = audit_prompt(prompt)
    if violations:
        raise PromptSecurityError(
            f"Prompt contains forbidden content: {violations}"
        )

    return prompt
```

## OrchestKit Integration Points

### Content Analysis Workflow

```python
# backend/app/workflows/agents/content_analyzer.py

async def analyze(state: AnalysisState) -> AnalysisState:
    # Context is in state, but NOT passed to prompt
    ctx = state.request_context

    # Build content-only payload
    content = ContentPayload(
        query=state.analysis_request.query,
        context_texts=[doc.content for doc in state.retrieved_docs],
        instructions=get_analysis_instructions(),
    )

    # Context payload for attribution
    context = ContextPayload(
        user_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        analysis_id=state.analysis_id,
        source_refs=[doc.id for doc in state.retrieved_docs],
        trace_id=ctx.trace_id,
    )

    result = await analyze_content(content, context)
    return state.with_result(result)
```

## Common Mistakes

```python
# ❌ BAD: ID in prompt
prompt = f"Analyze document {doc_id} for user {user_id}"

# ❌ BAD: ID in f-string
prompt = f"Context from analysis {analysis_id}:\n{context}"

# ❌ BAD: ID in instruction
prompt = f"You are analyzing for tenant {tenant_id}. Be helpful."

# ✅ GOOD: Content only
prompt = f"Analyze the following document:\n{document_content}"

# ✅ GOOD: No IDs visible
prompt = f"""
Analyze this content and provide insights:

{content}

Relevant context:
{context_texts}
"""
```

## Testing Context Separation

```python
import pytest

class TestContextSeparation:

    def test_prompt_contains_no_uuids(self):
        content = ContentPayload(
            query="What are the key concepts?",
            context_texts=["Machine learning basics..."],
            instructions="Provide clear analysis",
        )

        prompt = build_safe_prompt(content)

        assert not re.search(UUID_PATTERN, prompt)

    def test_prompt_contains_no_forbidden_fields(self):
        content = ContentPayload(...)
        prompt = build_safe_prompt(content)

        for forbidden in FORBIDDEN_IN_PROMPTS:
            assert forbidden not in prompt.lower()

    def test_audit_catches_leaked_uuid(self):
        bad_prompt = "Analyze doc 123e4567-e89b-12d3-a456-426614174000"

        violations = audit_prompt(bad_prompt)

        assert len(violations) > 0
        assert "UUID" in violations[0]
```
