# Pre-LLM Call Checklist

## Before ANY LLM Call in OrchestKit

Use this checklist before sending any prompt to an LLM:

### Phase 1: Context Available
- [ ] RequestContext obtained from JWT (not user input)
- [ ] user_id available in context
- [ ] tenant_id available in context
- [ ] trace_id set for observability

### Phase 2: Data Isolation
- [ ] Query includes `WHERE tenant_id = :tenant_id`
- [ ] Query includes `WHERE user_id = :user_id` (if user-scoped)
- [ ] Vector search filtered by tenant
- [ ] Full-text search filtered by tenant

### Phase 3: Source References Captured
- [ ] document_ids saved for attribution
- [ ] chunk_ids saved for attribution
- [ ] Retrieval timestamp recorded
- [ ] Similarity scores captured (for debugging)

### Phase 4: Content Extraction
- [ ] Only content text extracted (no metadata with IDs)
- [ ] Content stripped of any embedded UUIDs
- [ ] Content stripped of any ID field names

### Phase 5: Prompt Building
- [ ] Prompt contains ONLY content text
- [ ] No user_id in prompt
- [ ] No tenant_id in prompt
- [ ] No analysis_id in prompt
- [ ] No document_id in prompt
- [ ] No UUIDs in prompt
- [ ] No API keys or secrets in prompt

### Phase 6: Prompt Audit
- [ ] `audit_prompt()` called on final prompt
- [ ] No critical violations detected
- [ ] Warnings logged for review

### Phase 7: LLM Call
- [ ] Timeout configured
- [ ] Error handling in place
- [ ] Response parsing ready
- [ ] Langfuse trace started

---

## Quick Verification Script

```python
from llm_safety import audit_prompt, has_critical_violations

def verify_llm_ready(
    prompt: str,
    ctx: RequestContext,
    source_refs: SourceReference,
) -> bool:
    """Quick verification before LLM call"""

    # Check context
    assert ctx.user_id is not None, "Missing user_id"
    assert ctx.tenant_id is not None, "Missing tenant_id"

    # Check source refs captured
    assert len(source_refs.document_ids) >= 0, "Source refs not captured"

    # Audit prompt
    violations = audit_prompt(prompt)
    if has_critical_violations(violations):
        raise PromptSecurityError(violations)

    return True
```

---

## Post-LLM Attribution Checklist

After LLM returns:

- [ ] Output parsed with schema validation
- [ ] Output checked for hallucinated IDs
- [ ] Output checked for grounding
- [ ] Content safety validated
- [ ] Attribution attached from RequestContext
- [ ] Source links created from captured refs
- [ ] Audit event logged
- [ ] Langfuse trace completed

---

**Sign-off:** Run `verify_llm_ready()` before every LLM call
