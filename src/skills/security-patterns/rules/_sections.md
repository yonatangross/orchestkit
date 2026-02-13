---
title: Security Patterns Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Authentication (auth) — CRITICAL — 3 rules

Secure authentication with OAuth 2.1, JWT tokens, Passkeys, and role-based access control.

- `auth-jwt.md` — JWT creation, verification, Argon2id hashing, token expiry, refresh rotation
- `auth-oauth.md` — OAuth 2.1 with PKCE, DPoP proof-of-possession, Passkeys/WebAuthn
- `auth-rbac.md` — Role-based access control decorators, permission checks, MFA (TOTP)

## 2. Defense-in-Depth (defense) — CRITICAL — 2 rules

Multi-layer security architecture ensuring no single point of failure.

- `defense-layers.md` — 8-layer architecture: edge, gateway, input, authorization, data, LLM, output, observability
- `defense-zero-trust.md` — Immutable RequestContext, tenant-scoped repositories, audit logging

## 3. Input Validation (validation) — HIGH — 3 rules

Validate and sanitize all untrusted input using Zod v4 and Pydantic.

- `validation-input.md` — Zod v4 schemas, Pydantic models, type coercion, safeParse
- `validation-output.md` — HTML sanitization (DOMPurify, markupsafe), XSS prevention, CSP headers
- `validation-schemas.md` — Discriminated unions, file upload validation, URL domain allowlists

## 4. OWASP Top 10 (owasp) — CRITICAL — 2 rules

Protection against the most critical web application security risks.

- `owasp-injection.md` — SQL injection, command injection, SSRF, parameterized queries
- `owasp-broken-auth.md` — JWT algorithm confusion, CSRF, timing attacks, SRI

## 5. LLM Safety (llm) — HIGH — 3 rules

Security patterns for LLM integrations including prompt injection defense and output validation.

- `llm-prompt-injection.md` — Context separation, forbidden patterns, SafePromptBuilder, prompt audit
- `llm-guardrails.md` — Output validation pipeline: schema, no-IDs, grounding, safety, size
- `llm-content-filtering.md` — Pre-LLM filtering, post-LLM attribution, three-phase pattern

## 6. PII Masking (pii) — HIGH — 2 rules

PII detection and masking for LLM observability pipelines and logging.

- `pii-detection.md` — Microsoft Presidio, regex patterns, LLM Guard Anonymize scanner
- `pii-redaction.md` — Langfuse mask callback, structlog/loguru processors, Vault deanonymization
