---
title: Error Type Catalog
impact: HIGH
impactDescription: "A centralized error catalog ensures consistent error handling across all endpoints — ad-hoc error creation leads to duplicate types, inconsistent URIs, and unpredictable client behavior"
tags: error-catalog, problem-types, error-registry, client-handling, exception-classes
---

## Error Type Catalog

Centralized problem type registry with specific exception subclasses and client handling patterns.

**Problem Type Registry:**

```python
# app/core/problem_types.py
PROBLEM_TYPES = {
    "validation-error": {
        "uri": "https://api.example.com/problems/validation-error",
        "title": "Validation Error",
        "status": 422,
    },
    "resource-not-found": {
        "uri": "https://api.example.com/problems/resource-not-found",
        "title": "Resource Not Found",
        "status": 404,
    },
    "rate-limit-exceeded": {
        "uri": "https://api.example.com/problems/rate-limit-exceeded",
        "title": "Too Many Requests",
        "status": 429,
    },
    "unauthorized": {
        "uri": "https://api.example.com/problems/unauthorized",
        "title": "Unauthorized",
        "status": 401,
    },
    "forbidden": {
        "uri": "https://api.example.com/problems/forbidden",
        "title": "Forbidden",
        "status": 403,
    },
    "conflict": {
        "uri": "https://api.example.com/problems/conflict",
        "title": "Conflict",
        "status": 409,
    },
    "internal-error": {
        "uri": "https://api.example.com/problems/internal-error",
        "title": "Internal Server Error",
        "status": 500,
    },
}
```

**Specific Exception Classes:**

```python
class NotFoundProblem(ProblemException):
    def __init__(self, resource: str, resource_id: str, instance: str | None = None):
        super().__init__(
            status_code=404,
            problem_type="https://api.example.com/problems/resource-not-found",
            title="Resource Not Found",
            detail=f"{resource} with ID '{resource_id}' was not found",
            instance=instance,
            resource=resource,
            resource_id=resource_id,
        )

class RateLimitProblem(ProblemException):
    def __init__(self, retry_after: int, instance: str | None = None):
        super().__init__(
            status_code=429,
            problem_type="https://api.example.com/problems/rate-limit-exceeded",
            title="Too Many Requests",
            detail="Rate limit exceeded. Please retry later.",
            instance=instance,
            retry_after=retry_after,
        )

class ConflictProblem(ProblemException):
    def __init__(self, detail: str, conflicting_field: str | None = None):
        super().__init__(
            status_code=409,
            problem_type="https://api.example.com/problems/conflict",
            title="Resource Conflict",
            detail=detail,
            conflicting_field=conflicting_field,
        )
```

**Usage in Endpoints:**

```python
@router.get("/api/v1/analyses/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    request: Request,
    service: AnalysisService = Depends(get_analysis_service),
):
    analysis = await service.get_by_id(analysis_id)
    if not analysis:
        raise NotFoundProblem(
            resource="Analysis",
            resource_id=analysis_id,
            instance=str(request.url),
        )
    return analysis
```

**Python Client Handling:**

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
        if response.headers.get("content-type", "").startswith(
            "application/problem+json"
        ):
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
        return cls(type="about:blank", status=response.status_code)
```

**TypeScript Client Handling:**

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

**Quick Reference:**

| Status | Type Suffix | When to Use |
|--------|-------------|-------------|
| 400 | `bad-request` | Malformed request |
| 401 | `unauthorized` | Missing/invalid auth |
| 403 | `forbidden` | Not authorized |
| 404 | `resource-not-found` | Resource doesn't exist |
| 409 | `conflict` | Duplicate/constraint |
| 422 | `validation-error` | Invalid field values |
| 429 | `rate-limit-exceeded` | Too many requests |
| 500 | `internal-error` | Unexpected error |

**Incorrect — Ad-hoc error creation:**
```python
# Different format every endpoint
raise HTTPException(404, detail="Not found")
raise HTTPException(404, detail={"error": "Missing"})
return JSONResponse({"message": "No such resource"}, 404)
```

**Correct — Centralized error catalog:**
```python
# Consistent use of problem types
raise NotFoundProblem(
    resource="Analysis",
    resource_id=analysis_id,
    instance=str(request.url)
)
# Always returns: application/problem+json with standard fields
```

**Key rules:**
- Define all problem type URIs in a centralized registry
- Create specific exception subclasses for each problem type
- Stable URIs: problem type URLs should never change
- Document each problem type at its URI
- Provide client handling examples in both Python and TypeScript
