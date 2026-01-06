# RFC 9457 Problem Details for HTTP APIs

Comprehensive guide to the RFC 9457 specification for machine-readable error responses.

## Overview

RFC 9457 (formerly RFC 7807) defines a standard format for expressing API errors as JSON/XML objects. This allows clients to programmatically understand and handle errors.

## Problem Details Object

### Required Members

| Member | Type | Description |
|--------|------|-------------|
| `type` | URI | A URI reference identifying the problem type |
| `status` | integer | The HTTP status code |

### Optional Members

| Member | Type | Description |
|--------|------|-------------|
| `title` | string | Short, human-readable summary |
| `detail` | string | Human-readable explanation specific to this occurrence |
| `instance` | URI | URI reference identifying the specific occurrence |

### Extension Members

You can add custom members for additional context:

```json
{
  "type": "https://api.skillforge.dev/problems/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "The request body contains invalid data",
  "instance": "/api/v1/analyses/123",
  "errors": [
    {"field": "url", "message": "Invalid URL format"},
    {"field": "depth", "message": "Must be between 1 and 3"}
  ],
  "trace_id": "abc123",
  "timestamp": "2026-01-07T10:30:00Z"
}
```

## Media Type

Always use the correct media type:

```
Content-Type: application/problem+json
```

For XML (less common):
```
Content-Type: application/problem+xml
```

## Problem Type URIs

### URI Design Principles

1. **Stable**: URLs should not change
2. **Documented**: Each type should have documentation at the URL
3. **Versioned**: Consider including version in path
4. **Hierarchical**: Use path segments for categories

### Examples

```
# Good: Specific, documented
https://api.skillforge.dev/problems/rate-limit-exceeded
https://api.skillforge.dev/problems/validation-error
https://api.skillforge.dev/problems/resource-not-found

# Bad: Generic, undocumented
https://example.com/error
about:blank
```

### about:blank

Use `about:blank` when the problem has no additional semantics beyond the HTTP status:

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "The requested resource was not found"
}
```

## Common Problem Types

### Validation Error (422)

```json
{
  "type": "https://api.skillforge.dev/problems/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "One or more fields failed validation",
  "errors": [
    {
      "field": "email",
      "code": "invalid_format",
      "message": "Invalid email format"
    },
    {
      "field": "password",
      "code": "too_short",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

### Authentication Error (401)

```json
{
  "type": "https://api.skillforge.dev/problems/authentication-required",
  "title": "Authentication Required",
  "status": 401,
  "detail": "Access token is missing or invalid"
}
```

### Authorization Error (403)

```json
{
  "type": "https://api.skillforge.dev/problems/insufficient-permissions",
  "title": "Insufficient Permissions",
  "status": 403,
  "detail": "You don't have permission to access this resource",
  "required_permission": "analyses:write"
}
```

### Resource Not Found (404)

```json
{
  "type": "https://api.skillforge.dev/problems/resource-not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "Analysis with ID 'abc123' was not found",
  "resource_type": "analysis",
  "resource_id": "abc123"
}
```

### Rate Limit Exceeded (429)

```json
{
  "type": "https://api.skillforge.dev/problems/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "You have exceeded 100 requests per minute",
  "retry_after": 45,
  "limit": 100,
  "window": "1 minute"
}
```

### Conflict (409)

```json
{
  "type": "https://api.skillforge.dev/problems/resource-conflict",
  "title": "Resource Conflict",
  "status": 409,
  "detail": "A user with this email already exists",
  "conflicting_field": "email"
}
```

### Internal Server Error (500)

```json
{
  "type": "https://api.skillforge.dev/problems/internal-error",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "An unexpected error occurred. Please try again later.",
  "trace_id": "trace-abc123",
  "support_url": "https://support.skillforge.dev"
}
```

## Client Handling

### Python Client Example

```python
import httpx
from dataclasses import dataclass

@dataclass
class ProblemDetail:
    type: str
    status: int
    title: str | None = None
    detail: str | None = None
    instance: str | None = None
    extensions: dict | None = None

    @classmethod
    def from_response(cls, response: httpx.Response) -> "ProblemDetail":
        if response.headers.get("content-type", "").startswith("application/problem+json"):
            data = response.json()
            return cls(
                type=data.get("type", "about:blank"),
                status=data.get("status", response.status_code),
                title=data.get("title"),
                detail=data.get("detail"),
                instance=data.get("instance"),
                extensions={
                    k: v for k, v in data.items()
                    if k not in ("type", "status", "title", "detail", "instance")
                },
            )
        return cls(
            type="about:blank",
            status=response.status_code,
            title=response.reason_phrase,
        )


class APIError(Exception):
    def __init__(self, problem: ProblemDetail):
        self.problem = problem
        super().__init__(problem.detail or problem.title)


async def make_request(url: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(url)

        if response.is_error:
            problem = ProblemDetail.from_response(response)
            raise APIError(problem)

        return response.json()
```

### TypeScript Client Example

```typescript
interface ProblemDetail {
  type: string;
  status: number;
  title?: string;
  detail?: string;
  instance?: string;
  [key: string]: unknown; // Extensions
}

class APIError extends Error {
  constructor(public problem: ProblemDetail) {
    super(problem.detail || problem.title || 'Unknown error');
  }
}

async function fetchWithProblemDetails(url: string): Promise<Response> {
  const response = await fetch(url);

  if (!response.ok) {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/problem+json')) {
      const problem: ProblemDetail = await response.json();
      throw new APIError(problem);
    }

    throw new APIError({
      type: 'about:blank',
      status: response.status,
      title: response.statusText,
    });
  }

  return response;
}
```

## Related Files

- See `examples/fastapi-problem-details.md` for FastAPI implementation
- See `checklists/error-handling-checklist.md` for implementation checklist
- See SKILL.md for complete patterns
