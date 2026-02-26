---
title: "LLM: Content Filtering & Three-Phase Pattern"
category: llm
impact: HIGH
impactDescription: "Prevents LLM data leakage by separating content from identifiers across pre-LLM, LLM call, and post-LLM phases"
tags: llm-security, three-phase, content-filtering, attribution
---

# Content Filtering & Three-Phase Pattern

## The Three-Phase Pattern

```
Phase 1: PRE-LLM     | Filter data, extract content, save refs
Phase 2: LLM CALL    | Content-only prompt, no identifiers
Phase 3: POST-LLM    | Validate output, attach attribution
```

## Phase 1: Pre-LLM (Filter & Extract)

```python
async def prepare_for_llm(query: str, ctx: RequestContext):
    # 1. Retrieve with tenant filter
    documents = await semantic_search(
        query_embedding=embed(query),
        ctx=ctx,  # Filters by tenant_id, user_id
    )

    # 2. Save references for attribution
    source_refs = SourceRefs(
        document_ids=[d.id for d in documents],
        chunk_ids=[c.id for c in chunks],
    )

    # 3. Extract content only (no IDs)
    content_texts = [strip_identifiers(d.content) for d in documents]

    return query, content_texts, source_refs

def strip_identifiers(text: str) -> str:
    """Remove any IDs from content."""
    text = re.sub(UUID_PATTERN, '[REDACTED]', text, flags=re.IGNORECASE)
    for pattern in [r'user_id:\s*\S+', r'tenant_id:\s*\S+']:
        text = re.sub(pattern, '[REDACTED]', text, flags=re.IGNORECASE)
    return text
```

## Phase 2: LLM Call (Content Only)

```python
def build_prompt(content: str, context_texts: list[str]) -> str:
    prompt = f"""
    Analyze the following content and provide insights.

    CONTENT:
    {content}

    RELEVANT CONTEXT:
    {chr(10).join(f"- {text}" for text in context_texts)}
    """

    # AUDIT: Verify no IDs leaked
    violations = audit_prompt(prompt)
    if violations:
        raise SecurityError(f"IDs leaked to prompt: {violations}")

    return prompt

async def call_llm(prompt: str) -> dict:
    """LLM only sees content, never IDs."""
    response = await llm.generate(prompt)
    return parse_response(response)
```

## Phase 3: Post-LLM (Attribute)

```python
async def save_with_attribution(
    llm_output: dict, ctx: RequestContext, source_refs: SourceRefs,
) -> Analysis:
    """Attribution is DETERMINISTIC, not LLM-generated."""

    # Validate no IDs in output
    if re.search(UUID_PATTERN, str(llm_output)):
        raise SecurityError("LLM output contains hallucinated IDs")

    return await Analysis.create(
        id=uuid4(),                                    # We generate
        user_id=ctx.user_id,                           # From context
        tenant_id=ctx.tenant_id,                       # From context
        trace_id=ctx.trace_id,                         # From context
        source_document_ids=source_refs.document_ids,  # From pre-LLM
        content=llm_output["analysis"],                # From LLM
        key_concepts=llm_output["key_concepts"],       # From LLM
        created_at=datetime.now(timezone.utc),
    )
```

## Complete Workflow

```python
async def safe_analyze(query: str, ctx: RequestContext, db_session):
    # Phase 1: Pre-LLM
    content, source_refs = await prepare_for_llm(query, ctx, db_session)

    # Phase 2: LLM Call
    prompt = build_prompt(content)
    llm_output = await call_llm(prompt, AnalysisOutput)

    # Phase 3: Post-LLM
    result = await attribute_and_save(
        llm_output=llm_output, ctx=ctx,
        source_refs=source_refs, db_session=db_session,
    )
    return result
```

## Output Validation

After LLM returns, validate:

```python
async def validate_output(llm_output: dict, context_texts: list[str]):
    # 1. Schema validation
    parsed = AnalysisOutput.model_validate(llm_output)

    # 2. Guardrails
    if await contains_toxic_content(parsed.content):
        return ValidationResult(valid=False, reason="Toxic content")

    # 3. Grounding check
    if not is_grounded(parsed.content, context_texts):
        return ValidationResult(valid=False, reason="Ungrounded claims")

    # 4. No hallucinated IDs
    if contains_uuid_pattern(parsed.content):
        return ValidationResult(valid=False, reason="Hallucinated IDs")

    return ValidationResult(valid=True)
```

## Common Mistakes

```python
# BAD: Asking LLM for attribution
prompt = "Analyze this and tell me which document it came from"
doc_id = response["source_document"]  # HALLUCINATED!

# BAD: Trusting LLM-provided IDs
artifact.user_id = llm_output["user_id"]  # WRONG!

# GOOD: Attribution from our records
artifact.user_id = ctx.user_id         # From JWT
artifact.sources = source_refs.doc_ids  # From pre-LLM
artifact.id = uuid4()                   # We generate
```

## Checklist Before Any LLM Call

- [ ] RequestContext available
- [ ] Data filtered by tenant_id and user_id
- [ ] Content extracted without IDs
- [ ] Source references saved
- [ ] Prompt passes audit
- [ ] Output validated before use
- [ ] Attribution uses context, not LLM output

**Incorrect — Asking LLM for attribution leads to hallucinated document IDs:**
```python
prompt = f"Analyze this content and cite which documents support each claim."
response = await llm.generate(prompt)
# Save with LLM-generated document IDs
artifact.source_ids = response["document_ids"]  # HALLUCINATED!
```

**Correct — Save source references before LLM call, attach deterministically after:**
```python
# Phase 1: Save refs before LLM
docs = await semantic_search(query, ctx)
source_refs = [d.id for d in docs]
# Phase 2: LLM sees only content
response = await llm.generate(content_only_prompt)
# Phase 3: Attach saved refs
artifact.source_ids = source_refs  # From our records, not LLM
```
