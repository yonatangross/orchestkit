---
name: security-patterns
license: MIT
compatibility: "Claude Code 2.1.220+."
description: Security patterns for authentication, defense-in-depth, input validation, OWASP Top 10, LLM safety, and PII masking. Use when implementing auth flows, security layers, input sanitization, vulnerability prevention, prompt injection defense, or data redaction.
tags: [security, authentication, authorization, defense-in-depth, owasp, input-validation, llm-safety, pii-masking, jwt, oauth]
context: fork
agent: security-auditor
version: 2.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: high
persuasion-type: discipline
effort: high
model: opus
hooks:
  PreToolUse:
    - matcher: "Bash"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs pretool/bash/dangerous-command-blocker"
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
paths: ["src/**/auth/**", "src/**/middleware/**", "**/*security*"]
path_patterns: ["**/auth/**", "**/middleware/**", "**/security/**", ".env*"]
---

# Security Patterns

Comprehensive security patterns for building hardened applications. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Authentication](#authentication) | upstream | CRITICAL | JWT tokens, OAuth 2.1/PKCE, RBAC/permissions |
| [Defense-in-Depth](#defense-in-depth) | 1 | CRITICAL | Multi-layer security, zero-trust architecture |
| [Input Validation](#input-validation) | 2 | HIGH | Schema validation (Zod/Pydantic), output encoding, file uploads |
| [OWASP Top 10](#owasp-top-10) | 1 | CRITICAL | Injection prevention, broken authentication fixes |
| [LLM Safety](#llm-safety) | refs | HIGH | Prompt injection defense, output guardrails, content filtering |
| [PII Masking](#pii-masking) | refs | HIGH | PII detection/redaction with Presidio, Langfuse, LLM Guard |
| [Scanning](#scanning) | upstream | HIGH | Dependency audit, SAST (Semgrep/Bandit), secret detection |
| [Advanced Guardrails](#advanced-guardrails) | 2 | CRITICAL | NeMo/Guardrails AI validators, red-teaming, OWASP LLM |

**Total: 6 rule files across 4 categories.** Topics marked "upstream" or "refs" keep only
the ork delta here: floors and key decisions in this file, scars and house decisions in
`references/ork-delta.md`, and first-party sources in
[Upstream coverage](#upstream-coverage-do-not-restate).

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
  email: z.email(),
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

Implementation tutorials for JWT, OAuth 2.1/PKCE/DPoP, Passkeys/WebAuthn, RBAC, and MFA
are upstream-covered (see [Upstream coverage](#upstream-coverage-do-not-restate)). The
ork delta, including the argon2-cffi-over-passlib scar, lives in `references/ork-delta.md`.

**Key Decisions:** Argon2id > bcrypt | Access tokens 15 min | PKCE required | Passkeys > TOTP > SMS

## Defense-in-Depth

Multi-layer security architecture with no single point of failure.

| Rule | Description |
|------|-------------|
| `defense-layers.md` | 8-layer security architecture (edge to observability) |

Zero-trust and tenant-isolation implementation recipes (tenant-scoped repositories,
RLS, tenant-keyed caches) are upstream-covered; the immutable RequestContext pattern
survives in `references/request-context-pattern.md` and sanitized audit logging in
`references/audit-logging.md`.

**Key Decisions:** Immutable dataclass context | Query-level tenant filtering | No IDs in LLM prompts

### `sandbox.network.deniedDomains` (CC 2.1.113+)

Network-layer blocklist enforced before Bash/WebFetch egress — pair with the hook-layer `DENY_PATTERNS` for defense in depth. Settings example:

```json
"sandbox": {
  "network": {
    "deniedDomains": ["*.evil.com", "pastebin.com", "transfer.sh"]
  }
}
```

Wildcards supported (`*.example.com`, `evil.com/*/malicious/*`). Plugins ship a baseline list in `src/settings/ork.settings.json`; project settings can extend it. Use for: prompt-injection exfil sinks, known-bad registries, paste services that bypass audit.

### `sandbox.credentials` (CC 2.1.187+)

Blocks sandboxed Bash from reading credential **files** and secret **env vars** — defense-in-depth beside `sandbox.filesystem.denyRead`. Deny-only and merged across scopes (any scope can add, none can remove); older CC ignores the key. Settings example:

```json
"sandbox": {
  "credentials": {
    "files": [{ "path": "~/.aws/credentials", "mode": "deny" }],
    "envVars": [{ "name": "GITHUB_TOKEN", "mode": "deny" }]
  }
}
```

Plugins ship a baseline in `src/settings/ork.settings.json` (denies `~/.aws/credentials`, `~/.ssh`, `~/.gnupg`, `~/.netrc`, `~/.npmrc` plus the token env vars that can hijack git-push auth). Pair with `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` to scrub all subprocess credentials regardless of sandboxing.

**Masking instead of denial (CC 2.1.224+).** Beyond `mode: deny`, credentials can be masked so the command still runs against a redacted value: `extract` plus `onExtractNoMatch` pulls a secret out of a structured env value, `decode: "jwt"` with `maskClaims` masks named JWT claims, and `awsPairs`/`sigv4` re-signs AWS SigV4 requests after masking. Two constraints decide whether these are usable at all:

- They require `sandbox.network.tlsTerminate`, so they only apply to traffic CC terminates.
- They are honored **only** from user settings, managed settings, or `--settings`. A value shipped by a plugin or set in project `.claude/settings.json` is ignored, so ork cannot ship these as a baseline the way it ships the deny list. Document them for operators; do not add them to `src/settings/ork.settings.json` expecting them to take effect.

**Never write a deny path with a trailing slash.** Through CC 2.1.223, a `sandbox.filesystem` deny entry ending in `/` (for example `denyRead: "~/.aws/"`) was silently bypassable on Linux and macOS: the rule parsed, reported clean, and protected nothing. Fixed in 2.1.224, but the shape is still worth avoiding because it reads as protection either way. ork's shipped values (`~/.aws/credentials`, `~/.ssh/*`, `~/.gnupg/*`) were never affected.

## Input Validation

Validate and sanitize all untrusted input using Zod v4 and Pydantic.

| Rule | Description |
|------|-------------|
| `validation-input.md` | Schema validation with Zod v4 and Pydantic, type coercion |
| `validation-output.md` | HTML sanitization, output encoding, XSS prevention |

Advanced schema recipes (discriminated unions, file upload validation, URL allowlists)
and the full Zod v4 API are upstream-covered; the Zod v4-not-v3 trap list is in
`references/ork-delta.md`, and typed schema examples in `scripts/validation-schemas.ts`.

**Key Decisions:** Allowlist over blocklist | Server-side always | Validate magic bytes not extensions

## OWASP Top 10

Protection against the most critical web application security risks.

| Rule | Description |
|------|-------------|
| `supply-chain.md` | Lockfile integrity, dependency confusion, provenance, SBOM (A03:2025) |

Injection prevention (SQL/command/SSRF) and broken-auth fixes (JWT algorithm confusion,
CSRF, timing attacks) plus vulnerable-vs-secure demos are upstream-covered; see
[Upstream coverage](#upstream-coverage-do-not-restate).

**Key Decisions:** Parameterized queries only | Hardcode JWT algorithm | SameSite=Strict cookies

## LLM Safety

Security patterns for LLM integrations including context separation and output validation.

| Reference | Description |
|-----------|-------------|
| `references/context-separation.md` | Context separation architecture, forbidden patterns |
| `references/prompt-audit.md` | Prompt auditing, safe prompt builder |
| `references/output-guardrails.md` | Output validation pipeline: schema, grounding, safety, size |
| `references/pre-llm-filtering.md` | Tenant-scoped retrieval, content extraction |
| `references/post-llm-attribution.md` | Deterministic attribution (three-phase pattern) |

**Key Decisions:** IDs flow around LLM, never through | Attribution is deterministic | Audit every prompt

### Context Separation (CRITICAL)

Sensitive IDs and data flow AROUND the LLM, never through it. The LLM sees only content — mapping back to entities happens deterministically after.

```python
# CORRECT: IDs bypass the LLM
context = {"user_id": user_id, "tenant_id": tenant_id}  # kept server-side
llm_input = f"Summarize this document:\n{doc_text}"       # no IDs in prompt
llm_output = call_llm(llm_input)
result = {"summary": llm_output, **context}               # IDs reattached after
```

### Output Validation Pipeline

Every LLM response MUST pass a 4-stage guardrail pipeline before reaching the user:

```python
def validate_llm_output(raw_output: str, schema, sources: list[str]) -> str:
    # 1. Schema — does it match expected structure?
    parsed = schema.parse(raw_output)
    # 2. Grounding — are claims supported by source documents?
    assert_grounded(parsed, sources)
    # 3. Safety — toxicity, PII leakage, prompt leakage
    assert_safe(parsed, max_toxicity=0.5)
    # 4. Size — prevent token-bomb responses
    assert len(parsed.text) < MAX_OUTPUT_CHARS
    return parsed.text
```

## PII Masking

PII detection and masking for LLM observability pipelines and logging.

| Reference | Description |
|-----------|-------------|
| `references/presidio-integration.md` | Microsoft Presidio setup, custom recognizers |
| `references/langfuse-mask-callback.md` | Langfuse SDK mask implementation |

LLM Guard Anonymize/Deanonymize with Vault and structlog/loguru redaction processors are
upstream-covered; see [Upstream coverage](#upstream-coverage-do-not-restate).

**Key Decisions:** Presidio for enterprise | Replace with type tokens | Use mask callback at init

## Scanning

Automated security scanning for dependencies, code, and secrets. Tool tutorials
(npm audit, pip-audit, Trivy, Semgrep, Bandit, Gitleaks, TruffleHog, detect-secrets)
are upstream-covered; the runnable house pipeline is `scripts/scan-vulnerabilities.sh`,
and the enforced-not-advisory repo gates (pre-push security suite, CI gitleaks) are
recorded in `references/ork-delta.md`.

**Key Decisions:** Pre-commit hooks for shift-left | Block on critical/high | Gitleaks + detect-secrets baseline

## Advanced Guardrails

Production LLM safety with NeMo Guardrails, Guardrails AI validators, and DeepTeam red-teaming.

| Rule | Description |
|------|-------------|
| `guardrails-nemo.md` | NeMo Guardrails, Colang 2.0 flows, Guardrails AI validators, layered validation |
| `guardrails-llm-validation.md` | DeepTeam red-teaming (40+ vulnerabilities), OWASP LLM Top 10 compliance |

**Key Decisions:** NeMo for flows, Guardrails AI for validators | Toxicity 0.5 threshold | Red-team pre-release + quarterly

## Upstream coverage (do not restate)

These topics were removed from this skill as vendor restatement. Consult the first-party
source; only the ork delta (floors, scars, house decisions) lives here, in
`references/ork-delta.md`.

| Topic | First-party source |
|-------|--------------------|
| JWT implementation + password hashing (PyJWT, Argon2id) | https://pyjwt.readthedocs.io/ + https://argon2-cffi.readthedocs.io/ |
| OAuth 2.1, PKCE, DPoP, Passkeys/WebAuthn flows | https://oauth.net/2.1/ + https://www.w3.org/TR/webauthn-3/ + https://github.com/duo-labs/py_webauthn |
| RBAC decorators, MFA/TOTP, rate limiting, auth checklists | OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/ (Authentication, Session Management, MFA) |
| Zero-trust tenant isolation (tenant-scoped repos, RLS, tenant-keyed caches) | PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html + OWASP LLM08: https://genai.owasp.org/ |
| Zod v4 API + validation recipes (coercion, unions, file/URL schemas) | https://zod.dev (context7: /colinhacks/zod) + https://docs.pydantic.dev/ |
| OWASP Top 10 vulnerable-vs-secure examples (injection, XSS, CSRF, JWT confusion, timing) | https://owasp.org/Top10/ + https://cheatsheetseries.owasp.org/ |
| LLM prompt-injection defense + output guardrail tutorials | OWASP LLM Top 10: https://genai.owasp.org/llm-top-10/ |
| PII sanitization with LLM Guard (Anonymize/Deanonymize/Vault) | https://protectai.github.io/llm-guard/ |
| Pre-logging redaction with structlog/loguru | https://www.structlog.org/ + https://loguru.readthedocs.io/ |
| Dependency, secret, and SAST scanning tools | https://semgrep.dev/docs/ + https://github.com/gitleaks/gitleaks + https://trufflesecurity.com/trufflehog + https://bandit.readthedocs.io/ |

## Managed Hook Hierarchy (CC 2.1.49)

Plugin settings follow a 3-tier precedence:

| Tier | Source | Overridable? |
|------|--------|-------------|
| 1. Managed (plugin `settings.json`) | Plugin author ships defaults | Yes, by user |
| 2. Project (`.claude/settings.json`) | Repository config | Yes, by user |
| 3. User (`~/.claude/settings.json`) | Personal preferences | Final authority |

Security hooks shipped by OrchestKit are **managed defaults** — users can disable them but are warned. Enterprise admins can lock settings via managed profiles.

> **CC 2.1.166 — managed-settings enforcement fix:** before 2.1.166 a single invalid entry in managed settings silently disabled enforcement of *all* remaining valid policies — one typo could void your entire security lockdown. Require 2.1.166+ when relying on managed profiles, and validate the file before deploying it. The same release fixed `allowedMcpServers`/`deniedMcpServers` predicates not matching when they use `${VAR}` references.

> **CC 2.1.160 — write prompts:** Claude Code now prompts before writing shell startup files (`.zshenv`, `.zlogin`, `.bash_login`, `~/.config/git/`) and — under `acceptEdits` — build-tool configs that grant code execution (`.npmrc`, `.yarnrc*`, `bunfig.toml`, `.bazelrc`, `.pre-commit-config.yaml`, `.devcontainer/`). Treat these as defense-in-depth defaults: approve deliberately rather than blanket-allowing.

> **Permission-rule semantics (≥ 2.1.166):** `allow`/`ask`/`deny` rules gained security-relevant behavior — `Read` deny now hides files from Glob/Grep, deny tool-names accept globs (`"*"` = default-deny), explicit `WebFetch(domain:…)` overrides the preapproved-host auto-allow, relayed `SendMessage` from other sessions carries no authority, and org-managed rules apply for the whole session. See `references/cc-permission-model.md` for the full model + a recommended baseline `settings.json`.

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

Load on demand with `Read("${CLAUDE_PLUGIN_ROOT}/skills/security-patterns/references/<file>")`:

| File | Content |
|------|---------|
| `ork-delta.md` | Ork-specific scars and house decisions rescued from removed upstream restatement |
| `cc-permission-model.md` | CC allow/ask/deny rule semantics (≥2.1.166): Read-deny hides from Glob/Grep, deny-globs, WebFetch precedence, cross-session auth, org-managed rules |
| `request-context-pattern.md` | Immutable request context for identity flow |
| `audit-logging.md` | Sanitized structured logging, compliance |
| `context-separation.md` | LLM context separation architecture |
| `output-guardrails.md` | Output validation pipeline implementation |
| `pre-llm-filtering.md` | Tenant-scoped retrieval, content extraction |
| `post-llm-attribution.md` | Deterministic attribution pattern |
| `prompt-audit.md` | Prompt audit patterns, safe prompt builder |
| `presidio-integration.md` | Microsoft Presidio setup, custom recognizers |
| `langfuse-mask-callback.md` | Langfuse SDK mask implementation |

## Related Skills

- `api-design-framework` - API security patterns
- `ork:rag-retrieval` - RAG pipeline patterns requiring tenant-scoped retrieval
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

### cc-subprocess-hardening (CC 2.1.98)
**Keywords:** subprocess, sandbox, PID namespace, env scrub, script caps
**Solves:**
- Limit runaway hook scripts: `CLAUDE_CODE_SCRIPT_CAPS=100`
- Strip credentials from subprocesses: `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1`
- PID namespace isolation on Linux for subprocess sandboxing
- Prevent Bash permission bypasses via backslash escapes and compound commands

> **CC 2.1.128 — SDK host "Always allow" persistence**: when a user picks "Always allow" from a Bash permission prompt in an SDK host, the grant now persists via `.claude/settings.local.json` instead of evaporating at session end. Audit your SDK consumers' `.gitignore` to confirm `.claude/settings.local.json` is excluded — committing it leaks per-developer Bash auth grants. Project-committed `.claude/settings.json` is unchanged; only the user-machine-local file receives the new entries.

> **CC 2.1.169 — managed MCP enforcement + OTEL cert-path trust:** two policy-bypass classes closed. Enterprise `allowedMcpServers`/`deniedMcpServers` policies were NOT enforced on reconnect, IDE-typed configs, `--mcp-config` servers in the first post-install session, or before remote settings loaded — treat any pre-2.1.169 managed-MCP audit as incomplete on those paths. And untrusted project settings could set OTEL client-certificate paths without trust confirmation (a cloned repo could point telemetry at an attacker cert); now gated behind trust. Both fixes are active at ork's floor (2.1.220).

> **CC 2.1.163 — home-path deny rules now cover `$HOME` Bash refs**: before this fix a `Read(~/.ssh/**)`-style deny rule blocked the Read tool but NOT a Bash command that reached the same file via `$HOME/.ssh/...` — a silent secrets-read bypass. If you gate home-directory secrets (e.g. `~/.aws/credentials`, `~/.ssh/*`, `~/.gnupg/*`) through permission deny rules, pin your CC floor to `>= 2.1.163`; older builds (`< 2.1.163`) leave the Bash path open — ork's floor is now `2.1.220`, which already includes this fix.

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
