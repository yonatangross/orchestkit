---
title: Design agent-facing error responses with RFC 9457 + operational extensions for deterministic AI agent control flow
impact: HIGH
impactDescription: "AI agents waste tokens parsing HTML/unstructured errors and use brittle heuristics for retry decisions — structured errors with explicit retryable/retry_after/error_category fields enable deterministic, token-efficient agent error handling"
tags: rfc9457, agent, ai-agent, error-response, content-negotiation, retryable, error-category, accept-header, token-efficiency
---

## Agent-Facing Error Responses

Extend RFC 9457 Problem Details with agent-specific operational fields that enable deterministic error handling without LLM reasoning.

**Why this matters:** A standard HTML error page costs ~14,000 tokens. A structured RFC 9457 response costs ~250 tokens — a 98% reduction. More importantly, explicit `retryable` and `error_category` fields let agents branch deterministically instead of guessing from status codes.

### Agent Extension Fields

Add these operational fields alongside standard RFC 9457 members:

```python
from pydantic import BaseModel, Field
from enum import StrEnum
from typing import Any

class ErrorCategory(StrEnum):
    ACCESS_DENIED = "access_denied"         # 401/403 — don't retry
    RATE_LIMIT = "rate_limit"               # 429 — wait and retry
    NOT_FOUND = "not_found"                 # 404 — don't retry
    VALIDATION = "validation"               # 422 — fix input, don't retry
    CONFIG = "config"                       # Misconfiguration — escalate
    TIMEOUT = "timeout"                     # 408/504 — retry with backoff
    SERVER_ERROR = "server_error"           # 500 — retry cautiously
    QUOTA = "quota"                         # Plan/usage limit — escalate
    DEPENDENCY = "dependency"               # Upstream failure — retry
    UNSUPPORTED = "unsupported"             # Method/feature — don't retry

class AgentProblemDetail(BaseModel):
    """RFC 9457 + agent-facing operational extensions."""
    # Standard RFC 9457
    type: str = Field(description="URI identifying the problem type")
    title: str = Field(description="Short human-readable summary")
    status: int = Field(ge=400, le=599)
    detail: str | None = None
    instance: str | None = None

    # Agent operational extensions
    error_category: ErrorCategory
    retryable: bool = Field(description="Explicit: can retry succeed?")
    retry_after: int | None = Field(
        default=None,
        description="Seconds to wait before retrying",
    )
    owner_action_required: bool = Field(
        default=False,
        description="Whether a human must intervene",
    )
    what_you_should_do: str | None = Field(
        default=None,
        description="Agent-optimized guidance (< 50 words)",
    )

    model_config = {"extra": "allow"}
```

### Error Category → Agent Action Mapping

Design your categories so agents can branch without reasoning:

| Category | Retry? | Agent Action |
|----------|--------|-------------|
| `access_denied` | No | Log and escalate |
| `rate_limit` | Yes | Wait `retry_after` seconds, then retry |
| `not_found` | No | Report missing resource |
| `validation` | No | Fix input based on `errors` field |
| `config` | No | Escalate to owner |
| `timeout` | Yes | Retry with exponential backoff |
| `server_error` | Yes | Retry up to 3 times with backoff |
| `quota` | No | Escalate — plan upgrade needed |
| `dependency` | Yes | Retry with backoff |
| `unsupported` | No | Use alternative method/endpoint |

### Content Negotiation Middleware

Serve the same error identity in three formats via `Accept` header:

