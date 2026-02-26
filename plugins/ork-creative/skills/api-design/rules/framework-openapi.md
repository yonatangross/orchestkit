---
title: Keep OpenAPI specifications complete and up-to-date as the API provider-consumer contract
impact: HIGH
impactDescription: "OpenAPI specs are the contract between API providers and consumers — incomplete or outdated specs lead to integration failures and developer frustration"
tags: openapi, documentation, schema, swagger, asyncapi
---

## OpenAPI Specifications

Patterns for creating comprehensive OpenAPI 3.1 specifications with proper schema definitions, authentication, and error documentation.

**OpenAPI 3.1 Structure:**

```yaml
openapi: 3.1.0

info:
  title: Your API Name
  version: 1.0.0
  description: |
    Brief description of what this API does.

    ## Authentication
    This API uses Bearer tokens for authentication.

    ## Rate Limiting
    - 1000 requests per hour per API key

servers:
  - url: https://api.company.com/v1
    description: Production server
  - url: http://localhost:3000/v1
    description: Local development
```

**Endpoint Documentation with FastAPI:**

```python
@router.get(
    "/analyses/{analysis_id}",
    responses={
        404: {"model": ErrorResponse, "description": "Analysis not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
    summary="Get analysis details",
    description="Retrieve detailed information about a specific analysis",
)
async def get_analysis(
    analysis_id: Annotated[uuid.UUID, Path(description="Analysis UUID")]
) -> AnalysisResponse:
    ...
```

**Reusable Components:**

```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  parameters:
    PageParam:
      name: page
      in: query
      schema:
        type: integer
        minimum: 1
        default: 1

    PerPageParam:
      name: per_page
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20

  headers:
    X-RateLimit-Limit:
      description: Maximum requests allowed per hour
      schema:
        type: integer
        example: 1000

    X-RateLimit-Remaining:
      description: Requests remaining in current window
      schema:
        type: integer

  schemas:
    Error:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message]
          properties:
            code:
              type: string
              example: "VALIDATION_ERROR"
            message:
              type: string
            details:
              type: array
              items:
                type: object
                properties:
                  field:
                    type: string
                  message:
                    type: string
            request_id:
              type: string

  responses:
    NotFoundError:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

    ValidationError:
      description: Validation failed
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
```

**Per-Version OpenAPI Docs:**

```python
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

def custom_openapi_v1():
    return get_openapi(
        title="OrchestKit API",
        version="1.0.0",
        routes=v1_router.routes,
    )

def custom_openapi_v2():
    return get_openapi(
        title="OrchestKit API",
        version="2.0.0",
        routes=v2_router.routes,
    )

app.mount("/docs/v1", create_docs_app(custom_openapi_v1))
app.mount("/docs/v2", create_docs_app(custom_openapi_v2))
```

**Pydantic Schema Validation:**

```python
from pydantic import BaseModel, HttpUrl, Field

class AnalyzeRequest(BaseModel):
    url: HttpUrl
    analysis_id: str | None = None
    skill_level: str = Field(
        default="beginner",
        pattern="^(beginner|intermediate|advanced)$",
    )
```

**Incorrect — Missing response documentation:**
```python
# No response schema or error docs
@router.get("/analyses/{id}")
async def get_analysis(id: str):
    return await service.get(id)
```

**Correct — Full OpenAPI documentation:**
```python
@router.get(
    "/analyses/{id}",
    responses={
        404: {"model": ErrorResponse, "description": "Analysis not found"},
        500: {"model": ErrorResponse, "description": "Internal error"}
    },
    summary="Get analysis details"
)
async def get_analysis(id: Annotated[str, Path(description="Analysis UUID")]) -> AnalysisResponse:
    return await service.get(id)
```

**Key rules:**
- Use OpenAPI 3.1 for all new API specifications
- Define reusable schemas, parameters, and responses in `components`
- Document all error responses with examples
- Include security schemes and rate limit headers
- Generate per-version documentation when versioning
