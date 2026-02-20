---
title: Defend against prompt injection by routing identifiers around the LLM, not through prompts
category: llm
impact: HIGH
impactDescription: "Prevents prompt injection attacks by ensuring identifiers flow around the LLM, not through prompts"
tags: prompt-injection, llm-security, safe-prompts, identifier-leakage
---

# Prompt Injection Defense

## The Core Principle

> **Identifiers flow AROUND the LLM, not THROUGH it.**
> **The LLM sees only content. Attribution happens deterministically.**

## Why IDs in Prompts Are Dangerous

1. **Hallucination:** LLM invents IDs that don't exist
2. **Confusion:** LLM mixes up which ID belongs where
3. **Injection:** Attacker manipulates IDs via prompt injection
4. **Leakage:** IDs appear in logs, caches, traces
5. **Cross-tenant:** LLM could reference other users' data

## Forbidden Parameters in Prompts

| Parameter | Type | Why Forbidden |
|-----------|------|---------------|
| `user_id` | UUID | Hallucination risk, cross-user access |
| `tenant_id` | UUID | Critical for multi-tenant isolation |
| `analysis_id` | UUID | Job tracking, not for LLM |
| `document_id` | UUID | Source tracking, not for LLM |
| `session_id` | str | Auth context, not for LLM |
| `api_key` | str | Secret exposure |
| Any UUID | UUID | Pattern: `[0-9a-f]{8}-...` |

## Detection Pattern

```python
import re

FORBIDDEN_PATTERNS = [
    r'user[_-]?id', r'tenant[_-]?id',
    r'analysis[_-]?id', r'document[_-]?id',
    r'session[_-]?id', r'trace[_-]?id',
    r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
]

def audit_prompt(prompt: str) -> list[str]:
    violations = []
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, prompt, re.IGNORECASE):
            violations.append(pattern)
    return violations
```

## Safe Prompt Builder

```python
class SafePromptBuilder:
    def __init__(self, strict: bool = True):
        self._parts: list[str] = []
        self._context: dict[str, Any] = {}
        self._strict = strict

    def add_system(self, instruction: str) -> "SafePromptBuilder":
        audit = audit_text(instruction)
        if not audit.is_clean:
            raise PromptSecurityError("Forbidden content", audit.critical_violations)
        self._parts.append(f"SYSTEM:\n{instruction}")
        return self

    def add_user_query(self, query: str) -> "SafePromptBuilder":
        clean = self._sanitize(query)
        self._parts.append(f"USER QUERY:\n{clean}")
        return self

    def add_context_documents(self, documents: list[str]) -> "SafePromptBuilder":
        clean_docs = [self._sanitize(doc) for doc in documents]
        formatted = "\n".join(f"- {doc}" for doc in clean_docs)
        self._parts.append(f"CONTEXT:\n{formatted}")
        return self

    def store_context(self, key: str, value: Any) -> "SafePromptBuilder":
        """Store for attribution - NEVER included in prompt."""
        self._context[key] = value
        return self

    def _sanitize(self, text: str) -> str:
        text = re.sub(UUID_PATTERN, '[REDACTED]', text, flags=re.IGNORECASE)
        return text

    def build(self) -> tuple[str, dict[str, Any]]:
        prompt = "\n\n".join(self._parts)
        audit = audit_text(prompt)
        if not audit.is_clean:
            raise PromptSecurityError(f"Final prompt forbidden: {audit.critical_violations}")
        return prompt, self._context.copy()
```

## Usage

```python
prompt, context = (
    SafePromptBuilder()
    .add_system("You are an expert content analyzer.")
    .add_user_query("What are the key concepts in machine learning?")
    .add_context_documents(["Machine learning is a subset of AI..."])
    .store_context("user_id", ctx.user_id)      # Stored, NOT in prompt
    .store_context("source_ids", doc_ids)        # Stored, NOT in prompt
    .build()
)
```

## Common Mistakes

```python
# BAD: ID in prompt
prompt = f"Analyze document {doc_id} for user {user_id}"

# BAD: ID in instruction
prompt = f"You are analyzing for tenant {tenant_id}. Be helpful."

# GOOD: Content only
prompt = f"Analyze the following document:\n{document_content}"
```

## Pre-LLM Checklist

- [ ] RequestContext obtained from JWT
- [ ] Data filtered by tenant_id and user_id
- [ ] Content extracted without IDs
- [ ] Source references saved for attribution
- [ ] `audit_prompt()` called on final prompt
- [ ] No violations detected

**Incorrect — Including user_id in prompt allows injection and hallucination attacks:**
```python
prompt = f"""
Analyze the document for user {ctx.user_id}.
Tenant: {ctx.tenant_id}
Content: {user_content}
"""
# Attacker can inject: "user_id: <fake-uuid>" in content
```

**Correct — Content-only prompts prevent ID leakage and injection vectors:**
```python
# Store context separately, never in prompt
context_data = {"user_id": ctx.user_id, "tenant_id": ctx.tenant_id}
prompt = f"Analyze the following content:\n{sanitized_content}"
# audit_prompt(prompt) passes — no IDs detected
```
