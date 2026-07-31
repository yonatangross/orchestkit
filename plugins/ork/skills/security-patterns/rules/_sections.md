---
title: Security Patterns Rule Categories
version: 2.0.0
---

# Rule Categories

Former auth, zero-trust, LLM safety, PII, and scanning rule files were removed as
upstream restatement (wrap + delta, 2026-07-31). Their first-party sources are listed in
SKILL.md under "Upstream coverage (do not restate)"; the ork delta lives in
`references/ork-delta.md`.

## 1. Defense-in-Depth (defense), CRITICAL, 1 rule

Multi-layer security architecture ensuring no single point of failure.

- `defense-layers.md`: 8-layer architecture: edge, gateway, input, authorization, data, LLM, output, observability

## 2. Input Validation (validation), HIGH, 2 rules

Validate and sanitize all untrusted input using Zod v4 and Pydantic.

- `validation-input.md`: Zod v4 schemas, Pydantic models, type coercion, safeParse
- `validation-output.md`: HTML sanitization (DOMPurify, markupsafe), XSS prevention, CSP headers

## 3. OWASP Top 10 (owasp), CRITICAL, 1 rule

Protection against the most critical web application security risks.

- `supply-chain.md`: Lockfile integrity, dependency confusion, provenance, SBOM (A03:2025)

## 4. Advanced Guardrails (guardrails), CRITICAL, 2 rules

Production LLM safety with NeMo Guardrails, Guardrails AI, and red-teaming.

- `guardrails-nemo.md`: NeMo Guardrails, Colang 2.0, Guardrails AI validators, input/output validation
- `guardrails-llm-validation.md`: DeepTeam red-teaming, OWASP LLM Top 10 compliance, adversarial testing
