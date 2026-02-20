---
title: Design defense-in-depth with eight security layers from edge protection to observability
category: defense
impact: CRITICAL
impactDescription: "Ensures defense-in-depth with 8 security layers from edge protection to observability"
tags: defense-in-depth, security-layers, waf, authorization, validation
---

# 8-Layer Security Architecture

## Overview

Defense in depth applies multiple security layers so that if one fails, others still protect the system.

**Core Principle:** No single security control should be the only thing protecting sensitive operations.

## The Architecture

```
Layer 0: EDGE           | WAF, Rate Limiting, DDoS, Bot Detection
Layer 1: GATEWAY        | JWT Verify, Extract Claims, Build Context
Layer 2: INPUT          | Schema Validation, PII Detection, Injection Defense
Layer 3: AUTHORIZATION  | RBAC/ABAC, Tenant Check, Resource Access
Layer 4: DATA ACCESS    | Parameterized Queries, Tenant Filter
Layer 5: LLM            | Prompt Building (no IDs), Context Separation
Layer 6: OUTPUT         | Schema Validation, Guardrails, Hallucination Check
Layer 7: STORAGE        | Attribution, Audit Trail, Encryption
Layer 8: OBSERVABILITY  | Logging (sanitized), Tracing, Metrics
```

## Layer Details

### Layer 0: Edge Protection
- WAF rules for OWASP Top 10
- Rate limiting per user/IP
- DDoS protection
- Bot detection and geo-blocking

### Layer 1: Gateway / Authentication

```python
@dataclass(frozen=True)
class RequestContext:
    """Immutable context that flows through the system"""
    user_id: UUID
    tenant_id: UUID
    session_id: str
    permissions: frozenset[str]
    request_id: str
    trace_id: str
    timestamp: datetime
    client_ip: str
```

### Layer 2: Input Validation
- **Schema validation:** Pydantic/Zod for structure
- **Content validation:** PII detection, malware scan
- **Injection defense:** SQL, XSS, prompt injection patterns

### Layer 3: Authorization

```python
async def authorize(ctx: RequestContext, action: str, resource: Resource) -> bool:
    if action not in ctx.permissions:
        raise Forbidden("Missing permission")
    if resource.tenant_id != ctx.tenant_id:
        raise Forbidden("Cross-tenant access denied")
    if not await check_resource_access(ctx.user_id, resource):
        raise Forbidden("No access to resource")
    return True
```

### Layer 4: Data Access

```python
class TenantScopedRepository:
    def __init__(self, ctx: RequestContext):
        self.ctx = ctx
        self._base_filter = {"tenant_id": ctx.tenant_id}

    async def find(self, query: dict) -> list[Model]:
        safe_query = {**self._base_filter, **query}
        return await self.db.find(safe_query)
```

### Layer 5: LLM Orchestration
- Identifiers flow AROUND the LLM, not THROUGH it
- Prompts contain only content text
- No user_id, tenant_id, document_id in prompt text

### Layer 6: Output Validation
- Schema validation (JSON structure)
- Content guardrails (toxicity, PII generation)
- Hallucination detection (grounding check)

### Layer 7: Attribution & Storage
- Attribution is deterministic, not LLM-generated
- Context from Layer 1 is attached to results
- Audit trail recorded

### Layer 8: Observability
- Structured logging with sanitization
- Distributed tracing (Langfuse)
- Metrics (latency, errors, costs)

## Implementation Checklist

- [ ] Layer 0: Rate limiting configured
- [ ] Layer 1: JWT validation active, RequestContext created
- [ ] Layer 2: Pydantic models validate all input
- [ ] Layer 3: Authorization check on every endpoint
- [ ] Layer 4: All queries include tenant_id filter
- [ ] Layer 5: No IDs in LLM prompts (run audit)
- [ ] Layer 6: Output schema validation active
- [ ] Layer 7: Attribution uses context, not LLM output
- [ ] Layer 8: Logging sanitized, tracing enabled

## Industry Sources

| Pattern | Source | Application |
|---------|--------|-------------|
| Defense in Depth | NIST | Multiple validation layers |
| Zero Trust | Google BeyondCorp | Every request verified |
| Least Privilege | AWS IAM | Minimal permissions |
| Complete Mediation | Saltzer & Schroeder | Every access checked |

**Incorrect — Single-layer auth check is vulnerable if JWT verification is bypassed:**
```python
@app.get("/documents/{doc_id}")
def get_document(doc_id: UUID, token: str = Header(...)):
    claims = verify_jwt(token)  # Only layer
    return db.query(Document).get(doc_id)
```

**Correct — Multi-layer defense verifies auth, validates input, checks authorization, and filters data:**
```python
@app.get("/documents/{doc_id}")
async def get_document(doc_id: UUID, ctx: RequestContext = Depends(get_context)):
    # Layer 1: Gateway verified JWT
    # Layer 2: UUID validation (Pydantic)
    # Layer 3: Authorization
    await authorize(ctx, "documents:read", doc_id)
    # Layer 4: Tenant-scoped query
    repo = TenantScopedRepository(db, ctx, Document)
    return await repo.find_by_id(doc_id)
```