```python
from fastapi import Request
from fastapi.responses import JSONResponse, Response
import yaml

def negotiate_error_format(request: Request, problem: dict) -> Response:
    accept = request.headers.get("accept", "")

    if "application/problem+json" in accept or "application/json" in accept:
        return JSONResponse(
            status_code=problem["status"],
            content=problem,
            media_type="application/problem+json",
        )

    if "text/markdown" in accept:
        # LLM-optimized: YAML frontmatter + prose
        frontmatter = yaml.dump({
            k: v for k, v in problem.items()
            if k not in ("what_you_should_do", "detail")
        }, default_flow_style=False)
        body = f"""---
{frontmatter.strip()}
---

## What Happened

{problem.get("detail", problem["title"])}

## What You Should Do

{problem.get("what_you_should_do", "Contact support.")}
"""
        return Response(
            content=body,
            status_code=problem["status"],
            media_type="text/markdown",
        )

    # Default: HTML for browsers (existing error pages)
    return render_html_error(problem)
```

**Precedence rule:** First explicit structured type in Accept wins. Bare `*/*` defaults to HTML.

### Agent-Optimized Response Examples

**Rate limit (agent gets deterministic retry signal):**
```json
{
  "type": "https://api.example.com/problems/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "You have exceeded 100 requests per minute.",
  "error_category": "rate_limit",
  "retryable": true,
  "retry_after": 30,
  "owner_action_required": false,
  "what_you_should_do": "Wait 30 seconds, then retry with exponential backoff."
}
```

**Agent control flow (deterministic, no LLM reasoning needed):**
```python
async def handle_api_error(response: httpx.Response) -> str:
    if response.headers.get("content-type", "").startswith("application/problem"):
        error = response.json()
    else:
        return f"unstructured_error_{response.status_code}"

    if error.get("retryable"):
        wait = error.get("retry_after", 30)
        await asyncio.sleep(wait)
        return f"retry_after_{wait}s"

    if error.get("owner_action_required"):
        return f"escalate_{error.get('error_category')}"

    return f"stop_{error.get('error_category')}_{error.get('status')}"
```

### Token Efficiency Budget

| Format | Typical Size | Tokens | Use Case |
|--------|-------------|--------|----------|
| HTML error page | ~46 KB | ~14,000 | Browser rendering |
| JSON (problem+json) | ~500 B | ~250 | Agent control flow |
| Markdown (YAML + prose) | ~800 B | ~220 | LLM context window |

**Rule:** Agent-facing error responses MUST stay under 300 tokens. Omit HTML, CSS, and verbose prose.

### Anti-Patterns (FORBIDDEN)

```python
# NEVER return HTML to agents — wastes 14,000 tokens
return HTMLResponse("<h1>Error 429</h1><p>Too many requests</p>")

# NEVER omit retryable field — forces agent to guess
return {"type": "...", "status": 429, "detail": "Rate limited"}

# NEVER use ambiguous categories
return {"error_category": "error"}  # Useless — be specific

# NEVER put retry logic in prose only
return {"what_you_should_do": "Please wait 30 seconds and try again"}
# ↑ Missing retryable: true and retry_after: 30 — agent must parse prose
```

**Incorrect — status code only, agent must guess:**
```python
return JSONResponse({"error": "Too many requests"}, status_code=429)
```

**Correct — structured fields, agent branches deterministically:**
```python
return JSONResponse(
    content={
        "type": "https://api.example.com/problems/rate-limit-exceeded",
        "title": "Rate Limit Exceeded",
        "status": 429,
        "error_category": "rate_limit",
        "retryable": True,
        "retry_after": 30,
        "owner_action_required": False,
        "what_you_should_do": "Wait 30 seconds, then retry.",
    },
    status_code=429,
    media_type="application/problem+json",
)
```

### Key Rules

- Always include `error_category` and `retryable` on every error response
- Set `retry_after` (seconds) whenever `retryable` is true
- Set `owner_action_required` when the API consumer cannot self-resolve
- Keep `what_you_should_do` under 50 words — it enters the LLM context
- Use `Accept` header content negotiation: `application/problem+json` for agents, `text/markdown` for LLMs, `text/html` for browsers
- Design 8-15 error categories per domain — enough for deterministic branching, few enough to be learnable
- Agents should send `Accept: application/problem+json, */*` to signal structured error preference
