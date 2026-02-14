---
name: security-patterns
license: MIT
compatibility: "Claude Code 2.1.34+."
description: Security patterns for authentication, defense-in-depth, input validation, OWASP Top 10, LLM safety, and PII masking. Use when implementing auth flows, security layers, input sanitization, vulnerability prevention, prompt injection defense, or data redaction.
tags: [security, authentication, authorization, defense-in-depth, owasp, input-validation, llm-safety, pii-masking, jwt, oauth]
context: fork
agent: security-auditor
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: high
metadata:
  category: document-asset-creation
---

# Security Patterns

Comprehensive security patterns for building hardened applications. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Authentication](#authentication) | 3 | CRITICAL | JWT tokens, OAuth 2.1/PKCE, RBAC/permissions |
| [Defense-in-Depth](#defense-in-depth) | 2 | CRITICAL | Multi-layer security, zero-trust architecture |
| [Input Validation](#input-validation) | 3 | HIGH | Schema validation (Zod/Pydantic), output encoding, file uploads |
| [OWASP Top 10](#owasp-top-10) | 2 | CRITICAL | Injection prevention, broken authentication fixes |
| [LLM Safety](#llm-safety) | 3 | HIGH | Prompt injection defense, output guardrails, content filtering |
| [PII Masking](#pii-masking) | 2 | HIGH | PII detection/redaction with Presidio, Langfuse, LLM Guard |
| [Scanning](#scanning) | 3 | HIGH | Dependency audit, SAST (Semgrep/Bandit), secret detection |
| [Advanced Guardrails](#advanced-guardrails) | 2 | CRITICAL | NeMo/Guardrails AI validators, red-teaming, OWASP LLM |

**Total: 20 rules across 8 categories**

## Quick Start

```python
# Argon2id password hashing
from argon2 import PasswordHasher
ph = PasswordHasher()
password_hash = ph.hash(password)
ph.verify(password_hash, password)
```

```python
# JWT access token (15-min expiry)
import jwt
from datetime import datetime, timedelta, timezone
payload = {
    'sub': user_id, 'type': 'access',
    'exp': datetime.now(timezone.utc) + timedelta(minutes=15),
}
token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
```

```typescript
// Zod v4 schema validation
import { z } from 'zod';
const UserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['user', 'admin']).default('user'),
});
const result = UserSchema.safeParse(req.body);
```

```python
# PII masking with Langfuse
import re
from langfuse import Langfuse

def mask_pii(data, **kwargs):
    if isinstance(data, str):
        data = re.sub(r'\b[\w.-]+@[\w.-]+\.\w+\b', '[REDACTED_EMAIL]', data)
        data = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[REDACTED_SSN]', data)
    return data

langfuse = Langfuse(mask=mask_pii)
```

## Authentication

Secure authentication with OAuth 2.1, Passkeys/WebAuthn, JWT tokens, and role-based access control.

| Rule | Description |
|------|-------------|
| `auth-jwt.md` | JWT creation, verification, expiry, refresh token rotation |
| `auth-oauth.md` | OAuth 2.1 with PKCE, DPoP, Passkeys/WebAuthn |
| `auth-rbac.md` | Role-based access control, permission decorators, MFA |

**Key Decisions:** Argon2id > bcrypt | Access tokens 15 min | PKCE required | Passkeys > TOTP > SMS

## Defense-in-Depth

Multi-layer security architecture with no single point of failure.

| Rule | Description |
|------|-------------|
| `defense-layers.md` | 8-layer security architecture (edge to observability) |
| `defense-zero-trust.md` | Immutable request context, tenant isolation, audit logging |

**Key Decisions:** Immutable dataclass context | Query-level tenant filtering | No IDs in LLM prompts

## Input Validation

Validate and sanitize all untrusted input using Zod v4 and Pydantic.

| Rule | Description |
|------|-------------|
| `validation-input.md` | Schema validation with Zod v4 and Pydantic, type coercion |
| `validation-output.md` | HTML sanitization, output encoding, XSS prevention |
| `validation-schemas.md` | Discriminated unions, file upload validation, URL allowlists |

**Key Decisions:** Allowlist over blocklist | Server-side always | Validate magic bytes not extensions

## OWASP Top 10

Protection against the most critical web application security risks.

| Rule | Description |
|------|-------------|
| `owasp-injection.md` | SQL/command injection, parameterized queries, SSRF prevention |
| `owasp-broken-auth.md` | JWT algorithm confusion, CSRF protection, timing attacks |

**Key Decisions:** Parameterized queries only | Hardcode JWT algorithm | SameSite=Strict cookies

## LLM Safety

Security patterns for LLM integrations including context separation and output validation.

| Rule | Description |
|------|-------------|
| `llm-prompt-injection.md` | Context separation, prompt auditing, forbidden patterns |
| `llm-guardrails.md` | Output validation pipeline: schema, grounding, safety, size |
| `llm-content-filtering.md` | Pre-LLM filtering, post-LLM attribution, three-phase pattern |

**Key Decisions:** IDs flow around LLM, never through | Attribution is deterministic | Audit every prompt

## PII Masking

PII detection and masking for LLM observability pipelines and logging.

| Rule | Description |
|------|-------------|
| `pii-detection.md` | Microsoft Presidio, regex patterns, LLM Guard Anonymize |
| `pii-redaction.md` | Langfuse mask callback, structlog/loguru processors, Vault deanonymization |

**Key Decisions:** Presidio for enterprise | Replace with type tokens | Use mask callback at init

## Scanning

Automated security scanning for dependencies, code, and secrets.

| Rule | Description |
|------|-------------|
| `scanning-dependency.md` | npm audit, pip-audit, Trivy container scanning, CI gating |
| `scanning-sast.md` | Semgrep and Bandit static analysis, custom rules, pre-commit |
| `scanning-secrets.md` | Gitleaks, TruffleHog, detect-secrets with baseline management |

**Key Decisions:** Pre-commit hooks for shift-left | Block on critical/high | Gitleaks + detect-secrets baseline

## Advanced Guardrails

Production LLM safety with NeMo Guardrails, Guardrails AI validators, and DeepTeam red-teaming.

| Rule | Description |
|------|-------------|
| `guardrails-nemo.md` | NeMo Guardrails, Colang 2.0 flows, Guardrails AI validators, layered validation |
| `guardrails-llm-validation.md` | DeepTeam red-teaming (40+ vulnerabilities), OWASP LLM Top 10 compliance |

**Key Decisions:** NeMo for flows, Guardrails AI for validators | Toxicity 0.5 threshold | Red-team pre-release + quarterly

## Anti-Patterns (FORBIDDEN)

```python
# Authentication
user.password = request.form['password']       # Plaintext password storage
response_type=token                             # Implicit OAuth grant (deprecated)
return "Email not found"                        # Information disclosure

# Input Validation
"SELECT * FROM users WHERE name = '" + name + "'"  # SQL injection
if (file.type === 'image/png') {...}               # Trusting Content-Type header

# LLM Safety
prompt = f"Analyze for user {user_id}"             # ID in prompt
artifact.user_id = llm_output["user_id"]           # Trusting LLM-generated IDs

# PII
logger.info(f"User email: {user.email}")           # Raw PII in logs
langfuse.trace(input=raw_prompt)                   # Unmasked observability data
```

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [references/oauth-2.1-passkeys.md](references/oauth-2.1-passkeys.md) | OAuth 2.1, PKCE, DPoP, Passkeys/WebAuthn |
| [references/request-context-pattern.md](references/request-context-pattern.md) | Immutable request context for identity flow |
| [references/tenant-isolation.md](references/tenant-isolation.md) | Tenant-scoped repository, vector/full-text search |
| [references/audit-logging.md](references/audit-logging.md) | Sanitized structured logging, compliance |
| [references/zod-v4-api.md](references/zod-v4-api.md) | Zod v4 types, coercion, transforms, refinements |
| [references/vulnerability-demos.md](references/vulnerability-demos.md) | OWASP vulnerable vs secure code examples |
| [references/context-separation.md](references/context-separation.md) | LLM context separation architecture |
| [references/output-guardrails.md](references/output-guardrails.md) | Output validation pipeline implementation |
| [references/pre-llm-filtering.md](references/pre-llm-filtering.md) | Tenant-scoped retrieval, content extraction |
| [references/post-llm-attribution.md](references/post-llm-attribution.md) | Deterministic attribution pattern |
| [references/prompt-audit.md](references/prompt-audit.md) | Prompt audit patterns, safe prompt builder |
| [references/presidio-integration.md](references/presidio-integration.md) | Microsoft Presidio setup, custom recognizers |
| [references/langfuse-mask-callback.md](references/langfuse-mask-callback.md) | Langfuse SDK mask implementation |
| [references/llm-guard-sanitization.md](references/llm-guard-sanitization.md) | LLM Guard Anonymize/Deanonymize with Vault |
| [references/logging-redaction.md](references/logging-redaction.md) | structlog/loguru pre-logging redaction |

## Related Skills

- `api-design-framework` - API security patterns
- `rag-retrieval` - RAG pipeline patterns requiring tenant-scoped retrieval
- `llm-evaluation` - Output quality assessment including hallucination detection

## Capability Details

### authentication
**Keywords:** password, hashing, JWT, token, OAuth, PKCE, passkey, WebAuthn, RBAC, session
**Solves:**
- Implement secure authentication with modern standards
- JWT token management with proper expiry
- OAuth 2.1 with PKCE flow
- Passkeys/WebAuthn registration and login
- Role-based access control

### defense-in-depth
**Keywords:** defense in depth, security layers, multi-layer, request context, tenant isolation
**Solves:**
- How to secure AI applications end-to-end
- Implement 8-layer security architecture
- Create immutable request context
- Ensure tenant isolation at query level

### input-validation
**Keywords:** schema, validate, Zod, Pydantic, sanitize, HTML, XSS, file upload
**Solves:**
- Validate input against schemas (Zod v4, Pydantic)
- Prevent injection attacks with allowlists
- Sanitize HTML and prevent XSS
- Validate file uploads by magic bytes

### owasp-top-10
**Keywords:** OWASP, sql injection, broken access control, CSRF, XSS, SSRF
**Solves:**
- Fix OWASP Top 10 vulnerabilities
- Prevent SQL and command injection
- Implement CSRF protection
- Fix broken authentication

### llm-safety
**Keywords:** prompt injection, context separation, guardrails, hallucination, LLM output
**Solves:**
- Prevent prompt injection attacks
- Implement context separation (IDs around LLM)
- Validate LLM output with guardrail pipeline
- Deterministic post-LLM attribution

### pii-masking
**Keywords:** PII, masking, Presidio, Langfuse, redact, GDPR, privacy
**Solves:**
- Detect and mask PII in LLM pipelines
- Integrate masking with Langfuse observability
- Implement pre-logging redaction
- GDPR-compliant data handling
