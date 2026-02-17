---
title: Validation Error Handling
impact: HIGH
impactDescription: "Validation errors are the most common API error — poor field-level details force users to guess which field failed and why, increasing support burden"
tags: validation, field-errors, pydantic, 422, unprocessable-entity
---

## Validation Error Handling

Patterns for structured field-level validation errors using RFC 9457 Problem Details.

**Validation Problem Type:**

```python
class ValidationProblem(ProblemException):
    def __init__(self, errors: list[dict], instance: str | None = None):
        super().__init__(
            status_code=422,
            problem_type="https://api.example.com/problems/validation-error",
            title="Validation Error",
            detail="One or more fields failed validation",
            instance=instance,
            errors=errors,  # Extension field
        )
```

**Pydantic RequestValidationError Handler:**

```python
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
):
    errors = [
        {
            "field": ".".join(str(loc) for loc in err["loc"][1:]),
            "code": err["type"],
            "message": err["msg"],
        }
        for err in exc.errors()
    ]
    problem = ValidationProblem(errors=errors, instance=str(request.url))
    return JSONResponse(
        status_code=422,
        content=problem.to_problem_detail(),
        media_type="application/problem+json",
    )
```

**Validation Error Response:**

```json
{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "One or more fields failed validation",
  "instance": "/api/v1/analyses",
  "errors": [
    {"field": "source_url", "code": "url_parsing", "message": "Invalid URL format"},
    {"field": "depth", "code": "less_than_equal", "message": "Must be between 1 and 3"}
  ]
}
```

**Custom Validation Beyond Pydantic:**

```python
@router.post("/analyses")
async def create_analysis(
    request: AnalyzeRequest,
    service: AnalysisService = Depends(),
):
    # Custom validation beyond Pydantic schema
    if not is_valid_url(str(request.url)):
        raise ValidationProblem(
            errors=[
                {
                    "field": "url",
                    "code": "invalid_url",
                    "message": "URL is not accessible or returns an error",
                }
            ]
        )
    return await service.create(request)
```

**GraphQL Field-Level Errors:**

```graphql
type CreateUserPayload {
  user: User
  errors: [UserError!]
}

type UserError {
  field: String!
  message: String!
  code: String!
}
```

Response:
```json
{
  "data": {
    "createUser": {
      "user": null,
      "errors": [
        {
          "field": "email",
          "message": "Email is already taken",
          "code": "DUPLICATE_EMAIL"
        }
      ]
    }
  }
}
```

**Testing Validation Errors:**

```python
@pytest.mark.asyncio
async def test_validation_error_includes_field_errors(client: AsyncClient):
    response = await client.post("/api/v1/analyses", json={"url": "not-a-url"})

    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"

    problem = response.json()
    assert problem["type"].endswith("validation-error")
    assert "errors" in problem
    assert any(e["field"] == "url" for e in problem["errors"])
```

**Incorrect — Generic validation error:**
```python
# No field-level details
return {"error": "Validation failed"}, 422
```

**Correct — Field-level validation errors:**
```python
# Specific field errors
return {
    "type": "https://api.example.com/problems/validation-error",
    "status": 422,
    "errors": [
        {"field": "url", "code": "url_parsing", "message": "Invalid URL format"},
        {"field": "depth", "code": "less_than_equal", "message": "Must be between 1 and 3"}
    ]
}, 422
```

**Key rules:**
- Always include all validation errors, not just the first one
- Provide field path, error code, and human-readable message per error
- Skip the `body` prefix from Pydantic location paths
- Use consistent error structure across all validation failures
- Map Pydantic error types to user-friendly codes where needed
