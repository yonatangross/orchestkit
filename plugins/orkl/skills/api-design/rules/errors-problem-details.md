---
title: RFC 9457 Problem Details
impact: HIGH
impactDescription: "Inconsistent error formats force every client to implement custom parsing — RFC 9457 Problem Details provides a universal, machine-readable standard"
tags: rfc9457, problem-details, application-problem-json, error-response, fastapi
---

## RFC 9457 Problem Details

Standardize API error responses with the RFC 9457 Problem Details format for machine-readable error handling.

**RFC 9457 vs RFC 7807:**

| Feature | RFC 7807 (Old) | RFC 9457 (Current) |
|---------|----------------|---------------------|
| Status | Obsolete | Active Standard |
| Multiple problems | Not specified | Explicitly supported |
| Error registry | No | Yes (IANA registry) |
| Extension fields | Implicit | Explicitly allowed |

**Problem Details Schema:**

```python
from pydantic import BaseModel, Field, HttpUrl
from typing import Any

class ProblemDetail(BaseModel):
    """RFC 9457 Problem Details for HTTP APIs."""

    type: HttpUrl = Field(
        default="about:blank",
        description="URI identifying the problem type",
    )
    title: str = Field(
        description="Short, human-readable summary",
    )
    status: int = Field(
        ge=400, le=599,
        description="HTTP status code",
    )
    detail: str | None = Field(
        default=None,
        description="Human-readable explanation specific to this occurrence",
    )
    instance: str | None = Field(
        default=None,
        description="URI reference identifying the specific occurrence",
    )

    model_config = {"extra": "allow"}  # Allow extension fields
```

**ProblemException Base Class:**

```python
from fastapi import HTTPException
from typing import Any

class ProblemException(HTTPException):
    """Base exception for RFC 9457 problem details."""

    def __init__(
        self,
        status_code: int,
        problem_type: str,
        title: str,
        detail: str | None = None,
        instance: str | None = None,
        **extensions: Any,
    ):
        self.problem_type = problem_type
        self.title = title
        self.detail = detail
        self.instance = instance
        self.extensions = extensions
        super().__init__(status_code=status_code, detail=detail)

    def to_problem_detail(self) -> dict[str, Any]:
        result = {
            "type": self.problem_type,
            "title": self.title,
            "status": self.status_code,
        }
        if self.detail:
            result["detail"] = self.detail
        if self.instance:
            result["instance"] = self.instance
        result.update(self.extensions)
        return result
```

**FastAPI Exception Handler:**

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(ProblemException)
async def problem_exception_handler(request: Request, exc: ProblemException):
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_problem_detail(),
        media_type="application/problem+json",
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "type": "https://api.example.com/problems/internal-error",
            "title": "Internal Server Error",
            "status": 500,
            "detail": "An unexpected error occurred",
            "instance": str(request.url),
        },
        media_type="application/problem+json",
    )
```

**Response Examples:**

404 Not Found:
```json
{
  "type": "https://api.example.com/problems/resource-not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "Analysis with ID 'abc123' was not found",
  "instance": "/api/v1/analyses/abc123",
  "resource": "Analysis",
  "resource_id": "abc123"
}
```

429 Rate Limited:
```json
{
  "type": "https://api.example.com/problems/rate-limit-exceeded",
  "title": "Too Many Requests",
  "status": 429,
  "detail": "Rate limit exceeded. Please retry later.",
  "instance": "/api/v1/analyses",
  "retry_after": 60
}
```

**Anti-Patterns (FORBIDDEN):**

```python
# NEVER return plain text errors
return Response("Not found", status_code=404)

# NEVER use inconsistent error formats
return {"error": "Not found"}           # Different from other errors
return {"message": "Validation failed"}  # Yet another format

# NEVER expose internal details in production
return {"detail": str(exc), "traceback": traceback.format_exc()}
```

**Incorrect — Inconsistent error formats:**
```python
# Different structure every time
return {"error": "Not found"}
return {"message": "Validation failed", "fields": [...]}
return Response("Internal error", 500)
```

**Correct — RFC 9457 Problem Details:**
```python
# Consistent RFC 9457 format
return JSONResponse(
    content={
        "type": "https://api.example.com/problems/validation-error",
        "title": "Validation Error",
        "status": 422,
        "errors": [{"field": "url", "message": "Invalid format"}]
    },
    media_type="application/problem+json"
)
```

**Key rules:**
- Always use `application/problem+json` media type for error responses
- Include `type` (URI) and `status` (HTTP code) as required fields
- Use `about:blank` when no additional semantics beyond HTTP status
- Add extension fields for machine-readable context (retry_after, resource_id)
- Never expose stack traces or internal details in production
