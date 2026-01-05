---
name: defense-in-depth
description: Use when building secure AI pipelines or hardening LLM integrations. Implements 8 validation layers from edge to storage with no single point of failure.
version: 1.0.0
---

# Defense in Depth for AI Systems

## Overview

Defense in depth applies multiple security layers so that if one fails, others still protect the system. For AI applications, this means validating at every boundary: edge, gateway, input, authorization, data, LLM, output, and observability.

**Core Principle:** No single security control should be the only thing protecting sensitive operations.

## The 8-Layer Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Layer 0: EDGE           │  WAF, Rate Limiting, DDoS, Bot Detection    │
├─────────────────────────────────────────────────────────────────────────┤
│  Layer 1: GATEWAY        │  JWT Verify, Extract Claims, Build Context  │
├─────────────────────────────────────────────────────────────────────────┤
│  Layer 2: INPUT          │  Schema Validation, PII Detection, Injection│
├─────────────────────────────────────────────────────────────────────────┤
│  Layer 3: AUTHORIZATION  │  RBAC/ABAC, Tenant Check, Resource Access   │
├─────────────────────────────────────────────────────────────────────────┤
│  Layer 4: DATA ACCESS    │  Parameterized Queries, Tenant Filter       │
├─────────────────────────────────────────────────────────────────────────┤
│  Layer 5: LLM            │  Prompt Building (no IDs), Context Separation│
├─────────────────────────────────────────────────────────────────────────┤
│  Layer 6: OUTPUT         │  Schema Validation, Guardrails, Hallucination│
├─────────────────────────────────────────────────────────────────────────┤
│  Layer 7: STORAGE        │  Attribution, Audit Trail, Encryption       │
├─────────────────────────────────────────────────────────────────────────┤
│  Layer 8: OBSERVABILITY  │  Logging (sanitized), Tracing, Metrics      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Layer Details

### Layer 0: Edge Protection

**Purpose:** Stop attacks before they reach your application.

- WAF rules for OWASP Top 10
- Rate limiting per user/IP
- DDoS protection
- Bot detection
- Geo-blocking if required

### Layer 1: Gateway / Authentication

**Purpose:** Verify identity and build request context.

```python
@dataclass(frozen=True)
class RequestContext:
    """Immutable context that flows through the system"""
    # Identity
    user_id: UUID
    tenant_id: UUID
    session_id: str
    permissions: frozenset[str]

    # Tracing
    request_id: str
    trace_id: str

    # Metadata
    timestamp: datetime
    client_ip: str
```

### Layer 2: Input Validation

**Purpose:** Reject bad input early.

- **Schema validation:** Pydantic/Zod for structure
- **Content validation:** PII detection, malware scan
- **Injection defense:** SQL, XSS, prompt injection patterns

### Layer 3: Authorization

**Purpose:** Verify permission for the specific action and resource.

```python
async def authorize(ctx: RequestContext, action: str, resource: Resource) -> bool:
    # 1. Check permission exists
    if action not in ctx.permissions:
        raise Forbidden("Missing permission")

    # 2. Check tenant ownership
    if resource.tenant_id != ctx.tenant_id:
        raise Forbidden("Cross-tenant access denied")

    # 3. Check resource-level access
    if not await check_resource_access(ctx.user_id, resource):
        raise Forbidden("No access to resource")

    return True
```

### Layer 4: Data Access

**Purpose:** Ensure all queries are tenant-scoped.

```python
class TenantScopedRepository:
    def __init__(self, ctx: RequestContext):
        self.ctx = ctx
        self._base_filter = {"tenant_id": ctx.tenant_id}

    async def find(self, query: dict) -> list[Model]:
        # ALWAYS merge tenant filter
        safe_query = {**self._base_filter, **query}
        return await self.db.find(safe_query)
```

### Layer 5: LLM Orchestration

**Purpose:** Build prompts with content only, no identifiers.

- Identifiers flow AROUND the LLM, not THROUGH it
- Prompts contain only content text
- No user_id, tenant_id, document_id in prompt text
- See `llm-safety-patterns` skill for details

### Layer 6: Output Validation

**Purpose:** Validate LLM output before use.

- Schema validation (JSON structure)
- Content guardrails (toxicity, PII generation)
- Hallucination detection (grounding check)
- Code injection prevention

### Layer 7: Attribution & Storage

**Purpose:** Reattach context and store with proper attribution.

- Attribution is deterministic, not LLM-generated
- Context from Layer 1 is attached to results
- Source references from Layer 4 are attached
- Audit trail recorded

### Layer 8: Observability

**Purpose:** Monitor without leaking sensitive data.

- Structured logging with sanitization
- Distributed tracing (Langfuse)
- Metrics (latency, errors, costs)
- Alerts for anomalies

## Implementation Checklist

Before deploying any AI feature, verify:

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

## Integration with SkillForge

This skill integrates with:
- `llm-safety-patterns` - Layer 5 details
- `security-checklist` - OWASP validations
- `observability-monitoring` - Layer 8 details

---

**Version:** 1.0.0 (December 2025)
